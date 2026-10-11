import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FS from 'expo-file-system/legacy';
import * as Picker from 'expo-image-picker';
import * as Library from 'expo-media-library/legacy';
import * as Manipulator from 'expo-image-manipulator';
import * as Thumbnails from 'expo-video-thumbnails';
import { Video } from 'react-native-compressor';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { MediaRow } from '@/types/db';

export const MB = 1024 * 1024;
const LIMIT = 50 * MB;
export const message = (e: unknown) => e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'message' in e ? String(e.message) : String(e);
export type Job = { id: string; asset: Picker.ImagePickerAsset; status: 'waiting' | 'preparing' | 'uploading' | 'done' | 'failed' | 'skipped'; progress: number; error?: string };
type Local = Record<string, { uri: string; thumb?: string; bytes: number }>;
type Snapshot = { rows: MediaRow[]; local: Local; jobs: Job[]; loading: boolean; error: string; downloading: string; free: number };
const stores = new Map<string, MediaStore>();
export function mediaStore(user: string, couple: string) {
  const key = `${user}:${couple}`;
  let store = stores.get(key);
  if (!store) { store = new MediaStore(user, couple); stores.set(key, store); }
  return store;
}

export class MediaStore {
  private state: Snapshot = { rows: [], local: {}, jobs: [], loading: true, error: '', downloading: '', free: Infinity };
  private listeners = new Set<() => void>();
  private active = 0;
  private urls = new Map<string, { url: string; expires: number }>();
  private downloads = new Map<string, Promise<string>>();
  private writing: Promise<void> = Promise.resolve();
  private downloadingAll = false;
  private clearing = false;
  private refreshTask?: Promise<void>;
  private refreshRequested = false;
  private signing?: Promise<void>;
  private signQueue = new Set<string>();
  readonly ready: Promise<void>;
  readonly directory: string;
  private readonly key: string;
  constructor(readonly user: string, readonly couple: string) {
    this.directory = `${FS.documentDirectory}memories/${user}/${couple}/`;
    this.key = `local_media:${user}:${couple}`;
    this.ready = this.hydrate();
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private patch(patch: Partial<Snapshot>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private persist() {
    const value = JSON.stringify({ rows: this.state.rows, local: this.state.local });
    this.writing = this.writing.catch(() => {}).then(() => AsyncStorage.setItem(this.key, value));
    return this.writing;
  }
  private async hydrate() {
    try {
      await FS.makeDirectoryAsync(this.directory, { intermediates: true });
      const raw = await AsyncStorage.getItem(this.key);
      if (raw) {
        const saved = JSON.parse(raw) as { rows: MediaRow[]; local: Local };
        const local: Local = {};
        for (const [id, entry] of Object.entries(saved.local)) {
          if (entry.uri.startsWith(this.directory) && (await FS.getInfoAsync(entry.uri)).exists) local[id] = entry;
        }
        this.patch({ rows: saved.rows.filter(row => row.couple_id === this.couple), local });
      }
      this.patch({ free: await FS.getFreeDiskStorageAsync() });
    } catch (e) { this.patch({ error: `Local cache: ${message(e)}` }); }
    finally { this.patch({ loading: false }); }
  }
  refresh() {
    this.refreshRequested = true;
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = (async () => {
      do { this.refreshRequested = false; await this.fetchRows(); } while (this.refreshRequested);
    })().finally(() => { this.refreshTask = undefined; });
    return this.refreshTask;
  }
  private async fetchRows() {
    await this.ready;
    this.patch({ loading: true, error: '' });
    try {
      const rows: MediaRow[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('media').select('*').eq('couple_id', this.couple).order('taken_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...data);
        if (data.length < 500) break;
      }
      this.patch({ rows });
      await this.persist();
    } catch (e) { this.patch({ error: `Could not sync. Saved memories remain available. ${message(e)}` }); }
    finally { this.patch({ loading: false }); }
  }
  async signed(paths: string[]) {
    const unique = [...new Set(paths)];
    const missing = () => unique.filter(path => (this.urls.get(path)?.expires ?? 0) < Date.now());
    for (const path of missing()) this.signQueue.add(path);
    // Collect requests from visible tiles in the same render into batch signing.
    while (missing().length) {
      if (!this.signing) {
        this.signing = new Promise<void>(resolve => setTimeout(resolve, 0)).then(async () => {
          const batch = [...this.signQueue];
          this.signQueue.clear();
          for (let i = 0; i < batch.length; i += 100) {
            const { data, error } = await supabase.storage.from('media').createSignedUrls(batch.slice(i, i + 100), 3600);
            if (error) throw error;
            for (const item of data) if (item.path && item.signedUrl) this.urls.set(item.path, { url: item.signedUrl, expires: Date.now() + 55 * 60_000 });
          }
        }).finally(() => { this.signing = undefined; });
      }
      await this.signing;
      const absent = missing();
      if (absent.length && !absent.some(path => this.signQueue.has(path))) throw new Error('A memory file is missing or access has expired. Pull to refresh.');
    }
    return Object.fromEntries(unique.map(path => [path, this.urls.get(path)?.url]));
  }
  async cache(row: MediaRow): Promise<string> {
    await this.ready;
    if (this.clearing) throw new Error('Cache is being cleared. Try again in a moment.');
    const entry = this.state.local[row.id];
    if (entry && (await FS.getInfoAsync(entry.uri)).exists) return entry.uri;
    const pending = this.downloads.get(row.id);
    if (pending) return pending;
    const task = this.download(row).finally(() => { this.downloads.delete(row.id); });
    this.downloads.set(row.id, task);
    return task;
  }
  private async download(row: MediaRow) {
    const free = await FS.getFreeDiskStorageAsync();
    this.patch({ free });
    if (free < (row.size_bytes ?? LIMIT) + 100 * MB) throw new Error('Phone storage is nearly full. Free some space before downloading.');
    const urls = await this.signed([row.storage_path, ...(row.thumb_path ? [row.thumb_path] : [])]);
    const url = urls[row.storage_path];
    if (!url) throw new Error('Original is unavailable. Pull to refresh and try again.');
    const uri = `${this.directory}${row.id}.${row.kind === 'photo' ? 'jpg' : 'mp4'}`;
    const temporary = `${uri}.part`;
    try {
      const result = await FS.downloadAsync(url, temporary);
      if (result.status !== 200) throw new Error(`Download failed (${result.status})`);
      await FS.moveAsync({ from: temporary, to: uri });
      let thumb: string | undefined;
      if (row.thumb_path && urls[row.thumb_path]) {
        const target = `${this.directory}${row.id}-thumb.jpg`;
        try { const preview = await FS.downloadAsync(urls[row.thumb_path]!, target); if (preview.status === 200) thumb = target; } catch { /* Original remains available. */ }
      }
      const info = await FS.getInfoAsync(uri);
      const previewInfo = thumb ? await FS.getInfoAsync(thumb) : undefined;
      const remaining = await FS.getFreeDiskStorageAsync();
      this.patch({ local: { ...this.state.local, [row.id]: { uri, thumb, bytes: (info.exists ? info.size : 0) + (previewInfo?.exists ? previewInfo.size : 0) } }, free: remaining });
      await this.persist();
      return uri;
    } finally { await FS.deleteAsync(temporary, { idempotent: true }); }
  }
  async downloadAll() {
    if (this.downloadingAll) return;
    this.downloadingAll = true;
    const rows = [...this.state.rows];
    let failed = 0;
    try {
      for (let i = 0; i < rows.length; i++) {
        this.patch({ downloading: `${i + 1} / ${rows.length}` });
        try { await this.cache(rows[i]!); } catch (e) { failed++; this.patch({ error: message(e) }); }
      }
    } finally { this.downloadingAll = false; this.patch({ downloading: '', ...(failed ? { error: `${failed} downloads failed. Tap Download all to retry. ${this.state.error}` } : {}) }); }
  }
  async clearCache() {
    this.clearing = true;
    try {
      await Promise.allSettled([...this.downloads.values()]);
      // Delete only this account's dedicated Memories directory.
      await FS.deleteAsync(this.directory, { idempotent: true });
      await FS.makeDirectoryAsync(this.directory, { intermediates: true });
      this.patch({ local: {}, free: await FS.getFreeDiskStorageAsync() });
      await this.persist();
    } finally { this.clearing = false; }
  }
  enqueue(assets: Picker.ImagePickerAsset[]) {
    this.patch({ jobs: [...this.state.jobs.filter(j => j.status !== 'done'), ...assets.map(asset => ({ id: randomUUID(), asset, status: 'waiting' as const, progress: 0 }))] });
    this.pump();
  }
  retry(id: string) { this.job(id, { status: 'waiting', progress: 0, error: undefined }); this.pump(); }
  private job(id: string, patch: Partial<Job>) { this.patch({ jobs: this.state.jobs.map(j => j.id === id ? { ...j, ...patch } : j) }); }
  private pump() {
    while (this.active < 2) {
      const next = this.state.jobs.find(j => j.status === 'waiting');
      if (!next) break;
      this.active++;
      this.job(next.id, { status: 'preparing' });
      void this.upload(next).catch(e => this.job(next.id, { status: 'failed', error: message(e) })).finally(() => { this.active--; this.pump(); });
    }
  }
  private async upload(job: Job) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.id !== this.user) throw new Error('Sign back into the account that queued this upload.');
    const { data: profile, error: profileError } = await supabase.from('profiles').select('couple_id').eq('id', this.user).single();
    if (profileError) throw profileError;
    if (profile.couple_id !== this.couple) throw new Error('Your couple changed. Please reopen Memories.');
    // A lost response after insertion must not produce a duplicate on retry.
    const { data: existing, error: lookupError } = await supabase.from('media').select('id').eq('id', job.id).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) { this.job(job.id, { status: 'done', progress: 1 }); await this.refresh(); return; }
    const asset = job.asset;
    const kind = asset.type === 'video' ? 'video' : 'photo';
    const taken_at = await takenAt(asset);
    let uri: string;
    let width = asset.width;
    let height = asset.height;
    if (kind === 'photo') {
      const resize = asset.width >= asset.height ? { width: Math.min(2560, asset.width) } : { height: Math.min(2560, asset.height) };
      const image = await Manipulator.manipulateAsync(asset.uri, [{ resize }], { compress: 0.8, format: Manipulator.SaveFormat.JPEG });
      uri = image.uri; width = image.width; height = image.height;
    } else {
      uri = await Video.compress(asset.uri, { compressionMethod: 'auto', maxSize: 1920, minimumFileSizeForCompress: 0 }, p => this.job(job.id, { progress: p * 0.25 }));
      if (await size(uri) >= LIMIT) {
        const seconds = Math.max(1, (asset.duration ?? 60_000) / 1000);
        uri = await Video.compress(asset.uri, { compressionMethod: 'manual', maxSize: 1280, bitrate: Math.max(100_000, Math.floor(44 * MB * 8 / seconds) - 128_000), minimumFileSizeForCompress: 0 });
      }
    }
    const bytes = await size(uri);
    if (bytes >= LIMIT) { this.job(job.id, { status: 'skipped', error: 'Skipped: this file is still 50 MB or larger after compression. Trim the video and select it again.' }); return; }
    const thumbSource = kind === 'video' ? (await Thumbnails.getThumbnailAsync(uri, { time: 0 })).uri : uri;
    const thumb = await Manipulator.manipulateAsync(thumbSource, [{ resize: { width: 480 } }], { compress: 0.7, format: Manipulator.SaveFormat.JPEG });
    const storage_path = `${this.couple}/${kind === 'photo' ? 'photos' : 'videos'}/${job.id}.${kind === 'photo' ? 'jpg' : 'mp4'}`;
    const thumb_path = `${this.couple}/thumbs/${job.id}.jpg`;
    this.job(job.id, { status: 'uploading', progress: 0.25 });
    // Deterministic paths allow safe retries after a network response is lost.
    await this.send(storage_path, uri, kind === 'photo' ? 'image/jpeg' : 'video/mp4', p => this.job(job.id, { progress: 0.25 + p * 0.65 }));
    await this.send(thumb_path, thumb.uri, 'image/jpeg', p => this.job(job.id, { progress: 0.9 + p * 0.08 }));
    const { error } = await supabase.from('media').insert({ id: job.id, couple_id: this.couple, uploader_id: this.user, kind, storage_path, thumb_path, taken_at, width: kind === 'photo' ? width : null, height: kind === 'photo' ? height : null, duration_ms: asset.duration, size_bytes: bytes });
    if (error) throw error;
    this.job(job.id, { status: 'done', progress: 1 });
    await this.refresh();
  }
  private async send(path: string, uri: string, contentType: string, progress: (p: number) => void) {
    const { data, error } = await supabase.storage.from('media').createSignedUploadUrl(path, { upsert: true });
    if (error) throw error;
    const task = FS.createUploadTask(data.signedUrl, uri, { httpMethod: 'PUT', uploadType: FS.FileSystemUploadType.BINARY_CONTENT, headers: { 'Content-Type': contentType, 'x-upsert': 'true' } }, p => progress(p.totalBytesSent / Math.max(1, p.totalBytesExpectedToSend)));
    const result = await task.uploadAsync();
    if (!result || result.status < 200 || result.status >= 300) throw new Error(`Upload failed (${result?.status ?? 'no response'}). Check connection and bucket storage capacity, then retry.`);
  }
  async caption(row: MediaRow, caption: string) {
    const { data, error } = await supabase.from('media').update({ caption: caption.trim() || null }).eq('id', row.id).eq('couple_id', this.couple).select('id').single();
    if (error || !data) throw error ?? new Error('Caption was not saved.');
    await this.refresh();
  }
  async remove(row: MediaRow) {
    if (row.uploader_id !== this.user) throw new Error('Only the uploader can delete this memory.');
    // Remove storage first: a failed storage deletion leaves a retryable timeline entry.
    const { error: storageError } = await supabase.storage.from('media').remove([row.storage_path, ...(row.thumb_path ? [row.thumb_path] : [])]);
    if (storageError) throw storageError;
    const { data, error } = await supabase.from('media').delete().eq('id', row.id).eq('uploader_id', this.user).select('id').single();
    if (error || !data) throw error ?? new Error('Deletion was not confirmed. Retry deletion.');
    const local = { ...this.state.local };
    const entry = local[row.id];
    if (entry) { await FS.deleteAsync(entry.uri, { idempotent: true }); if (entry.thumb) await FS.deleteAsync(entry.thumb, { idempotent: true }); }
    delete local[row.id];
    this.patch({ rows: this.state.rows.filter(item => item.id !== row.id), local });
    await this.persist();
  }
}
async function size(uri: string) { const info = await FS.getInfoAsync(uri); if (!info.exists) throw new Error('Selected file is no longer available. Select it again.'); return info.size; }
export async function takenAt(asset: Picker.ImagePickerAsset) {
  const exif: unknown = asset.exif?.DateTimeOriginal ?? asset.exif?.DateTimeDigitized ?? asset.exif?.DateTime;
  if (typeof exif === 'string') {
    const parsed = new Date(exif.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T'));
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (asset.assetId) {
    try { const info = await Library.getAssetInfoAsync(asset.assetId); if (info.creationTime > 0) return new Date(info.creationTime).toISOString(); if (info.modificationTime > 0) return new Date(info.modificationTime).toISOString(); } catch { /* Picker grants may not include library metadata. */ }
  }
  const info = await FS.getInfoAsync(asset.uri);
  return new Date(info.exists && info.modificationTime > 0 ? info.modificationTime * 1000 : Date.now()).toISOString();
}
