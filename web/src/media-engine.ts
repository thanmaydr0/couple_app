import { MediaController, type MediaDriver } from './media-controller.js';
export type EngineTrack = { id: number; label: string; kind: string };
type Stream = { id: number; mediaType: string; metadata: Record<string, unknown> };
interface AVDriver extends MediaDriver {
  load(file: File): Promise<void>; destroy(): Promise<void>;
  getDuration(): bigint; getStreams(): Stream[];
  getSelectedAudioStreamId(): number; getSelectedSubtitleStreamId(): number;
  resize(width: number, height: number): void;
  on(event: string, callback: (...args: unknown[]) => void): AVDriver;
}
declare global { interface Window { AVPlayer: new(options: { container: HTMLDivElement; wasmBaseUrl: string; enableWorker: boolean; enableHardware: boolean; enableWebCodecs: boolean; enableWebGPU: boolean; checkUseMSE: () => boolean; preLoadTime: number; enableJitterBuffer: boolean }) => AVDriver } }
export class MovieEngine extends MediaController {
  tracks: EngineTrack[] = [];
  private observer: ResizeObserver;
  private captions = -1;
  constructor(readonly surface: HTMLDivElement) {
    const raw = new window.AVPlayer({ container: surface, wasmBaseUrl: '/vendor/libmedia/wasm', enableWorker: true, enableHardware: true, enableWebCodecs: true, enableWebGPU: false, checkUseMSE: () => false, preLoadTime: 2, enableJitterBuffer: false });
    super(raw); this.raw = raw; surface.classList.add('captions-off');
    raw.on('time', () => { if (!this.disposed) this.dispatchEvent(new Event('timeupdate')); });
    raw.on('ended', () => { if (!this.disposed) { this.pause(); this.dispatchEvent(new Event('ended')); } });
    raw.on('error', error => { if (!this.disposed) { this.failure = error instanceof Error ? error.message : 'Decoder failed. Try reconnecting the movie.'; this.pause(); this.dispatchEvent(new Event('error')); } });
    this.observer = new ResizeObserver(entries => { const box = entries[0]?.contentRect; if (box && raw.getStatus() >= 4 && !this.disposed) raw.resize(Math.round(box.width), Math.round(box.height)); }); this.observer.observe(surface);
  }
  private raw: AVDriver;
  get selectedAudio() { return this.raw.getSelectedAudioStreamId(); }
  get selectedCaption() { return this.captions; }
  override async selectSubtitle(id: number) {
    await super.selectSubtitle(id);
    if (id >= 0 && this.enabled && this.raw.getSelectedSubtitleStreamId() !== id) throw new Error('The decoder could not select this embedded subtitle track.');
    this.captions = id; this.surface.classList.toggle('captions-off',id < 0); this.dispatchEvent(new Event('trackschange'));
  }
  async load(file: File) {
    await this.raw.load(file);
    if (this.disposed) return;
    this.duration = Number(this.raw.getDuration()) / 1000;
    if (!Number.isFinite(this.duration) || this.duration <= 0) throw new Error('The movie has no usable duration.');
    this.tracks = this.raw.getStreams().map(stream => {
      const language = typeof stream.metadata.language === 'string' ? stream.metadata.language : '';
      const title = typeof stream.metadata.title === 'string' ? stream.metadata.title : '';
      const kind=stream.mediaType.replace(/^AVMEDIA_TYPE_/,'').toLowerCase();
      let languageName=language;
      try { if (language && language !== 'und') languageName=new Intl.DisplayNames(['en'],{type:'language'}).of(language)||language; } catch { /* Keep the file's original language tag. */ }
      return { id: stream.id, label: [title, languageName === 'und' ? '' : languageName].filter(Boolean).join(' · ') || `${kind} ${stream.id + 1}`, kind };
    });
    await this.selectSubtitle(-1);
    this.dispatchEvent(new Event('loadedmetadata')); this.dispatchEvent(new Event('trackschange'));
  }
  async destroy() { this.disposed = true; this.observer.disconnect(); try { await this.settled(); } catch { /* Preserve the original decoder error. */ } await this.raw.destroy(); }
}

/** Probe the container, including MKV, using the same demuxer used for playback. */
export async function movieDuration(file: File) {
  const surface = document.createElement('div'); const probe = new MovieEngine(surface);
  try { await probe.load(file); return Math.round(probe.duration * 1000); } finally { await probe.destroy(); }
}
