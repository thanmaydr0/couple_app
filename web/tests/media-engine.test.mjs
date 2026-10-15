import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const controllerUrl = url(compile(await readFile(new URL('../src/media-controller.ts', import.meta.url), 'utf8')));
const captionsUrl = url('export const selections=[]; export class LocalCaptions { async select(file,stream){selections.push(stream);} hide(){} destroy(){} }');
const { selections } = await import(captionsUrl);
const source = compile(await readFile(new URL('../src/media-engine.ts', import.meta.url), 'utf8')).replace("'./media-controller.js'", JSON.stringify(controllerUrl)).replace("'./local-captions.js'", JSON.stringify(captionsUrl));
const { MovieEngine } = await import(url(source));

function fixture(streams) {
  let raw; const ioCalls = [];
  class CustomIOLoader {}
  class FileIOLoader {
    async open(info) { ioCalls.push(['open', info.file]); return 0; }
    async read(buffer) { buffer.set(new Uint8Array([1, 2, 3])); return 3; }
    async seek(pos) { ioCalls.push(['seek', pos]); return 0; }
    async size() { return 42n; }
    async stop() { ioCalls.push(['stop']); }
  }
  class AVPlayer {
    static IOLoader = { CustomIOLoader, FileIOLoader };
    constructor(options) { this.options = options; raw = this; }
    async load(source) { this.source = source; }
    getDuration() { return 60000n; }
    getStreams() { return streams; }
    on() { return this; }
    getStatus() { return 4; }
    setSubtitleEnable() {}
    async destroy() {}
  }
  globalThis.window = { AVPlayer };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  const surface = { classList: { add() {}, toggle() {} } };
  return { create: buffered => new MovieEngine(surface, buffered), raw: () => raw, ioCalls, CustomIOLoader };
}
const audio = (id, codecId = 86018, profile = 1) => ({ id, mediaType: 'Audio', metadata: {}, codecpar: 1024 + id, codecparProxy: { codecId, profile, sampleRate: 48000, chLayout: { nbChannels: 2 } } });

test('local movies opt into VOD buffering while disk reads remain seekable and lazy', async () => {
  const f = fixture([audio(1)]); const engine = f.create(); const file = { name: 'Movie.MKV' };
  await engine.load(file); const raw = f.raw();
  assert.ok(raw.source instanceof f.CustomIOLoader);
  assert.equal(raw.source.ext, 'mkv'); assert.equal(raw.source.minBuffer, 8);
  assert.deepEqual(f.ioCalls, []); // Loading does not read the entire movie into memory.
  await raw.source.open(); await raw.source.seek(100n);
  const bytes = new Uint8Array(3); assert.equal(await raw.source.read(bytes), 3);
  assert.deepEqual([...bytes], [1, 2, 3]); assert.equal(await raw.source.size(), 42n);
  await raw.source.stop(); assert.deepEqual(f.ioCalls, [['open', file], ['seek', 100n], ['stop']]);
  await engine.destroy();
});

test('native playback checks every audio track through the public codec proxy', async () => {
  for (const [streams, expected] of [
    [[audio(1), audio(2)], true],
    [[audio(1), audio(2, 86019)], false], // AAC plus AC-3 must keep both languages playable.
    [[audio(1), audio(2, 86018, 4)], false],
  ]) {
    const f = fixture(streams); const engine = f.create(); await engine.load({ name: 'movie.mp4' });
    assert.equal(f.raw().options.checkUseMSE(), expected); await engine.destroy();
  }
});

test('metadata probes retain the direct-file path and never start a playback buffer', async () => {
  const f = fixture([audio(1)]); const engine = f.create(false); const file = { name: 'probe.mp4' };
  await engine.load(file); assert.equal(f.raw().source, file); await engine.destroy();
});

test('embedded SRT changes use local stream indexes without seeking or changing playback', async () => {
  const subtitle = (id, index) => ({ id, index, mediaType: 'Subtitle', metadata: { title: 'Same title' }, codecparProxy: { codecId: 94225 } });
  const f = fixture([audio(1), subtitle(8, 3), subtitle(9, 4)]);
  const engine = f.create(); await engine.load({ name: 'movie.mkv' }); engine.enabled = true;
  const before = selections.length;
  await engine.selectSubtitle(8); assert.equal(engine.selectedCaption, 8);
  await engine.selectSubtitle(-1); assert.equal(engine.selectedCaption, -1);
  await engine.selectSubtitle(9); assert.equal(engine.selectedCaption, 9);
  assert.deepEqual(selections.slice(before), [3, 4]); assert.equal(engine.paused, true);
  assert.deepEqual(engine.tracks.filter(track => track.kind === 'subtitle').map(track => track.label), ['Same title · Track 1', 'Same title · Track 2']);
  // This driver intentionally has no seek/play/selectSubtitle implementation:
  // calling any of them for an SRT selection would fail the regression.
  await engine.destroy();
});
