import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as FS from 'expo-file-system/legacy';
import { Image as Compressor } from 'react-native-compressor';
import { decode } from 'base64-arraybuffer';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { themes } from '@/theme/tokens';
import type { MediaRow } from '@/types/db';
import type { Doodle, WidgetState } from './types';

export const widgetDb = supabase as unknown as SupabaseClient;
const KEY = 'us-widgets-v1';
const DIRECTORY = `${FS.documentDirectory}widgets/`;
export const limits = { heartbeat: 10_000, send: 30_000, day: 86_400_000, image: 360, bytes: 350_000 };
export const initialState: WidgetState = { owner: '', couple: '', colors: themes.Midnight, enabled: false, mode: 'random', favorites: [], partner: 'Your partner', status: '', days: null, countdown: '' };
export async function readState(): Promise<WidgetState> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? { ...initialState, ...JSON.parse(raw) as WidgetState } : { ...initialState };
}
export async function writeState(state: WidgetState) { await AsyncStorage.setItem(KEY, JSON.stringify(state)); }
export async function identity() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to refresh widgets.');
  const { data: profile, error: failure } = await supabase.from('profiles').select('couple_id').eq('id', data.user.id).single();
  if (failure || !profile?.couple_id) throw new Error('Link your couple to use widgets.');
  return { owner: data.user.id, couple: profile.couple_id };
}
export function choosePhoto(rows: MediaRow[], state: WidgetState, date = new Date()): MediaRow | undefined {
  const candidates = state.mode === 'favorites' ? rows.filter(row => state.favorites.includes(row.id)) : rows;
  if (state.mode === 'latest') return candidates[0];
  const seed = `${state.couple}:${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return candidates[hash % candidates.length];
}
async function cacheImage(bucket: string, path: string, slot: string): Promise<string> {
  await FS.makeDirectoryAsync(DIRECTORY, { intermediates: true });
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error) throw error;
  const source = `${DIRECTORY}${slot}-download`;
  try {
    const task = FS.createDownloadResumable(data.signedUrl, source);
    const timer = setTimeout(() => { void task.cancelAsync().catch(() => {}); }, 8000);
    let download: FS.FileSystemDownloadResult | undefined;
    try { download = await task.downloadAsync(); } finally { clearTimeout(timer); }
    if (download?.status !== 200) throw new Error('Widget image download failed.');
    const compressed = await Compressor.compress(source, { compressionMethod: 'manual', maxWidth: limits.image, maxHeight: limits.image, quality: 0.65, output: 'jpg' });
    const info = await FS.getInfoAsync(compressed);
    if (!info.exists || info.size > limits.bytes) throw new Error('Widget image is too large.');
    const destination = `${DIRECTORY}${slot}.jpg`;
    await FS.copyAsync({ from: compressed, to: destination });
    if (compressed !== source && compressed.startsWith('file:')) await FS.deleteAsync(compressed, { idempotent: true });
    return destination;
  } finally { await FS.deleteAsync(source, { idempotent: true }); }
}
export async function imageData(file?: string): Promise<`data:image${string}` | undefined> {
  if (!file || !file.startsWith(DIRECTORY)) return undefined;
  const info = await FS.getInfoAsync(file);
  if (!info.exists || info.size > limits.bytes) return undefined;
  return `data:image/jpeg;base64,${await FS.readAsStringAsync(file, { encoding: FS.EncodingType.Base64 })}`;
}
export async function clearWidgets() {
  await writeState({ ...initialState });
  await FS.deleteAsync(DIRECTORY, { idempotent: true });
}
function optionalError(error: { code?: string } | null) { return error && !['42P01', 'PGRST205'].includes(error.code ?? ''); }
let refreshTask: Promise<WidgetState> | undefined;
export function refreshData(): Promise<WidgetState> {
  if (refreshTask) return refreshTask;
  refreshTask = fetchData().finally(() => { refreshTask = undefined; });
  return refreshTask;
}
async function fetchData(): Promise<WidgetState> {
  let state = await readState();
  if (!state.enabled) return state;
  try {
    const who = await identity();
    if (state.owner !== who.owner || state.couple !== who.couple) { await clearWidgets(); return readState(); }
    const signal = AbortSignal.timeout(8000);
    const [couple, partner, status, countdown, doodle] = await Promise.all([
      supabase.from('couples').select('anniversary').eq('id', who.couple).abortSignal(signal).single(),
      supabase.from('profiles').select('display_name').eq('couple_id', who.couple).neq('id', who.owner).abortSignal(signal).maybeSingle(),
      widgetDb.from('pulse_status').select('mood,availability').eq('couple_id', who.couple).neq('user_id', who.owner).abortSignal(signal).maybeSingle(),
      widgetDb.from('countdowns').select('title,target_at,emoji').eq('couple_id', who.couple).gte('target_at', new Date().toISOString()).order('target_at').limit(1).abortSignal(signal).maybeSingle(),
      widgetDb.from('doodles').select('*').eq('couple_id', who.couple).neq('author_id', who.owner).order('created_at', { ascending: false }).limit(1).abortSignal(signal).maybeSingle(),
    ]);
    for (const result of [couple, partner, doodle]) if (result.error) throw result.error;
    if (optionalError(status.error)) throw status.error;
    if (optionalError(countdown.error)) throw countdown.error;
    const rows: MediaRow[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await supabase.from('media').select('*').eq('couple_id', who.couple).eq('kind', 'photo').order('created_at', { ascending: false }).order('id').range(offset, offset + 499).abortSignal(signal);
      if (result.error) throw result.error;
      rows.push(...result.data);
      if (result.data.length < 500) break;
    }
    const photo = choosePhoto(rows, state);
    const latest = doodle.data as Doodle | null;
    const emoji: Record<string, string> = { joyful: '😊', calm: '😌', loved: '🥰', hopeful: '🌱', tired: '😴', anxious: '🫨', sad: '🌧️', overwhelmed: '🫂', free: '💚', busy: '⏳', sleeping: '💤', driving: '🚗', studying: '📚', working: '💼' };
    const photoFile = photo ? photo.id === state.photo?.id && state.photoFile && (await FS.getInfoAsync(state.photoFile)).exists ? state.photoFile : await cacheImage('media', photo.thumb_path ?? photo.storage_path, `${who.owner}-${who.couple}-photo-${photo.id}`) : undefined;
    const doodleFile = latest ? latest.id === state.doodle?.id && state.doodleFile && (await FS.getInfoAsync(state.doodleFile)).exists ? state.doodleFile : await cacheImage('doodles', latest.image_path, `${who.owner}-${who.couple}-doodle-${latest.id}`) : undefined;
    const preferences = await readState();
    if (!preferences.enabled || preferences.owner !== who.owner || preferences.couple !== who.couple) {
      for (const file of [photoFile, doodleFile]) if (file?.startsWith(DIRECTORY)) await FS.deleteAsync(file, { idempotent: true });
      return preferences;
    }
    state = { ...preferences, partner: partner.data?.display_name ?? 'Your partner',
      days: couple.data?.anniversary ? Math.max(0, Math.floor((Date.now() - new Date(couple.data.anniversary).getTime()) / limits.day)) : null,
      status: status.data ? `${emoji[String(status.data.mood)] ?? ''} ${emoji[String(status.data.availability)] ?? ''} ${status.data.availability}` : '',
      countdown: countdown.data ? `${countdown.data.emoji} ${countdown.data.title} · ${Math.ceil((new Date(countdown.data.target_at).getTime() - Date.now()) / limits.day)} days` : '',
      photo, photoFile, doodle: latest ?? undefined, doodleFile, updatedAt: Date.now(), error: undefined };
    await writeState(state);
    // Keep only the current photo and partner doodle in the widget cache.
    await FS.makeDirectoryAsync(DIRECTORY, { intermediates: true });
    for (const name of await FS.readDirectoryAsync(DIRECTORY)) {
      const file = `${DIRECTORY}${name}`;
      if (file !== photoFile && file !== doodleFile) await FS.deleteAsync(file, { idempotent: true });
    }
  } catch {
    state = await readState();
    state = { ...state, error: 'Refresh failed. Check your connection and sign-in; saved content may be out of date.' };
    await writeState(state);
  }
  return state;
}
let sending = false;
export async function sendDoodle(png: string) {
  if (sending) throw new Error('A doodle is already sending.');
  sending = true;
  try {
    const who = await identity();
    const key = `widget-doodle:${who.owner}`;
    if (Date.now() - Number(await AsyncStorage.getItem(key)) < limits.send) throw new Error('Wait a moment before sending another doodle.');
    const bytes = decode(png);
    if (bytes.byteLength > 1_000_000) throw new Error('Doodle is too large. Clear some strokes and try again.');
    const path = `${who.couple}/${who.owner}/${randomUUID()}.png`;
    const uploaded = await supabase.storage.from('doodles').upload(path, bytes, { contentType: 'image/png' });
    if (uploaded.error) throw uploaded.error;
    const { data, error } = await widgetDb.from('doodles').insert({ couple_id: who.couple, author_id: who.owner, image_path: path }).select('id').single();
    if (error) { await supabase.storage.from('doodles').remove([path]); throw error; }
    await AsyncStorage.setItem(key, String(Date.now()));
    const push = await supabase.functions.invoke('widget-push', { body: { doodleId: String(data.id) } });
    return push.error ? 'Doodle saved. Push refresh failed; your partner can refresh in the app.' : 'Doodle sent. Delivery depends on Android background permissions.';
  } finally { sending = false; }
}
let beating = false;
export async function sendWidgetHeartbeat(): Promise<string> {
  if (beating) return 'Wait a moment';
  beating = true;
  try {
    const who = await identity();
    const key = `widget-heart:${who.owner}`;
    if (Date.now() - Number(await AsyncStorage.getItem(key)) < limits.heartbeat) return 'Wait a moment';
    await AsyncStorage.setItem(key, String(Date.now()));
    // Pulse's exported sender requires active AppState; the RPC supports headless clicks.
    const result = await widgetDb.rpc('widget_heartbeat');
    if (result.error) throw result.error;
    if (!result.data) return 'Wait a moment';
    const push = await supabase.functions.invoke('notify-partner', { body: { channel: 'pulse', title: 'Thinking of you ♥', body: 'A heartbeat from your partner', data: { route: '/us/pulse' } } });
    return push.error ? 'Saved · push failed' : 'Sent ♥';
  } finally { beating = false; }
}
