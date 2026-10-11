import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';
import type { ProfileRow } from '@/types/db';

export async function uploadAvatar(profile: ProfileRow): Promise<string | null> {
  if (!profile.couple_id) throw new Error('Missing couple');
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Photo permission denied');
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let file: File | undefined;
  try {
    if (asset.width > 512 || asset.height > 512) context.resize(asset.width >= asset.height ? { width: 512 } : { height: 512 });
    rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    file = new File(result.uri);
    const bytes = await file.arrayBuffer();
    const path = `${profile.couple_id}/avatars/${profile.id}.jpg`;
    const { error } = await supabase.storage.from('media').upload(path, bytes, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' });
    if (error) throw error;
    const { error: profileError } = await supabase.from('profiles').update({ avatar_path: path }).eq('id', profile.id).select('id').single();
    if (profileError) throw profileError;
    return path;
  } finally {
    rendered?.release();
    context.release();
    if (file?.exists) file.delete();
  }
}

export function validAnniversary(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
