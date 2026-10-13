import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Battery from 'expo-battery';
import * as Crypto from 'expo-crypto';
import notifee, { AndroidImportance, AndroidForegroundServiceType, AuthorizationStatus, EventType } from 'react-native-notify-kit';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { featureSupabase as db } from '@/lib/data/feature-client';
import { distance, expiry, isLive, sameExpiry, updateInterval } from './geo';
import { journeySchema, placeSchema, type Destination, type Lease, type LocationPoint, type ShareMode } from './types';
import { useLocationState } from './store';

const TASK = 'us-location-latest-v1';
const FENCE_TASK = 'us-location-geofence-v1';
const LEASE_KEY = 'location:consent:v1';
const STOP_KEY = 'location:pending-stop:v1';
const NOTICE = 'us-location-sharing';
let lease: Lease | null = null;
let queue: Promise<unknown> = Promise.resolve();
let lastPoint: LocationPoint | null = null;
let lastSent = 0;
let frequency = 10_000;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
let finishService: (() => void) | undefined;
let generation = 0;
let stoppedInProcess = false;
let startingSharing = false;
let headlessEntryReady = false;
export function markLocationHeadlessEntry() { headlessEntryReady = true; }
export function isLocationHeadlessReady() { return headlessEntryReady; }
const budget = new Map<string, number>();
const lowBattery = new Set<number>();
function serial<T>(action: () => Promise<T>): Promise<T> { const next = queue.then(action, action); queue = next.catch(() => {}); return next; }
function message(error: unknown) { return error instanceof Error ? error.message : 'Location could not sync. Check your connection and retry.'; }
function fail(error: unknown) { useLocationState.setState({ error: message(error) }); }
export async function notify(key: string, title: string, body: string, minimum = 60_000) {
  if (!lease || !isLive(lease.until)) return;
  const now = Date.now();
  const active = lease;
  const storageKey = `location:rate:${active.uid}:${key}`;
  const previous = budget.get(storageKey) ?? Number(await AsyncStorage.getItem(storageKey) ?? 0);
  if (now - previous < minimum) return;
  budget.set(storageKey, now);
  if (lease?.id !== active.id || !(await checkedLease())) return;
  const { error } = await supabase.functions.invoke('notify-partner', { body: { channel: 'location', title, body, data: { route: '/us/location' } } });
  if (error) { budget.delete(storageKey); throw new Error('Location updated, but the partner notification could not be delivered.'); }
  await AsyncStorage.setItem(storageKey, String(now));
}
async function checkedLease() {
  const reading = generation;
  if (!lease && !stoppedInProcess && !(await AsyncStorage.getItem(STOP_KEY))) {
    const raw = await AsyncStorage.getItem(LEASE_KEY);
    if (raw) {
      const saved: unknown = JSON.parse(raw);
      if (saved && typeof saved === 'object' && 'uid' in saved && typeof saved.uid === 'string' && 'coupleId' in saved && typeof saved.coupleId === 'string' && 'until' in saved && typeof saved.until === 'string' && 'id' in saved && typeof saved.id === 'string') {
        if (reading === generation && !stoppedInProcess) lease = { uid: saved.uid, coupleId: saved.coupleId, until: saved.until, id: saved.id };
      }
    }
  }
  const { data } = await supabase.auth.getSession();
  if (!lease || data.session?.user.id !== lease.uid || !isLive(lease.until)) return null;
  return lease;
}
async function nativeStop() {
  clearTimeout(expiryTimer);
  await Promise.allSettled([
    Location.hasStartedLocationUpdatesAsync(TASK).then(started => started ? Location.stopLocationUpdatesAsync(TASK) : undefined),
    Location.hasStartedGeofencingAsync(FENCE_TASK).then(started => started ? Location.stopGeofencingAsync(FENCE_TASK) : undefined),
    notifee.cancelNotification(NOTICE),
  ]);
  if (finishService) { finishService(); finishService = undefined; }
  await notifee.stopForegroundService().catch(() => fail(new Error('Android could not stop its location controls service. Location uploads are disabled. Open Android app settings to check the service.')));
}
export async function retryDeletion() {
  const raw = await AsyncStorage.getItem(STOP_KEY);
  if (!raw) return;
  useLocationState.setState({ pendingStop: true });
  const pending: unknown = JSON.parse(raw);
  const { data } = await supabase.auth.getSession();
  if (typeof pending !== 'string' || data.session?.user.id !== pending) {
    useLocationState.setState({ pendingStop: true, error: 'A previous account’s Stop is pending. Sign in to that account to remove its server point.' });
    return;
  }
  const { error } = await db.from('locations').delete().eq('user_id', pending).abortSignal(AbortSignal.timeout(12_000));
  if (error) throw new Error('Sharing stopped on this phone. Server deletion is pending; your partner may see the last point until it expires. Reconnect and retry Stop.');
  await AsyncStorage.removeItem(STOP_KEY);
  useLocationState.setState({ pendingStop: false, error: null });
}
export async function stopSharing() {
  generation++;
  stoppedInProcess = true;
  const previous = lease;
  lease = null; lastPoint = null; lastSent = 0; lowBattery.clear();
  useLocationState.setState({ lease: null, pendingStop: !!previous || useLocationState.getState().pendingStop });
  // Persist revocation before waiting on network or native work. A callback can never upsert.
  try {
    if (previous) await AsyncStorage.setItem(STOP_KEY, JSON.stringify(previous.uid));
    await AsyncStorage.removeItem(LEASE_KEY);
  } finally { await nativeStop(); }
  return serial(async () => {
    try { await retryDeletion(); } catch (error) { useLocationState.setState({ pendingStop: true }); fail(error); throw error; }
  });
}
function armExpiry(active: Lease) {
  clearTimeout(expiryTimer);
  if (active.until !== 'infinity') expiryTimer = setTimeout(() => { void stopSharing().catch(fail); }, Math.max(0, Date.parse(active.until) - Date.now()));
}
async function configureUpdates(interval: number) {
  const configuring = lease?.id;
  if (!configuring) return;
  frequency = interval;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: interval === 300_000 ? Location.Accuracy.Balanced : Location.Accuracy.High,
    timeInterval: interval, distanceInterval: 0, deferredUpdatesInterval: interval,
    foregroundService: { notificationTitle: "You're sharing your location", notificationBody: 'Open Us to pause, or use Stop in the location controls notification.', killServiceOnDestroy: true },
  });
  if (lease?.id !== configuring) await Location.stopLocationUpdatesAsync(TASK);
}
async function showControls() {
  const settings = await notifee.requestPermission();
  if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) throw new Error('Enable notifications before sharing so the sharing indicator and Stop control stay visible.');
  await notifee.createChannel({ id: 'location-sharing', name: 'Location sharing controls', importance: AndroidImportance.DEFAULT });
  const channel = await notifee.getChannel('location-sharing');
  if (channel?.blocked) throw new Error('Enable the Location sharing controls notification channel in Android Settings before sharing.');
  await notifee.displayNotification({
    id: NOTICE, title: "You're sharing your location", body: 'Only your latest point is shared with your partner. Stop at any time.',
    android: { channelId: 'location-sharing', asForegroundService: true, ongoing: true, autoCancel: false,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_LOCATION],
      pressAction: { id: 'location-open', launchActivity: 'default' },
      actions: [{ title: 'Stop', pressAction: { id: 'location-stop' } }],
    },
  });
}
export async function startSharing(uid: string, coupleId: string, mode: ShareMode) {
  if (!headlessEntryReady) throw new Error('Location setup is incomplete: load the location headless entry before Expo Router so background Stop can work reliably. Sharing remains off.');
  if (Platform.OS !== 'android') throw new Error('Location sharing is supported on Android.');
  if (lease) throw new Error('Stop the current session before starting another.');
  const starting = ++generation;
  startingSharing = true;
  return serial(async () => {
    await retryDeletion();
    if (await AsyncStorage.getItem(STOP_KEY)) throw new Error('Finish the pending Stop before starting a new sharing session.');
    const { data } = await supabase.auth.getSession();
    if (data.session?.user.id !== uid) throw new Error('Sign in again before enabling location sharing.');
    if (!(await Location.getForegroundPermissionsAsync()).granted) throw new Error('Allow foreground location first.');
    if (!(await Location.requestBackgroundPermissionsAsync()).granted) throw new Error('Choose Allow all the time in Android Settings, then return and try again.');
    const next: Lease = { uid, coupleId, until: expiry(mode), id: Crypto.randomUUID() };
    try {
      await showControls();
      if (starting !== generation) { await nativeStop(); return; }
      stoppedInProcess = false;
      lease = next; await AsyncStorage.setItem(LEASE_KEY, JSON.stringify(next));
      if (starting !== generation) { await AsyncStorage.removeItem(LEASE_KEY); await nativeStop(); return; }
      useLocationState.setState({ lease: next, error: null });
      lastSent = 0; lowBattery.clear();
      await configureUpdates(10_000); armExpiry(next);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (lease?.id !== next.id) return;
      await publish(position, true);
      await syncGeofences();
    } catch (error) {
      const old = lease; lease = null;
      useLocationState.setState({ lease: null });
      await AsyncStorage.removeItem(LEASE_KEY);
      if (old) { await AsyncStorage.setItem(STOP_KEY, JSON.stringify(old.uid)); useLocationState.setState({ pendingStop: true }); }
      await nativeStop();
      await retryDeletion().catch(fail);
      throw error;
    }
  }).finally(() => { startingSharing = false; });
}
async function batteryReading() {
  try {
    const [level, state] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
    return { battery_pct: level < 0 ? null : Math.round(level * 100), charging: state === Battery.BatteryState.UNKNOWN ? null : state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL };
  } catch { return { battery_pct: null, charging: null }; }
}
async function publish(position: Location.LocationObject, initial = false) {
  const active = await checkedLease();
  if (!active) return;
  const c = position.coords;
  if (!Number.isFinite(c.latitude) || !Number.isFinite(c.longitude) || position.timestamp < Date.now() - 300_000) return;
  const elapsed = lastPoint ? (position.timestamp - Date.parse(lastPoint.updated_at)) / 1000 : 0;
  const inferred = lastPoint && elapsed > 0 ? Math.max(0, distance(lastPoint, { lat: c.latitude, lon: c.longitude }) - (c.accuracy ?? 0) - (lastPoint.accuracy ?? 0)) / elapsed : 0;
  const speed = c.speed !== null && c.speed >= 0 ? c.speed : inferred;
  const interval = updateInterval(Math.max(speed, inferred));
  if (interval !== frequency) await configureUpdates(interval);
  if (!initial && Date.now() - lastSent < interval) return;
  const battery = await batteryReading();
  const point: LocationPoint = { user_id: active.uid, couple_id: active.coupleId, lat: c.latitude, lon: c.longitude, accuracy: c.accuracy, speed, heading: c.heading, ...battery, updated_at: new Date(position.timestamp).toISOString(), sharing_until: active.until };
  if (lease?.id !== active.id || !isLive(active.until)) return;
  const request = initial ? db.from('locations').upsert(point, { onConflict: 'user_id' }) : db.from('locations').update(point).eq('user_id', active.uid).eq('sharing_until', active.until);
  const { data: written, error } = await request.select('user_id').abortSignal(AbortSignal.timeout(12_000));
  if (error) throw new Error('Location could not sync. Your partner may see an older point. Check your connection.');
  if (!written?.length) {
    lease = null; lastPoint = null;
    await AsyncStorage.removeItem(LEASE_KEY); await nativeStop();
    useLocationState.setState({ lease: null, error: 'The sharing session ended. Choose to share again to begin a new session.' });
    return;
  }
  if (lease?.id !== active.id) return;
  lastPoint = point; lastSent = Date.now();
  if (battery.battery_pct !== null) {
    for (const threshold of [15, 5]) {
      if (battery.battery_pct >= threshold + 3) { lowBattery.delete(threshold); await AsyncStorage.removeItem(`location:low:${active.uid}:${threshold}`); }
      if ((threshold === 5 ? battery.battery_pct <= threshold : battery.battery_pct < threshold) && !battery.charging && !lowBattery.has(threshold) && !(await AsyncStorage.getItem(`location:low:${active.uid}:${threshold}`))) {
        lowBattery.add(threshold); await AsyncStorage.setItem(`location:low:${active.uid}:${threshold}`, 'sent');
        await notify(`battery-${threshold}`, 'A gentle battery heads-up', `Your partner’s battery is below ${threshold}%. They may go offline.`, 300_000);
      }
    }
  }
  const { data, error: journeyError } = await db.from('journeys').select('*').eq('user_id', active.uid).eq('status', 'active').abortSignal(AbortSignal.timeout(12_000)).maybeSingle();
  if (journeyError) return;
  const journey = journeySchema.safeParse(data);
  if (journey.success && (c.accuracy ?? Infinity) <= 100 && distance(point, { lat: journey.data.dest_lat, lon: journey.data.dest_lon }) <= 150) {
    const { error: arrivalError } = await db.from('journeys').update({ status: 'arrived', arrived_at: new Date().toISOString() }).eq('id', journey.data.id).eq('user_id', active.uid).eq('status', 'active');
    if (!arrivalError) await notify('arrival', 'Arrived safely', `Your partner arrived at ${journey.data.dest_name}.`);
  }
}
export async function syncGeofences() {
  const active = await checkedLease();
  if (!active) return;
  const { data, error } = await db.from('saved_places').select('*').eq('user_id', active.uid).eq('notify_partner', true).order('name').abortSignal(AbortSignal.timeout(12_000));
  if (error) throw new Error('Saved place alerts could not sync.');
  const places = placeSchema.array().parse(data ?? []);
  if (places.length > 20) throw new Error('Turn off some place alerts: at most 20 can be monitored.');
  if (lease?.id !== active.id || !isLive(active.until)) return;
  if (places.length) {
    await Location.startGeofencingAsync(FENCE_TASK, places.map(p => ({ identifier: p.id, latitude: p.lat, longitude: p.lon, radius: p.radius_m, notifyOnEnter: true, notifyOnExit: true })));
    if (lease?.id !== active.id) await Location.stopGeofencingAsync(FENCE_TASK);
  }
  else if (await Location.hasStartedGeofencingAsync(FENCE_TASK)) await Location.stopGeofencingAsync(FENCE_TASK);
}
export async function beginJourney(destination: Destination) {
  return serial(async () => {
    const active = await checkedLease();
    if (!active) throw new Error('Enable location sharing before starting a journey.');
    const { error: clearError } = await db.from('journeys').delete().eq('user_id', active.uid);
    if (clearError) throw new Error('The previous journey could not be cleared.');
    const id = Crypto.randomUUID();
    const { error } = await db.from('journeys').insert({ id, user_id: active.uid, couple_id: active.coupleId, dest_name: destination.name.slice(0, 160), dest_lat: destination.lat, dest_lon: destination.lon });
    if (error) throw new Error('The journey could not start. Try again online.');
    await notify('departure', 'On the way', `Your partner is heading to ${destination.name}.`);
  });
}
export async function restoreSharing(uid: string, coupleId: string) {
  if (startingSharing) return;
  const restoring = generation;
  await retryDeletion().catch(fail);
  const raw = await AsyncStorage.getItem(LEASE_KEY);
  if (restoring !== generation || startingSharing) return;
  if (!raw) { await nativeStop(); useLocationState.setState({ ready: true }); return; }
  let saved: Lease;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('uid' in value) || value.uid !== uid || !('coupleId' in value) || value.coupleId !== coupleId || !('until' in value) || typeof value.until !== 'string' || !('id' in value) || typeof value.id !== 'string') throw new Error('Consent does not match this account.');
    saved = { uid, coupleId, until: value.until, id: value.id };
  } catch { await AsyncStorage.removeItem(LEASE_KEY); await nativeStop(); useLocationState.setState({ ready: true }); return; }
  if (restoring !== generation) return;
  lease = saved;
  if (!isLive(saved.until)) { await stopSharing().catch(fail); useLocationState.setState({ ready: true }); return; }
  try {
    if (!(await Location.getForegroundPermissionsAsync()).granted || !(await Location.getBackgroundPermissionsAsync()).granted) throw new Error('Location permission was removed. Sharing has stopped.');
    const settings = await notifee.getNotificationSettings();
    if (settings.authorizationStatus !== AuthorizationStatus.AUTHORIZED) throw new Error('Notification permission was removed. Sharing has stopped.');
    // Never recreate a server point during recovery: a remote Stop must remain stopped.
    const { data, error } = await db.from('locations').select('sharing_until').eq('user_id', uid).maybeSingle();
    if (error) throw new Error('Cannot verify sharing consent online. Sharing has stopped.');
    if (!data || typeof data.sharing_until !== 'string' || !sameExpiry(data.sharing_until, saved.until)) throw new Error('The previous sharing session ended.');
    if (restoring !== generation) return;
    useLocationState.setState({ lease: saved });
    await showControls();
    if (restoring !== generation || startingSharing) { await nativeStop(); return; }
    await configureUpdates(frequency);
    if (restoring !== generation) { await nativeStop(); return; }
    await syncGeofences(); armExpiry(saved);
  } catch (error) { await stopSharing().catch(fail); fail(error); }
  useLocationState.setState({ ready: true });
}
if (Platform.OS === 'android') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (lease && (event === 'SIGNED_OUT' || (session && session.user.id !== lease.uid))) void stopSharing().catch(fail);
  });
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    try {
      if (error) throw new Error('Android could not update location. Open Us to check permissions.');
      const notificationSettings = await notifee.getNotificationSettings();
      const channel = await notifee.getChannel('location-sharing');
      if (!(await checkedLease()) || notificationSettings.authorizationStatus !== AuthorizationStatus.AUTHORIZED || channel?.blocked) { await stopSharing(); return; }
      const newest = data?.locations.reduce<Location.LocationObject | undefined>((a, b) => !a || b.timestamp > a.timestamp ? b : a, undefined);
      if (newest) await serial(() => publish(newest));
    } catch (problem) { fail(problem); }
  });
  TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(FENCE_TASK, async ({ data, error }) => {
    try {
      if (error || !data || !(await checkedLease())) return;
      const { data: row } = await db.from('saved_places').select('*').eq('id', data.region.identifier ?? '').eq('user_id', lease?.uid ?? '').maybeSingle();
      const result = placeSchema.safeParse(row);
      if (!result.success || !result.data.notify_partner) return;
      const entering = data.eventType === Location.GeofencingEventType.Enter;
      await notify(`fence-${result.data.id}`, entering ? 'Arrived safely' : 'Heading out', `Your partner ${entering ? 'arrived at' : 'left'} ${result.data.name}.`, 300_000);
    } catch (problem) { fail(problem); }
  });
  notifee.registerForegroundService(() => new Promise<void>(resolve => { finishService = resolve; }));
  notifee.onBackgroundEvent(async ({ type, detail }) => {
    if (type === EventType.ACTION_PRESS && detail.pressAction?.id === 'location-stop') {
      if (!lease) {
        const raw = await AsyncStorage.getItem(LEASE_KEY);
        if (raw) { const value: unknown = JSON.parse(raw); if (value && typeof value === 'object' && 'uid' in value && typeof value.uid === 'string') await AsyncStorage.setItem(STOP_KEY, JSON.stringify(value.uid)); }
      }
      await stopSharing().catch(fail);
    }
  });
}
