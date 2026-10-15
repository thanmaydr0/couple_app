import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('../src/embedded-tracks.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/import \{ el \} from '.\/ui.js';/, '');
const { audioChoice, captionChoice } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('language changes affect only the selected device', () => {
  const own = [{ label: 'English', language: 'en', enabled: true }, { label: 'Hindi', language: 'hi', enabled: false }];
  const peer = structuredClone(own);
  assert.equal(audioChoice(own, 1), true);
  assert.deepEqual(own.map(track => track.enabled), [false, true]);
  assert.deepEqual(peer.map(track => track.enabled), [true, false]);
  assert.equal(audioChoice(own, 20), false); assert.deepEqual(own.map(track => track.enabled), [false, true]);
});
test('embedded captions can select a language or turn off independently', () => {
  const own = [{ label: 'English', language: 'en', kind: 'subtitles', mode: 'showing' }, { label: 'French', language: 'fr', kind: 'subtitles', mode: 'disabled' }];
  const peer = structuredClone(own);
  assert.equal(captionChoice(own, 1), true); assert.deepEqual(own.map(track => track.mode), ['disabled', 'showing']);
  assert.deepEqual(peer.map(track => track.mode), ['showing', 'disabled']);
  assert.equal(captionChoice(own, -1), true); assert(own.every(track => track.mode === 'disabled'));
  assert.equal(captionChoice(own, 8), false); assert(own.every(track => track.mode === 'disabled'));
  assert.equal(captionChoice([], -1), true);
});
