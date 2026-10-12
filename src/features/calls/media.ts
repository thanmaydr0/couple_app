import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { CallKind } from '@/types/db';

export type IceServer = { urls: string | string[]; username?: string; credential?: string };
let cached: { owner: string; until: number; servers: IceServer[] } | undefined;
export function clearIceCache() { cached = undefined; }
export async function iceServers(owner: string): Promise<IceServer[]> {
  if (cached?.owner === owner && cached.until > Date.now()) return cached.servers;
  const fallback = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
  try {
    const { data, error } = await supabase.functions.invoke<unknown>('turn-credentials', {
      body: {}, signal: AbortSignal.timeout(10_000),
    });
    if (error) throw error;
    const raw: unknown = Array.isArray(data) ? data : (data && typeof data === 'object' && 'iceServers' in data ? data.iceServers : null);
    if (!Array.isArray(raw) || !raw.length) throw new Error('Invalid ICE response');
    const servers: IceServer[] = raw.map((entry: unknown) => {
      if (!entry || typeof entry !== 'object' || !('urls' in entry)) throw new Error('Invalid ICE server');
      const urls = entry.urls;
      if (!(typeof urls === 'string' || (Array.isArray(urls) && urls.length && urls.every((u: unknown) => typeof u === 'string')))) throw new Error('Invalid ICE URL');
      const server: IceServer = { urls };
      if ('username' in entry && typeof entry.username === 'string') server.username = entry.username;
      if ('credential' in entry && typeof entry.credential === 'string') server.credential = entry.credential;
      return server;
    });
    cached = { owner, until: Date.now() + 60_000, servers };
    return servers;
  } catch {
    console.warn('[calls] TURN unavailable; using public STUN. Some networks may not connect.');
    return fallback;
  }
}

export async function requestCallPermissions(kind: CallKind): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  const needed = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (kind === 'video') needed.push(PermissionsAndroid.PERMISSIONS.CAMERA);
  for (const permission of needed) {
    if (await PermissionsAndroid.check(permission)) continue;
    const result = await PermissionsAndroid.request(permission, {
      title: permission === PermissionsAndroid.PERMISSIONS.CAMERA ? 'See each other' : 'Hear each other',
      message: permission === PermissionsAndroid.PERMISSIONS.CAMERA
        ? 'Allow the camera to share your video with your partner. It is only used after you start or accept a video call.'
        : 'Allow the microphone so your partner can hear you during this call.',
      buttonPositive: 'Continue', buttonNegative: 'Not now',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      Alert.alert('Permission needed', result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'Calling permission is blocked. Open Settings → Permissions to enable it, then try again.'
        : 'This call needs permission. You can try again when you are ready.', [
        { text: 'OK', style: 'cancel' },
        ...(result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? [{ text: 'Open settings', onPress: () => { void Linking.openSettings(); } }] : []),
      ]);
      return false;
    }
  }
  return true;
}
