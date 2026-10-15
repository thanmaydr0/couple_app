import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
const source = ts.transpileModule(await readFile(new URL('../src/matroska-captions.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { readMatroskaCaptions, activeCaptionText, plainCaptionText } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const bytes = value => Buffer.from(value);
function size(value) {
  for (let length = 1; length < 8; length++) if (value < 2 ** (7 * length) - 1) {
    const result = Buffer.alloc(length); let remaining = value;
    for (let i = length - 1; i >= 0; i--) { result[i] = remaining & 255; remaining = Math.floor(remaining / 256); }
    result[0] |= 0x80 >> (length - 1); return result;
  }
  throw new Error('Test element too large');
}
const element = (id, data) => Buffer.concat([Buffer.from(id, 'hex'), size(data.length), data]);
const integer = value => { let hex = value.toString(16); if (hex.length % 2) hex = '0' + hex; return Buffer.from(hex, 'hex'); };
const uint = (id, value) => element(id, integer(value));
const track = (number, codec) => element('ae', Buffer.concat([uint('d7', number), element('86', bytes(codec))]));
function block(number, time, text, duration) {
  const header = Buffer.alloc(4); header[0] = 0x80 | number; header.writeInt16BE(time, 1);
  const payload = element('a1', Buffer.concat([header, bytes(text)]));
  return element('a0', Buffer.concat([payload, uint('9b', duration)]));
}
function fixture() {
  const tracks = element('1654ae6b', Buffer.concat([track(1, 'V_MPEG4/ISO/AVC'), track(2, 'A_AAC'), track(3, 'S_TEXT/UTF8'), track(4, 'S_TEXT/UTF8')]));
  const info = element('1549a966', uint('2ad7b1', 1000000));
  const cluster = element('1f43b675', Buffer.concat([uint('e7', 5000), block(3, -1000, '<i>First</i>\r\ncaption &amp; more', 4000), block(4, -1000, 'Other language', 4000), block(3, 4000, 'Later caption', 2000)]));
  return new Blob([element('18538067', Buffer.concat([info, tracks, cluster]))]);
}
test('embedded SRT indexes preserve stream mapping, signed timestamps, durations and line breaks', async () => {
  const tracks = await readMatroskaCaptions(fixture());
  assert.deepEqual(tracks.map(track => track.stream), [2, 3]);
  assert.deepEqual(tracks[0].cues, [{ start: 4, end: 8, text: 'First\ncaption & more' }, { start: 9, end: 11, text: 'Later caption' }]);
  assert.equal(activeCaptionText(tracks[1].cues, 6), 'Other language');
});
test('a seek into an active caption retains it; forwards/backwards seeks do not discard cues', async () => {
  const [{ cues }] = await readMatroskaCaptions(fixture());
  assert.equal(activeCaptionText(cues, 6), 'First\ncaption & more');
  assert.equal(activeCaptionText(cues, 10), 'Later caption');
  assert.equal(activeCaptionText(cues, 6), 'First\ncaption & more');
  assert.equal(activeCaptionText(cues, 8), '');
  assert.equal(activeCaptionText(cues, 12), '');
});
test('overlapping lines retain their timing and text is rendered as inert text', () => {
  assert.equal(activeCaptionText([{ start: 0, end: 15, text: 'Opening' }, { start: 11, end: 13, text: 'Dialogue' }], 12), 'Opening\nDialogue');
  assert.equal(plainCaptionText('<b>Hello</b><br>world &#33; {\\an8}<script>test</script>'), 'Hello\nworld ! <script>test</script>');
});
test('malformed and truncated container data is rejected', async () => {
  await assert.rejects(readMatroskaCaptions(new Blob([bytes([0])])), /Invalid/);
  const file = fixture(); await assert.rejects(readMatroskaCaptions(file.slice(0, file.size - 1)), /Invalid|Truncated/);
});
