import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useAvatar, usePartner, useProfile } from '@/lib/hooks';
import { featureSupabase as db } from '@/lib/data/feature-client';
import { useTheme } from '@/theme';
import { Screen, Header, Text, Button, Card, TextField, SegmentedControl, Switch } from '@/ui';
import { useLocationState } from './store';
import { beginJourney, isLocationHeadlessReady, retryDeletion, startSharing, stopSharing, syncGeofences } from './runtime';
import { age, distance, estimate, isLive, searchDestinations } from './geo';
import { useLocationData } from './useLocationData';
import { LocationMap } from './LocationMap';
import type { Destination, LocationPoint, SavedPlace, ShareMode } from './types';

const MODES = [{ value: 'hour', label: 'Live for 1 hour' }, { value: 'eight', label: '8 hours' }, { value: 'until-stop', label: 'Until I stop' }] as const;
export default function LocationScreen() {
  const { colors, spacing } = useTheme();
  const state = useLocationState();
  const data = useLocationData();
  const { data: profile } = useProfile();
  const { data: partner } = usePartner();
  const ownAvatar = useAvatar(profile?.avatar_path);
  const partnerAvatar = useAvatar(partner?.avatar_path);
  const [mode, setMode] = useState<ShareMode>('hour');
  const [guide, setGuide] = useState<'closed' | 'explanation' | 'background'>('closed');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Destination[]>([]);
  const [searched, setSearched] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [placeName, setPlaceName] = useState('Home');
  const [radius, setRadius] = useState('150');
  const [localBattery, setLocalBattery] = useState<string>('Unknown');
  const [simulate, setSimulate] = useState(false);
  const [simulation, setSimulation] = useState<LocationPoint[]>([]);
  const search = useRef<AbortController | null>(null);
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const updateBattery = async () => {
      const [level, charging] = await Promise.all([Battery.getBatteryLevelAsync(), Battery.getBatteryStateAsync()]);
      setLocalBattery(level < 0 ? 'Unknown' : `${Math.round(level * 100)}%${charging === Battery.BatteryState.CHARGING || charging === Battery.BatteryState.FULL ? ' · charging' : ''}`);
    };
    void updateBattery().catch(() => {});
    const level = Battery.addBatteryLevelListener(() => { void updateBattery().catch(() => {}); });
    const charging = Battery.addBatteryStateListener(() => { void updateBattery().catch(() => {}); });
    return () => { clearInterval(tick); level.remove(); charging.remove(); search.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!__DEV__ || !simulate || !data.visible) { setSimulation([]); return; }
    let step = 0;
    const update = () => {
      step++;
      // Synthetic coordinates never enter the task, storage, database, or push pipeline.
      const base = { couple_id: data.coupleId ?? '', accuracy: 40, speed: 2, heading: 90, battery_pct: 70, charging: false, updated_at: new Date().toISOString(), sharing_until: new Date(Date.now() + 60_000).toISOString() };
      setSimulation([{ ...base, user_id: data.uid ?? 'demo-self', lat: 12.97 + Math.sin(step / 10) * 0.003, lon: 77.59 + Math.cos(step / 10) * 0.003 }, { ...base, user_id: 'demo-partner', lat: 12.975, lon: 77.6 }]);
    };
    update(); const timer = setInterval(update, 2000);
    const app = AppState.addEventListener('change', state => { if (state !== 'active') setSimulate(false); });
    return () => { clearInterval(timer); app.remove(); };
  }, [simulate, data.visible, data.uid, data.coupleId]);
  async function run(action: () => Promise<unknown>) {
    setBusy(true); setError(null);
    try { await action(); await data.refresh(); } catch (problem) { setError(problem instanceof Error ? problem.message : 'This action could not finish. Try again online.'); } finally { setBusy(false); }
  }
  const points = simulate && __DEV__ ? simulation : data.visible && !data.offline ? (data.data?.points ?? []).filter(p => isLive(p.sharing_until, now) && (p.user_id !== data.uid || !!state.lease)) : [];
  const me = points.find(p => p.user_id === data.uid);
  const other = points.find(p => p.user_id !== data.uid);
  const places = data.data?.places ?? [];
  async function savePlace() {
    if (!destination || !data.uid || !data.coupleId) throw new Error('Choose a destination first.');
    const meters = Number(radius);
    if (!placeName.trim() || !Number.isInteger(meters) || meters < 100 || meters > 5000) throw new Error('Enter a place name and a radius from 100 to 5000 meters.');
    const { error: saveError } = await db.from('saved_places').insert({ user_id: data.uid, couple_id: data.coupleId, name: placeName.trim().slice(0, 80), lat: destination.lat, lon: destination.lon, radius_m: meters, notify_partner: false });
    if (saveError) throw new Error('The place could not be saved. Try again online.');
    setDestination(null);
  }
  async function changePlace(place: SavedPlace, remove = false) {
    if (!remove && !place.notify_partner && places.filter(p => p.notify_partner).length >= 20) throw new Error('At most 20 place alerts can be enabled. Turn another one off first.');
    const request = remove ? db.from('saved_places').delete() : db.from('saved_places').update({ notify_partner: !place.notify_partner });
    const { error: changeError } = await request.eq('id', place.id).eq('user_id', data.uid ?? '');
    if (changeError) throw new Error('The place could not be changed.');
    if (state.lease) await syncGeofences();
  }
  return <Screen bottomInset><Header title="A little closer" subtitle="Location stays off until you choose to share" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
    <Card style={{ gap: spacing.sm }}>
      <Text variant="title/M" color={state.lease ? 'primary' : 'textPrimary'}>{state.lease ? "You're sharing your location" : 'Your location is private · sharing is off'}</Text>
      <Text>{state.lease ? state.lease.until === 'infinity' ? 'Sharing until you stop. Your partner can see only your latest point.' : `Sharing ends ${new Date(state.lease.until).toLocaleTimeString()}. Your partner can see only your latest point.` : 'You each decide separately. Viewing your partner never turns on your own sharing.'}</Text>
      {state.lease ? <Button title="Pause / Stop sharing now" variant="danger" onPress={() => { void run(stopSharing); }} /> : <>
        <SegmentedControl options={MODES} value={mode} onChange={setMode} disabled={busy} />
        <Button title="Choose to share my location" disabled={!isLocationHeadlessReady() || !state.ready || !data.uid || !data.coupleId || busy || data.offline || state.pendingStop || simulate} onPress={() => setGuide('explanation')} />
      </>}
      <Text variant="caption">Your battery: {localBattery}</Text>
    </Card>
    {!isLocationHeadlessReady() && <Card><Text color="danger">Location setup needed: the shared Android entry must load the location headless module before Expo Router. Sharing stays off until background Stop registration is available. The map and developer preview remain available.</Text></Card>}
    {(error || state.error || data.isError) && <Card style={{ gap: spacing.sm }}><Text color="danger" accessibilityLiveRegion="polite">{error ?? state.error ?? 'Location data could not load. Check your connection and database setup.'}</Text><Button title={state.pendingStop ? 'Retry Stop and server deletion' : 'Retry sync'} variant="secondary" onPress={() => { void run(state.pendingStop ? retryDeletion : data.refresh); }} /></Card>}
    {data.offline && <Text color="danger">Offline. Live markers are hidden because consent cannot be checked. Stop works on this phone; server deletion needs a connection.</Text>}
    {guide !== 'closed' && <Card style={{ gap: spacing.md }}>
      <Text variant="title/M">{guide === 'explanation' ? 'Your choice, your location' : 'Allow all the time · Android guide'}</Text>
      <Text>{guide === 'explanation' ? 'Your partner will see your latest precise location, accuracy, movement speed, battery and charging state. Location sharing continues while the app is in the background. There is no server trail of past points. Saved places stay until you delete them. Journey destinations are temporary and removed when sharing ends. Place and battery alerts can reveal where you are or whether you are online. Each person opts in separately.' : 'Foreground permission is granted. Next, Android opens location settings. Choose “Allow all the time”, then return to Us. This allows the foreground service to keep your chosen sharing session working in the background. Keep notifications enabled so Stop is always visible.'}</Text>
      <Text>Live for 1 hour is the default. Pause/Stop deletes your latest server point and temporary journey when online. If offline, deletion retries after reconnecting; your partner may see the last point until expiry. “Until I stop” has no automatic expiry.</Text>
      <Button title={guide === 'explanation' ? 'Continue to foreground permission' : 'Open Android settings and enable sharing'} loading={busy} disabled={data.offline} onPress={() => { void run(async () => {
        if (guide === 'explanation') {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) throw new Error('Location remains off. Allow precise foreground location in Android Settings to continue.');
          setGuide('background');
        } else if (data.uid && data.coupleId) { await startSharing(data.uid, data.coupleId, mode); setGuide('closed'); }
      }); }} />
      <Button title="Not now · keep sharing off" variant="ghost" onPress={() => setGuide('closed')} />
      <Button title="Android app settings" variant="secondary" onPress={() => { void Linking.openSettings(); }} />
    </Card>}
    {data.isPending && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading location data" />}
    {__DEV__ && <Card style={{ gap: spacing.sm }}><Text variant="label">Developer preview · simulated movement</Text><Switch accessibilityLabel="Simulate movement locally without sharing" value={simulate} disabled={!!state.lease} onValueChange={setSimulate} />{simulate && <Text color="primary">SIMULATED · no points or notifications sent. Sharing is disabled in preview.</Text>}</Card>}
    {!points.length && !data.isPending && <Text color="textSecondary">No one is sharing right now. Your partner appears here only while their own sharing session is active.</Text>}
    <LocationMap points={points} uid={data.uid} ownAvatar={ownAvatar.data} partnerAvatar={partnerAvatar.data} partnerName={partner?.display_name ?? 'Your partner'} />
    {other && <Card style={{ gap: spacing.sm }}>
      <Text variant="title/M">{me ? estimate(distance(me, other), other.speed) : `${partner?.display_name ?? 'Your partner'} is sharing`}</Text>
      <Text variant="caption">Straight-line estimate, not a road route or traffic prediction.</Text>
      <Text>Partner updated {age(other, now)} · battery {other.battery_pct === null ? 'unknown' : `${other.battery_pct}%`}{other.charging ? ' · charging' : ''}</Text>
      {me && <Text>You updated {age(me, now)} · battery {me.battery_pct === null ? 'unknown' : `${me.battery_pct}%`}{me.charging ? ' · charging' : ''}</Text>}
    </Card>}
    {(data.data?.journeys ?? []).filter(j => j.status === 'active' && points.some(p => p.user_id === j.user_id)).map(journey => {
      const point = points.find(p => p.user_id === journey.user_id);
      return <Card key={journey.id} style={{ gap: spacing.sm }}><Text variant="title/M">{journey.user_id === data.uid ? 'You are' : 'Your partner is'} heading to {journey.dest_name}</Text><Text>{point ? estimate(distance(point, { lat: journey.dest_lat, lon: journey.dest_lon }), point.speed, 'left') : 'Waiting for a fresh point'}</Text><Text variant="caption">Straight-line progress estimate · arrival is detected within 150 m with accuracy ≤100 m.</Text>{journey.user_id === data.uid && <Button title="Cancel journey" variant="secondary" onPress={() => { void run(async () => { const { error: cancelError } = await db.from('journeys').delete().eq('id', journey.id).eq('user_id', data.uid ?? ''); if (cancelError) throw new Error('Journey could not be cancelled.'); }); }} />}</Card>;
    })}
    <Card style={{ gap: spacing.md }}>
      <Text variant="title/M">I’m heading home</Text>
      <Text>Pick a saved place or search a town/city with Open-Meteo. Search terms go to Open-Meteo; your live point is never sent to geocoding.</Text>
      <TextField label="Destination search" value={query} onChangeText={text => { search.current?.abort(); setQuery(text); setSearched(false); setResults([]); }} />
      <Button title="Search destinations" loading={busy} disabled={data.offline || query.trim().length < 2} variant="secondary" onPress={() => { void run(async () => { search.current?.abort(); const controller = new AbortController(); search.current = controller; const found = await searchDestinations(query, controller.signal); if (!controller.signal.aborted) { setResults(found); setSearched(true); } }); }} />
      {searched && !results.length && <Text>No matching towns or cities. Try another name or use a saved place.</Text>}
      {results.map((result, index) => <Button key={`${result.lat}:${result.lon}:${index}`} title={result.name} variant="secondary" onPress={() => { setDestination(result); setPlaceName(result.name.slice(0, 80)); }} />)}
      {me && !simulate && <Button title="Use my latest point as a saved place" variant="secondary" onPress={() => { setDestination({ name: 'Home', lat: me.lat, lon: me.lon }); setPlaceName('Home'); }} />}
      {destination && <>
        <Text variant="label">Selected: {destination.name}</Text>
        <Button title={`Start journey to ${destination.name}`} disabled={!state.lease || data.offline || simulate} loading={busy} onPress={() => { void run(async () => { await beginJourney(destination); setDestination(null); }); }} />
        <TextField label="Save as Home, Work or a custom name" value={placeName} onChangeText={setPlaceName} maxLength={80} />
        <TextField label="Alert radius in meters (100–5000)" value={radius} onChangeText={setRadius} keyboardType="number-pad" />
        <Button title="Save place · alerts off" variant="secondary" disabled={data.offline || simulate} loading={busy} onPress={() => { void run(savePlace); }} />
      </>}
    </Card>
    <Card style={{ gap: spacing.md }}>
      <Text variant="title/M">Your saved places</Text>
      <Text>Place alerts are off by default and only run while you share. Your partner receives the place name on arrival or departure. Up to 20 enabled places; saved coordinates are private to you.</Text>
      {!places.length && <Text color="textSecondary">No places saved. Search above or save your current shared point.</Text>}
      {places.map(place => <View key={place.id} style={{ gap: spacing.sm }}>
        <Button title={`${place.name} · ${place.radius_m} m`} variant="secondary" onPress={() => { setDestination({ name: place.name, lat: place.lat, lon: place.lon }); setPlaceName(place.name); }} />
        <Text variant="caption">Partner arrival/leave alerts: {place.notify_partner ? 'on during sharing' : 'off'}</Text>
        <Switch accessibilityLabel={`Notify partner when arriving at or leaving ${place.name}`} value={place.notify_partner} disabled={busy || data.offline || simulate} onValueChange={() => { void run(() => changePlace(place)); }} />
        <Button title={`Delete ${place.name}`} variant="ghost" disabled={busy || data.offline || simulate} onPress={() => { void run(() => changePlace(place, true)); }} />
      </View>)}
    </Card>
    <Card style={{ gap: spacing.sm }}><Text variant="title/M">Keep Android sharing reliable</Text><Text>Optional battery settings: Xiaomi/Redmi: allow Background autostart and No restrictions. Oppo/Realme: allow background activity and auto launch. Vivo: enable Autostart and high background power use. OnePlus: allow background activity and disable app battery optimization. Samsung: add Us to Never sleeping apps. Menu names vary by Android version; only change these settings if you want background sharing.</Text><Text>Force-stop or a reboot can interrupt updates. Open Us after reboot to resume an unexpired opted-in session. Android does not guarantee automatic restart.</Text><Button title="Open Android settings" variant="secondary" onPress={() => { void Linking.openSettings(); }} /></Card>
  </ScrollView></Screen>;
}
