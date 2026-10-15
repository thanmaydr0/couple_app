export type CaptionCue = { start: number; end: number; text: string };
export type CaptionIndex = { stream: number; cues: CaptionCue[] }[];
type Element = { id: number; data: number; end: number };
const ids = { segment: 0x18538067, info: 0x1549a966, tracks: 0x1654ae6b, cluster: 0x1f43b675 };
function byteAt(bytes: Uint8Array, index: number) {
  const value = bytes[index];
  if (value === undefined) throw new Error('Truncated Matroska header.');
  return value;
}

/** Read EBML headers and subtitle payloads only. Video/audio blocks are skipped. */
class Reader {
  private offset = -1;
  private cache = new Uint8Array();
  constructor(readonly file: Blob) {}
  async bytes(offset: number, length: number) {
    if (offset < 0 || length < 0 || offset + length > this.file.size) throw new Error('Truncated Matroska caption data.');
    if (offset < this.offset || offset + length > this.offset + this.cache.length) {
      this.offset = offset;
      this.cache = new Uint8Array(await this.file.slice(offset, Math.min(this.file.size, offset + Math.max(262144, length))).arrayBuffer());
    }
    return this.cache.subarray(offset - this.offset, offset - this.offset + length);
  }
  async element(offset: number, limit: number): Promise<Element> {
    const bytes = await this.bytes(offset, Math.min(12, limit - offset));
    const idSize = vintSize(byteAt(bytes, 0));
    if (idSize > 4) throw new Error('Invalid Matroska element ID.');
    let id = 0;
    for (let i = 0; i < idSize; i++) id = id * 256 + byteAt(bytes, i);
    const sizeLength = vintSize(byteAt(bytes, idSize));
    let size = byteAt(bytes, idSize) & (0xff >> sizeLength);
    let unknown = size === (0xff >> sizeLength);
    for (let i = 1; i < sizeLength; i++) { size = size * 256 + byteAt(bytes, idSize + i); unknown = unknown && byteAt(bytes, idSize + i) === 255; }
    const data = offset + idSize + sizeLength;
    const end = unknown ? limit : data + size;
    if (data > limit || !Number.isSafeInteger(end) || end < data || end > limit) throw new Error('Invalid Matroska caption element size.');
    return { id, data, end };
  }
  async uint(element: Element) {
    if (element.end - element.data > 8) throw new Error('Invalid Matroska integer.');
    let value = 0;
    for (const byte of await this.bytes(element.data, element.end - element.data)) value = value * 256 + byte;
    return value;
  }
  async *children(start: number, end: number) {
    while (start < end) { const element = await this.element(start, end); yield element; start = element.end; }
  }
}
function vintSize(first: number) {
  for (let length = 1; length <= 8; length++) if (first & (0x80 >> (length - 1))) return length;
  throw new Error('Invalid Matroska variable integer.');
}
export function plainCaptionText(text: string) {
  return text.replace(/\r\n?/g, '\n').replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/?(?:i|b|u|font)(?:\s[^>]*)?>/gi, '').replace(/\{\\[^}]*\}/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[entity] || entity)
    .replace(/&#(x[\da-f]+|\d+);/gi, (entity: string, value: string) => {
      const code = value.charAt(0).toLowerCase() === 'x' ? Number.parseInt(value.slice(1), 16) : Number(value);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
    }).trim();
}
export function activeCaptionText(cues: CaptionCue[], seconds: number) {
  let low = 0; let high = cues.length;
  while (low < high) { const mid = (low + high) >>> 1; if (cues[mid]!.start <= seconds) low = mid + 1; else high = mid; }
  const active: string[] = [];
  for (let i = Math.max(0, low - 64); i < low; i++) if (cues[i]!.end > seconds && cues[i]!.text) active.push(cues[i]!.text);
  return active.join('\n');
}

/** Index embedded UTF-8/SRT tracks independently of the playback demuxer's
 * disposable seek queues, so a cue remains available throughout its interval. */
