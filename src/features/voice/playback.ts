import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCalls } from '@/features/calls/engine';
import type { VoiceMeta } from './types';
import { decryptedFile } from '@/features/e2ee/files';

export type VoiceTrack = { id: string; path?: string | null; uri?: string; bucket?: 'media' | 'capsules'; couple?: string; receiver?: boolean; meta?: VoiceMeta | null; encrypted?: boolean };
type Playback = { id: string | null; playing: boolean; loading: boolean; position: number; duration: number; speed: number; error: string | null };
let state: Playback = { id: null, playing: false, loading: false, position: 0, duration: 0, speed: 1, error: null };
let player: AudioPlayer | undefined; let listener: { remove(): void } | undefined;
let generation = 0; let queue: VoiceTrack[] = []; let recording = false;
const subscribers = new Set<() => void>(); const heard = new Set<string>();
const voiceDb = supabase as unknown as SupabaseClient;
let focusUsers = 0; let releaseFocus: (() => void) | undefined;
let requestedSeek: { id: string; fraction: number } | undefined; let seeking = false;
const publish = (patch: Partial<Playback>) => { state = { ...state, ...patch }; subscribers.forEach(fn => fn()); };
export const playbackSnapshot = () => state;
export function subscribePlayback(fn: () => void) { subscribers.add(fn); return () => { subscribers.delete(fn); }; }
export function setVoiceQueue(tracks: VoiceTrack[]) { queue = tracks; }
export function pauseVoice() { generation++; player?.pause(); publish({ playing: false, loading: false }); }
export function claimRecording(active: boolean) { recording = active; if (active) pauseVoice(); }
export function watchAudioFocus() {
  if (focusUsers++ === 0) {
    const app = AppState.addEventListener('change', value => { if (value !== 'active') pauseVoice(); });
    const calls = useCalls.subscribe(value => { if (value.phase !== 'idle') pauseVoice(); });
    releaseFocus = () => { app.remove(); calls(); pauseVoice(); listener?.remove(); player?.remove(); player = undefined; publish({ id: null }); };
  }
  return () => { if (--focusUsers === 0) releaseFocus?.(); };
}
export function voiceSpeed() { const speed = state.speed === 1 ? 1.5 : state.speed === 1.5 ? 2 : 1; player?.setPlaybackRate(speed); publish({ speed }); }
export async function seekVoice(id: string, fraction: number) {
  requestedSeek = { id, fraction: Math.min(1, Math.max(0, fraction)) };
  if (state.id !== id || !player || !state.duration || seeking) return;
  seeking = true;
  try {
    while (requestedSeek?.id === state.id && player && state.duration) {
      const target = requestedSeek; requestedSeek = undefined;
      await player.seekTo(target.fraction * state.duration);
    }
  } finally { seeking = false; }
}
export async function playVoice(track: VoiceTrack) {
  if (recording || AppState.currentState !== 'active' || useCalls.getState().phase !== 'idle') return;
  if (state.id === track.id && player && !state.error && !state.loading) {
    if (state.playing) { pauseVoice(); return; }
    if (state.duration && state.position >= state.duration) await player.seekTo(0);
    player.play(); publish({ playing: true }); return;
  }
  const token = ++generation;
  listener?.remove(); player?.remove(); player = undefined;
  publish({ id: track.id, loading: true, playing: false, position: 0, duration: (track.meta?.duration_ms ?? 0) / 1000, error: null });
  try {
    await setAudioModeAsync({ interruptionMode: 'doNotMix', allowsRecording: false, shouldPlayInBackground: false, shouldRouteThroughEarpiece: false });
    let uri = track.uri;
    if (!uri && track.path) {
      if (track.encrypted) uri = await decryptedFile(track.path, track.bucket ?? 'media');
      else {
        const result = await supabase.storage.from(track.bucket ?? 'media').createSignedUrl(track.path, 600);
        if (result.error) throw result.error; uri = result.data.signedUrl;
      }
    }
    if (!uri) throw new Error('Voice file unavailable.');
    if (token !== generation) return;
    player = createAudioPlayer({ uri }); player.setPlaybackRate(state.speed);
    listener = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
      if (status.error) { publish({ error: 'Voice unavailable. Reconnect and tap Retry.', loading: false, playing: false }); return; }
      publish({ loading: !status.isLoaded || status.isBuffering, playing: status.playing, position: status.currentTime, duration: status.duration || state.duration });
      if (status.isLoaded && requestedSeek?.id === track.id) void seekVoice(track.id, requestedSeek.fraction).catch(() => undefined);
      if (!track.encrypted && status.playing && status.currentTime > 0 && track.receiver && track.couple && !heard.has(track.id)) {
        heard.add(track.id);
        void voiceDb.rpc('voice_mark_played', { message_id: track.id }).then(({ error }) => { if (error) heard.delete(track.id); });
      }
      if (status.didJustFinish) {
        const next = queue[queue.findIndex(item => item.id === track.id) + 1];
        if (queue.some(item => item.id === track.id) && next?.path && AppState.currentState === 'active') void playVoice(next);
      }
    });
    player.play();
  } catch { if (token === generation) publish({ error: 'Voice unavailable. Reconnect and tap Retry.', loading: false, playing: false }); }
}
