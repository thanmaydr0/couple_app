import { activeCaptionText, type CaptionIndex, type CaptionCue } from './matroska-captions.js';
/** Local caption clock; never reads or writes partner state. */
export class LocalCaptions {
  private worker: Worker | null = null;
  private index: Promise<CaptionIndex> | null = null;
  private cues: CaptionCue[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private generation = 0;
  private cancel: (() => void) | undefined;
  private node = document.createElement('div');
  private text = document.createElement('span');
  constructor(surface: HTMLElement, private time: () => number) {
    this.node.className = 'movie-captions'; this.node.hidden = true;
    this.node.append(this.text); surface.append(this.node);
  }
  async select(file: File, stream: number) {
    const generation = ++this.generation;
    this.index ??= new Promise<CaptionIndex>((resolve, reject) => {
      this.cancel = () => resolve([]);
      const worker = this.worker = new Worker(new URL('./caption-worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ tracks?: CaptionIndex; error?: string }>) => {
        worker.terminate(); this.worker = null; this.cancel = undefined;
        if (event.data.error) { this.index = null; reject(new Error(event.data.error)); } else resolve(event.data.tracks || []);
      };
      worker.onerror = () => { worker.terminate(); this.worker = null; this.index = null; reject(new Error('Could not read embedded captions. Try selecting the track again.')); };
      worker.postMessage(file);
    });
    const tracks = await this.index;
    if (generation !== this.generation) return;
    const track = tracks.find(track => track.stream === stream);
    if (!track) throw new Error('The selected embedded SRT track could not be read.');
    this.cues = track.cues;
    clearInterval(this.timer); this.render(); this.timer = setInterval(() => this.render(), 100);
  }
  private render() {
    const value = activeCaptionText(this.cues, this.time());
    if (this.text.textContent !== value) this.text.textContent = value;
    this.node.hidden = !value;
  }
  hide() { this.generation++; clearInterval(this.timer); this.cues = []; this.node.hidden = true; this.text.textContent = ''; }
  destroy() { this.hide(); this.worker?.terminate(); this.cancel?.(); this.cancel = undefined; this.node.remove(); }
}
