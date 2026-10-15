import { readMatroskaCaptions, type CaptionIndex } from './matroska-captions.js';
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<Blob>) => void) | null; postMessage(value: { tracks?: CaptionIndex; error?: string }): void };
scope.onmessage = async event => {
  try { scope.postMessage({ tracks: await readMatroskaCaptions(event.data) }); }
  catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : 'Could not read embedded captions.' }); }
};
