import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const directory = fileURLToPath(new URL('../src/features/calls/ambient/', import.meta.url));
mkdirSync(directory, { recursive: true });
// Original deterministic mono PCM. Crossfade tail into head for continuous looping.
const rate = 16000, count = rate * 8, overlap = rate;
let seed = 360;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 2147483648 - 1; };
for (const kind of ['white', 'pink', 'brown', 'rain']) {
  const samples = new Float64Array(count + overlap);
  let slow = 0, medium = 0, brown = 0;
  for (let i = 0; i < samples.length; i++) {
    const white = random(); slow = slow * 0.995 + white * 0.005;
    medium = medium * 0.9 + white * 0.1; brown = (brown + white * 0.02) / 1.02;
    samples[i] = kind === 'white' ? white * 0.12 : kind === 'pink' ? (slow * 3 + medium + white * 0.1) * 0.3 : kind === 'brown' ? brown * 0.7 : (medium + white * 0.15) * (0.2 + 0.05 * Math.sin(i / rate));
  }
  for (let i = 0; i < overlap; i++) {
    const blend = (1 - Math.cos(Math.PI * i / overlap)) / 2;
    samples[i] = samples[count + i] * (1 - blend) + samples[i] * blend;
  }
  const wav = Buffer.alloc(44 + count * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  writeFileSync(`${directory}/${kind}.wav`, wav);
}
