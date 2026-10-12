import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import { createVideoPlayer } from 'expo-video';
import type { MovieFile } from './model';

const key = (user: string, session: string) => `movie:v1:${user}:${session}`;
export async function saveFile(user: string, session: string, file: MovieFile) {
  await AsyncStorage.setItem(`${key(user, session)}:file`, JSON.stringify(file));
}
export async function rememberedFile(user: string, session: string): Promise<MovieFile | null> {
  const raw = await AsyncStorage.getItem(`${key(user, session)}:file`);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const f = value as Partial<MovieFile>;
    if (typeof f.uri !== 'string' || typeof f.name !== 'string' || typeof f.size !== 'number') return null;
    // URI grants and cache files may expire. Never assume a remembered URI works.
    return { uri: f.uri, name: f.name, size: f.size, durationMs: await probe(f.uri) };
  } catch { return null; }
}
export async function loadPosition(user: string, session: string) {
  const raw = await AsyncStorage.getItem(`${key(user, session)}:position`);
  const pos = Number(raw);
  return Number.isFinite(pos) && pos >= 0 ? pos : 0;
}
export function savePosition(user: string, session: string, pos: number) {
  return AsyncStorage.setItem(`${key(user, session)}:position`, String(Math.max(0, pos)));
}
async function probe(uri: string): Promise<number> {
  const player = createVideoPlayer(null);
  let cleanup = () => {};
  try {
    const metadata = new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Could not read video metadata within 20 seconds. Choose a playable local file.')), 20000);
      const loaded = player.addListener('sourceLoad', ({ duration, availableVideoTracks }) => {
        if (Number.isFinite(duration) && duration > 0 && availableVideoTracks.length > 0) resolve(Math.round(duration * 1000));
        else reject(new Error('This file has no playable video or duration. DRM videos are not supported.'));
      });
      const status = player.addListener('statusChange', ({ status, error }) => {
        if (status === 'error') reject(new Error(error?.message ?? 'This video format cannot be played.'));
      });
      cleanup = () => { clearTimeout(timer); loaded.remove(); status.remove(); };
    });
    // Attach rejection handling before loading: native sourceLoad can fire immediately.
    const result = Promise.all([metadata, player.replaceAsync({ uri })]);
    return (await result)[0];
  } finally { cleanup(); player.release(); }
}
export async function pickMovie(): Promise<MovieFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'video/*', multiple: false, copyToCacheDirectory: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (!/^(file|content):\/\//.test(asset.uri)) throw new Error('Choose a file stored on this phone. Remote video URLs are not supported.');
  let uri = asset.uri;
  let durationMs: number;
  try { durationMs = await probe(uri); }
  catch (original) {
    // Most Android content providers play directly. Only copy on a playback failure.
    if (!uri.startsWith('content://') || !FS.cacheDirectory) throw original;
    const extension = asset.name.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] ?? '.video';
    const target = `${FS.cacheDirectory}watch-${Date.now()}${extension}`;
    try { await FS.copyAsync({ from: uri, to: target }); uri = target; durationMs = await probe(uri); }
    catch { throw new Error('Cannot play or copy this file. Check free storage, download it onto this phone, and choose an unprotected MP4.'); }
  }
  let size = asset.size;
  if (size === undefined) {
    const info = await FS.getInfoAsync(uri);
    if (info.exists && !info.isDirectory) size = info.size;
  }
  if (size === undefined || !Number.isSafeInteger(size) || size <= 0) throw new Error('The file provider did not report a valid byte size. Choose a downloaded local file.');
  return { uri, name: asset.name, size, durationMs };
}
