/* Service integration checks with native/network boundaries mocked; run node src/features/media/verify.cjs. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const memory = new Map();
const files = new Map();
const rows = new Map();
let signedCalls = 0, downloadCalls = 0, working = 0, maxWorking = 0, failOnce = false, failInsert = false, sequence = 0;
const pause = () => new Promise(resolve => setTimeout(resolve, 2));
const storage = {
  createSignedUrls: async paths => { signedCalls++; return { data: paths.map(path => ({ path, signedUrl: `https://test/${path}` })), error: null }; },
  createSignedUploadUrl: async path => ({ data: { signedUrl: `https://test/${path}` }, error: null }),
  remove: async () => ({ error: null }),
};
const supabase = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'u' } } } }) },
  storage: { from: () => storage },
  from: table => {
    const filters = {};
    let insertion;
    const query = {
      select: () => query, eq: (key, value) => { filters[key] = value; return query; }, order: () => query,
      range: async () => ({ data: [...rows.values()].filter(row => row.couple_id === filters.couple_id), error: null }),
      maybeSingle: async () => ({ data: rows.get(filters.id) ?? null, error: null }),
      single: async () => ({ data: table === 'profiles' ? { couple_id: 'c' } : null, error: null }),
      insert: value => { insertion = value; return query; },
      then: (resolve, reject) => {
        rows.set(insertion.id, insertion);
        const error = failInsert ? { message: 'response lost after insert' } : null;
        failInsert = false;
        return Promise.resolve({ error }).then(resolve, reject);
      },
    };
    return query;
  },
};
const FS = {
  documentDirectory: 'file:///documents/',
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  makeDirectoryAsync: async () => {},
  getFreeDiskStorageAsync: async () => 2_000_000_000,
  getInfoAsync: async uri => ({ exists: files.has(uri), size: files.get(uri) ?? 0, modificationTime: 1234567890 }),
  downloadAsync: async (url, uri) => { downloadCalls++; await pause(); files.set(uri, 100); return { status: 200, uri }; },
  moveAsync: async ({ from, to }) => { files.set(to, files.get(from)); files.delete(from); },
  deleteAsync: async uri => { for (const key of files.keys()) if (key.startsWith(uri)) files.delete(key); },
  createUploadTask: (_url, _uri, _options, progress) => ({ uploadAsync: async () => {
    if (failOnce) { failOnce = false; throw new Error('offline'); }
    progress({ totalBytesSent: 100, totalBytesExpectedToSend: 100 });
    return { status: 200 };
  } }),
};
const mocks = {
  '@react-native-async-storage/async-storage': { getItem: async key => memory.get(key) ?? null, setItem: async (key, value) => { memory.set(key, value); } },
  'expo-file-system/legacy': FS,
  'expo-image-picker': {},
  'expo-media-library/legacy': { getAssetInfoAsync: async () => ({ creationTime: 1600000000000 }) },
  'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: async () => {
    working++; maxWorking = Math.max(maxWorking, working); await pause(); working--;
    const uri = `file:///generated/${sequence++}.jpg`; files.set(uri, 100); return { uri, width: 2560, height: 1440 };
  } },
  'expo-video-thumbnails': { getThumbnailAsync: async () => ({ uri: 'file:///thumb.jpg' }) },
  'react-native-compressor': { Video: { compress: async uri => uri } },
  'expo-crypto': { randomUUID: () => `job-${sequence++}` },
  '@/lib/supabase': { supabase },
};
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/service.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const moduleObject = { exports: {} };
vm.runInNewContext(code, { exports: moduleObject.exports, module: moduleObject, require: name => {
  if (!(name in mocks)) throw new Error(`Unexpected import ${name}`);
  return mocks[name];
}, setTimeout, clearTimeout, console });
const { MediaStore, takenAt, MB } = moduleObject.exports;
const row = id => ({ id, couple_id: 'c', kind: 'photo', storage_path: `c/photos/${id}.jpg`, thumb_path: `c/thumbs/${id}.jpg`, size_bytes: 100, taken_at: '2020-01-01T00:00:00Z' });
const asset = { uri: 'file:///photo.jpg', type: 'image', width: 4000, height: 2250 };
async function settled(store) {
  for (let i = 0; i < 500; i++) {
    if (!store.snapshot().jobs.some(job => ['waiting', 'preparing', 'uploading'].includes(job.status))) return;
    await pause();
  }
  throw new Error('Queue never settled');
}
(async () => {
  files.set(asset.uri, 100);
  assert.equal(await takenAt({ ...asset, exif: { DateTimeOriginal: '2021:02:03 12:00:00' } }), new Date('2021-02-03T12:00:00').toISOString());
  assert.equal(await takenAt({ ...asset, assetId: 'a' }), new Date(1600000000000).toISOString());
  assert.equal(await takenAt(asset), new Date(1234567890000).toISOString());
  const store = new MediaStore('u', 'c'); await store.ready;
  await Promise.all([store.signed(['a']), store.signed(['b'])]);
  assert.equal(signedCalls, 1, 'visible previews should batch URL signing');
  await store.signed(['a']); assert.equal(signedCalls, 1, 'unexpired signing should reuse memory');
  await Promise.all([store.cache(row('1')), store.cache(row('1')), store.cache(row('2'))]);
  assert.equal(downloadCalls, 4, 'original and preview download only once per id');
  assert.equal(Object.keys(store.snapshot().local).length, 2, 'concurrent downloads retain both index entries');
  const offline = new MediaStore('u', 'c'); await offline.ready;
  await offline.cache(row('1')); assert.equal(downloadCalls, 4, 'restart can open downloaded original offline');
  const other = new MediaStore('different-user', 'c'); await other.ready;
  assert.equal(Object.keys(other.snapshot().local).length, 0, 'account cache isolation');
  const unsubscribe = store.subscribe(() => {});
  store.enqueue([asset, asset, asset, asset, asset]); unsubscribe();
  await settled(store);
  assert.equal(store.snapshot().jobs.filter(job => job.status === 'done').length, 5, 'queue survives screen listener removal');
  assert.equal(maxWorking, 2, 'exactly two preparation/upload workers');
  failOnce = true; store.enqueue([asset]); await settled(store);
  const failed = store.snapshot().jobs.find(job => job.status === 'failed'); assert.ok(failed);
  store.retry(failed.id); await settled(store);
  assert.equal(store.snapshot().jobs.find(job => job.id === failed.id).status, 'done');
  failInsert = true; store.enqueue([asset]); await settled(store);
  const lost = store.snapshot().jobs.find(job => job.status === 'failed'); assert.ok(lost);
  const count = rows.size; store.retry(lost.id); await settled(store);
  assert.equal(rows.size, count, 'lost database response retry must not duplicate media');
  files.set('file:///large.mp4', 50 * MB);
  store.enqueue([{ ...asset, type: 'video', uri: 'file:///large.mp4', duration: 120000 }]); await settled(store);
  assert.equal(store.snapshot().jobs.at(-1).status, 'skipped', '50 MiB is rejected, not uploaded');
  await store.clearCache(); assert.equal(Object.keys(store.snapshot().local).length, 0);
  assert.ok(memory.get('local_media:u:c'), 'clear cache retains timeline metadata');
  console.log('Memories checks passed: dates, URL batching, concurrent cache writes, offline restart, account isolation, two-worker queue, navigation survival, upload retry, lost-response deduplication, strict 50 MiB limit, cache clearing.');
})().catch(error => { console.error(error); process.exitCode = 1; });
