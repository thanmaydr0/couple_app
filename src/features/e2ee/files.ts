import * as FS from 'expo-file-system/legacy';
import { supabase } from '@/lib/supabase';
import { b64, bytes, open, seal, type Sealed } from './crypto';
import { random, snapshot } from './runtime';
export type FileSecret = { key: string; nonce: string; path: string; mime: 'image/jpeg' | 'audio/mp4' };
const secrets = new Map<string, FileSecret>();
export function rememberFile(file: FileSecret) { secrets.set(file.path, file); }
export function clearFiles() { secrets.clear(); }
export async function encryptFile(uri: string, path: string, mime: FileSecret['mime']) {
  const info = await FS.getInfoAsync(uri);
  if (!info.exists || info.size > 5 * 1024 * 1024) throw new Error('Encrypted attachment must be at most 5 MB');
  const key = random(32);
  try {
    const source = bytes(await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 }));
    const result = seal(source, key, random); source.fill(0);
    return { ciphertext: bytes(result.ciphertext), file: { path, key: b64(key), nonce: result.nonce, mime } satisfies FileSecret };
  } finally { key.fill(0); }
}
// Plaintext temporary media stays in the app sandbox and is removed on background.
export async function decryptedFile(path: string, bucket: string, signedUrl?: string): Promise<string> {
  const file = secrets.get(path);
  if (!file) throw new Error('Read and decrypt this message before opening its attachment');
  if (!path.startsWith(`${snapshot().couple}/`)) throw new Error('Attachment outside this couple');
  let encrypted: Uint8Array;
  if (signedUrl) {
    const response = await fetch(signedUrl);
    if (!response.ok) throw new Error('Attachment unavailable');
    encrypted = new Uint8Array(await response.arrayBuffer());
  } else {
    const result = await supabase.storage.from(bucket).download(path);
    if (result.error) throw result.error;
    // RN Blob.arrayBuffer is not consistently available. FileReader works on Android.
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
      reader.onerror = () => reject(new Error('Attachment could not be read')); reader.readAsDataURL(result.data);
    });
    encrypted = bytes(base64);
  }
  const key = bytes(file.key);
  let clear: Uint8Array;
  try { clear = open({ nonce: file.nonce, ciphertext: b64(encrypted) } satisfies Sealed, key); } finally { key.fill(0); }
  const folder = `${FS.cacheDirectory}e2ee/`;
  await FS.makeDirectoryAsync(folder, { intermediates: true });
  const uri = `${folder}${b64(random(18)).replace(/[+/=]/g, '_')}.${file.mime === 'audio/mp4' ? 'm4a' : 'jpg'}`;
  try { await FS.writeAsStringAsync(uri, b64(clear), { encoding: FS.EncodingType.Base64 }); } finally { clear.fill(0); }
  return uri;
}
export async function purgeDecryptedFiles() {
  if (FS.cacheDirectory) await FS.deleteAsync(`${FS.cacheDirectory}e2ee/`, { idempotent: true }).catch(() => {});
}