export async function readMatroskaCaptions(file: Blob): Promise<CaptionIndex> {
  const reader = new Reader(file);
  const text = new TextDecoder();
  const tracks = new Map<number, { stream: number; cues: CaptionCue[]; prefix: Uint8Array; compression: number | null }>();
  let scale = 1000000;
  let totalCues = 0;
  let totalTextBytes = 0;
  async function readTracks(element: Element) {
    let stream = 0;
    for await (const entry of reader.children(element.data, element.end)) {
      if (entry.id !== 0xae) continue;
      let number = -1; let codec = ''; let compression: number | null = null; let prefix = new Uint8Array();
      async function encoding(start: number, end: number) {
        for await (const field of reader.children(start, end)) {
          if ([0x6d80, 0x6240, 0x5034].includes(field.id)) await encoding(field.data, field.end);
          if (field.id === 0x4254) compression = await reader.uint(field);
          if (field.id === 0x4255) {
            if (field.end - field.data > 1048576) throw new Error('Caption compression header is too large.');
            prefix = (await reader.bytes(field.data, field.end - field.data)).slice();
          }
          if (field.id === 0x5035) throw new Error('Encrypted embedded captions cannot be read.');
        }
      }
      for await (const field of reader.children(entry.data, entry.end)) {
        if (field.id === 0xd7) number = await reader.uint(field);
        if (field.id === 0x86) {
          if (field.end - field.data > 256) throw new Error('Invalid subtitle codec name.');
          codec = text.decode(await reader.bytes(field.data, field.end - field.data));
        }
        if (field.id === 0x6d80) await encoding(field.data, field.end);
      }
      if (codec === 'S_TEXT/UTF8') {
        if (compression !== null && compression !== 0 && compression !== 3) throw new Error('This subtitle compression is not supported.');
        tracks.set(number, { stream, cues: [], prefix, compression });
      }
      stream++;
    }
  }
  async function block(element: Element, clusterTime: number, duration: number | null) {
    const header = await reader.bytes(element.data, Math.min(12, element.end - element.data));
    const length = vintSize(byteAt(header, 0));
    let trackNumber = byteAt(header, 0) & (0xff >> length);
    for (let i = 1; i < length; i++) trackNumber = trackNumber * 256 + byteAt(header, i);
    const track = tracks.get(trackNumber);
    if (!track) return;
    if (header.length < length + 3 || byteAt(header, length + 2) & 6) throw new Error('Unsupported embedded subtitle block layout.');
    const rawTime = byteAt(header, length) * 256 + byteAt(header, length + 1);
    const relative = rawTime > 32767 ? rawTime - 65536 : rawTime;
    const payload = element.data + length + 3;
    if (element.end - payload > 1048576) throw new Error('An embedded caption is too large.');
    let bytes = (await reader.bytes(payload, element.end - payload)).slice();
    if (track.compression === 3) {
      const combined = new Uint8Array(track.prefix.length + bytes.length); combined.set(track.prefix); combined.set(bytes, track.prefix.length); bytes = combined;
    } else if (track.compression === 0) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const chunks: Uint8Array[] = []; const output = stream.getReader(); let size = 0;
      try {
        for (;;) { const part = await output.read(); if (part.done) break; size += part.value.length; if (size > 1048576) throw new Error('An expanded caption is too large.'); chunks.push(part.value); }
      } finally { await output.cancel(); }
      bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    const start = (clusterTime + relative) * scale / 1e9;
    const end = duration === null ? NaN : start + duration * scale / 1e9;
    totalTextBytes += bytes.length;
    if (totalTextBytes > 33554432) throw new Error('The embedded caption text is too large.');
    track.cues.push({ start, end, text: plainCaptionText(text.decode(bytes)) });
    if (++totalCues > 200000) throw new Error('The movie contains too many caption cues.');
  }
  async function cluster(element: Element) {
    let time = 0;
    for await (const child of reader.children(element.data, element.end)) {
      if (child.id === 0xe7) time = await reader.uint(child);
      if (child.id === 0xa3) await block(child, time, null);
      if (child.id === 0xa0) {
        let data: Element | null = null; let duration: number | null = null;
        for await (const field of reader.children(child.data, child.end)) {
          if (field.id === 0xa1) data = field;
          if (field.id === 0x9b) duration = await reader.uint(field);
        }
        if (data) await block(data, time, duration);
      }
    }
  }
  for await (const root of reader.children(0, file.size)) {
    if (root.id !== ids.segment) continue;
    for await (const element of reader.children(root.data, root.end)) {
      if (element.id === ids.info) for await (const field of reader.children(element.data, element.end)) if (field.id === 0x2ad7b1) scale = await reader.uint(field);
      if (element.id === ids.tracks) await readTracks(element);
      if (element.id === ids.cluster && tracks.size) await cluster(element);
    }
  }
  return [...tracks.values()].map(({ stream, cues }) => {
    cues.sort((a, b) => a.start - b.start);
    for (let i = 0; i < cues.length; i++) if (!Number.isFinite(cues[i]!.end)) cues[i]!.end = Math.min(cues[i + 1]?.start ?? Infinity, cues[i]!.start + 5);
    return { stream, cues };
  });
}
