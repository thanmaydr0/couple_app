import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const version = '1.3.1';
const files = [
  ...['h264','hevc','av1','vp8','vp9','mpeg2video','mpeg4','theora','vvc','aac','mp3','opus','flac','vorbis','ac3','eac3','dca','pcm','adpcm','speex','wmv','wma','mjpeg','h261','h263','msmpeg4','ra','dvaudio','dvvideo','png','webp','gif','tiff','bmp'].map(name => `decode/${name}-simd.wasm`),
  'resample/resample-simd.wasm', 'stretchpitch/stretchpitch-simd.wasm',
];
export async function mediaAssets(output) {
  const manifestPath = resolve(root, 'media-codecs.json');
  let manifest; try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!manifest && !process.argv.includes('--record')) throw new Error('Missing pinned media codec manifest.');
  const entries = {}; let index = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (index < files.length) {
      const file = files[index++]; const cache = resolve(root, 'node_modules/.cache/us-media', version, file);
      let bytes;
      try { bytes = await readFile(cache); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const url = `https://cdn.jsdelivr.net/gh/zhaohappy/libmedia@${version}/dist/${file}`;
        const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`Codec asset ${file}: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer()); await mkdir(dirname(cache), { recursive: true }); await writeFile(cache, bytes);
      }
      const hash = createHash('sha256').update(bytes).digest('hex');
      if (manifest && manifest.sha256[file] !== hash) throw new Error(`Codec integrity mismatch: ${file}`);
      if (!bytes.subarray(0,4).equals(Buffer.from([0,97,115,109]))) throw new Error(`Invalid WebAssembly asset: ${file}`);
      entries[file] = hash;
      if (output) { const target = resolve(output, 'vendor/libmedia/wasm', file); await mkdir(dirname(target), { recursive: true }); await copyFile(cache, target); }
    }
  }));
  if (!manifest) await writeFile(manifestPath, JSON.stringify({ version, source: `https://github.com/zhaohappy/libmedia/tree/${version}`, sha256: Object.fromEntries(Object.entries(entries).sort()) }, null, 2) + '\n');
  if (output) {
    const pkg = resolve(root, 'node_modules/@libmedia/avplayer');
    const { readdir } = await import('node:fs/promises');
    for (const name of await readdir(resolve(pkg,'dist/umd'))) if (name.endsWith('.js')) await copyFile(resolve(pkg,'dist/umd',name), resolve(output,'vendor/libmedia',name));
    await copyFile(resolve(pkg,'COPYING.LGPLv3'),resolve(output,'vendor/libmedia/COPYING.LGPLv3'));
  }
}
if (process.argv.includes('--record')) { await mediaAssets(); console.log('Recorded pinned codec asset hashes.'); }
