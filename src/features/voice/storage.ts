import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { voiceLimits, type VoiceRecording } from './types';

export async function persistVoice(recording: VoiceRecording, couple: string, uid: string, scope: 'chat' | 'capsule' = 'chat') {
  if (!FileSystem.documentDirectory) throw new Error('Recording storage is unavailable.');
  const folder = `${FileSystem.documentDirectory}${scope}-outbox/${couple}/${uid}/`;
  await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
  const id = randomUUID(); const uri = `${folder}${id}.m4a`;
  await FileSystem.copyAsync({ from: recording.uri, to: uri });
  return { uri, path: `${couple}/chat/voice/${id}.m4a`, meta: recording.meta };
}
export async function uploadVoice(bucket: 'media' | 'capsules', path: string, uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || info.size > voiceLimits.maxBytes) throw new Error('Voice file is missing or exceeds 3 MB. Record it again.');
  const bytes = decode(await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }));
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: 'audio/mp4', upsert: true, cacheControl: '0' });
  if (error) throw error;
}
