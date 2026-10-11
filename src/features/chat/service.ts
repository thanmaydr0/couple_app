import AsyncStorage from '@react-native-async-storage/async-storage';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { MessageRow } from '@/types/db';
import { asSent, cacheWindow, isMessage, type ChatMessage } from './model';

export const PAGE_SIZE = 50;
const cacheKey = (couple: string, uid: string) => `chat:v1:${couple}:${uid}`;
const writes = new Map<string, Promise<void>>();
type SignedPhoto = { path: string; url: string };
const photoKey = (couple: string, uid: string) => `chat-photos:v1:${couple}:${uid}`;

async function photoCache(couple: string, uid: string): Promise<SignedPhoto[]> {
  try {
    const raw = await AsyncStorage.getItem(photoKey(couple, uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value: unknown): value is SignedPhoto => !!value && typeof value === 'object'
      && 'path' in value && typeof value.path === 'string' && 'url' in value && typeof value.url === 'string');
  } catch { return []; }
}

// Stable expo-image cache keys allow already downloaded photos to render even
// when their saved signed URL has expired and the device is offline.
export async function cachedPhotoUrl(couple: string, uid: string, path: string): Promise<string | undefined> {
  return (await photoCache(couple, uid)).find((photo) => photo.path === path)?.url;
}

export function savePhotoUrl(couple: string, uid: string, path: string, url: string): Promise<void> {
  const key = photoKey(couple, uid);
  const next = (writes.get(key) ?? Promise.resolve()).then(async () => {
    const previous = await photoCache(couple, uid);
    await AsyncStorage.setItem(key, JSON.stringify([{ path, url }, ...previous.filter((photo) => photo.path !== path)].slice(0, 200)));
  }).catch(() => undefined);
  writes.set(key, next);
  void next.then(() => { if (writes.get(key) === next) writes.delete(key); });
  return next;
}

export async function loadCache(couple: string, uid: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(couple, uid));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMessage).filter((row) => row.couple_id === couple).map((row) => ({
      ...row, status: row.status === 'sent' ? 'sent' : 'failed',
    }));
  } catch { return []; }
}

export function persistCache(couple: string, uid: string, messages: ChatMessage[]): Promise<void> {
  const key = cacheKey(couple, uid);
  const payload = JSON.stringify(cacheWindow(messages));
  const next = (writes.get(key) ?? Promise.resolve()).then(() => AsyncStorage.setItem(key, payload)).catch(() => undefined);
  writes.set(key, next);
  void next.then(() => { if (writes.get(key) === next) writes.delete(key); });
  return next;
}

export async function history(couple: string, before?: MessageRow): Promise<MessageRow[]> {
  let query = supabase.from('messages').select('*').eq('couple_id', couple)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function newer(couple: string, after: MessageRow): Promise<MessageRow[]> {
  const { data, error } = await supabase.from('messages').select('*').eq('couple_id', couple)
    .or(`created_at.gt.${after.created_at},and(created_at.eq.${after.created_at},id.gt.${after.id})`)
    .order('created_at').order('id').limit(PAGE_SIZE);
  if (error) throw error;
  return data;
}

export async function pickChatImage(couple: string, uid: string): Promise<{ uri: string; path: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Allow photo access in Android settings to send a photo.');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false });
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) return null;
  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > 1600) {
    context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
  }
  const rendered = await context.renderAsync();
  const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  context.release();
  rendered.release();
  if (!FileSystem.documentDirectory) throw new Error('Photo storage is unavailable.');
  const folder = `${FileSystem.documentDirectory}chat-outbox/${couple}/${uid}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const id = randomUUID();
  const uri = `${folder}${id}.jpg`;
  await FileSystem.copyAsync({ from: image.uri, to: uri });
  return { uri, path: `${couple}/chat/${id}.jpg` };
}

export async function notifyPartnerOfMessage(message: MessageRow): Promise<void> {
  try {
    await supabase.functions.invoke('notify-partner', { body: {
      type: 'message', title: 'A message for you',
      body: message.kind === 'image' ? 'Sent you a photo' : (message.body ?? '').slice(0, 180),
      data: { message_id: message.id, couple_id: message.couple_id, url: '/(tabs)/chat' },
    } });
  } catch { /* Push must never turn a successful send into a failed bubble. */ }
}

export async function sendMessage(message: ChatMessage): Promise<ChatMessage> {
  // Recover an ambiguous timeout before uploading/inserting again.
  const lookup = await supabase.from('messages').select('*').eq('couple_id', message.couple_id)
    .eq('client_id', message.client_id).maybeSingle();
  if (lookup.error) throw lookup.error;
  if (lookup.data) return asSent(lookup.data);
  if (message.kind === 'image') {
    if (!message.localUri || !message.media_path) throw new Error('Photo is unavailable. Please choose it again.');
    const base64 = await FileSystem.readAsStringAsync(message.localUri, { encoding: FileSystem.EncodingType.Base64 });
    const upload = await supabase.storage.from('media').upload(message.media_path, decode(base64), { contentType: 'image/jpeg', upsert: true });
    if (upload.error) throw upload.error;
  }
  const { data, error } = await supabase.from('messages').insert({
    id: message.id, client_id: message.client_id, couple_id: message.couple_id, sender_id: message.sender_id,
    kind: message.kind, body: message.body, media_path: message.media_path, reply_to: message.reply_to,
  }).select('*').single();
  if (error) {
    if (error.code === '23505') {
      const existing = await supabase.from('messages').select('*').eq('couple_id', message.couple_id).eq('client_id', message.client_id).single();
      if (existing.data) return asSent(existing.data);
    }
    throw error;
  }
  void notifyPartnerOfMessage(data);
  return asSent(data);
}

export async function cleanOutbox(couple: string, uid: string, messages: ChatMessage[]): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  const folder = `${FileSystem.documentDirectory}chat-outbox/${couple}/${uid}/`;
  try {
    const keep = new Set(messages.filter((m) => m.status !== 'sent').map((m) => m.localUri));
    const files = await FileSystem.readDirectoryAsync(folder);
    await Promise.all(files.filter((name) => !keep.has(`${folder}${name}`)).map((name) => FileSystem.deleteAsync(`${folder}${name}`, { idempotent: true })));
  } catch { /* Missing directory or temporary filesystem failure. */ }
}
