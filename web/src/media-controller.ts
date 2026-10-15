export interface MediaDriver {
  readonly currentTime: bigint;
  getStatus(): number;
  play(): Promise<void>; pause(): Promise<void>; seek(time: bigint): Promise<void>;
  selectAudio(id: number): Promise<void>; selectSubtitle(id: number): Promise<void>;
  getSelectedSubtitleStreamId?(): number;
  setSubtitleEnable(enabled: boolean): void; setPlaybackRate(rate: number): void; setVolume(volume: number): void;
}

/** One async operation at a time. New seeks replace queued seeks, never fight them. */
export class MediaController extends EventTarget {
  enabled = false;
  disposed = false;
  duration = 0;
  private desiredPlay = false;
  private appliedPlay = false;
  private target: number | null = null;
  private pendingSeek: number | null = null;
  private audio: number | null = null;
  private subtitle: number | null = null;
  private captionEnabled = false;
  private rate = 1; private appliedRate = 1;
  private loudness = 1; private appliedVolume = 1;
  private task: Promise<void> | null = null;
  failure: string | null = null;
  constructor(protected driver: MediaDriver) { super(); }
  get paused() { return !this.desiredPlay; }
  get playing() { return this.desiredPlay; }
  get busy() { return !!this.task; }
  get currentTime() { return this.target ?? Number(this.driver.currentTime) / 1000; }
  set currentTime(value: number) {
    if (!Number.isFinite(value)) return;
    const target = Math.max(0, Math.min(value, this.duration ? Math.max(0,this.duration-0.001) : value));
    if (this.target !== null && Math.abs(this.target - target) < 0.1) return;
    this.target = target; this.pendingSeek = target; this.dispatchEvent(new Event('timeupdate')); this.kick();
  }
  get playbackRate() { return this.rate; }
  set playbackRate(value: number) { if (Number.isFinite(value) && value > 0 && value !== this.rate) { this.rate = value; this.kick(); } }
  get volume() { return this.loudness; }
  set volume(value: number) { this.loudness = Math.max(0, Math.min(1,value)); this.kick(); }
  play() { if (!this.desiredPlay) { this.desiredPlay = true; this.kick(); } }
  pause() { if (this.desiredPlay) { this.desiredPlay = false; this.dispatchEvent(new Event('pause')); this.kick(); } }
  selectAudio(id: number) { this.audio = id; this.kick(); return this.settled(); }
  selectSubtitle(id: number) { this.subtitle = id; this.kick(); return this.settled(); }
  async enable() {
    if (this.enabled || this.disposed) return;
    // Initialize decoders/audio context under the explicit user gesture.
    await this.driver.play(); await this.driver.pause();
    this.enabled = true; this.appliedPlay = false; this.kick(); await this.settled();
  }
  async settled() { while (this.task) await this.task; if (this.failure) throw new Error(this.failure); }
  private kick() {
    if (!this.enabled || this.disposed || this.task || this.failure) return;
    this.task = this.drain().catch(error => {
      this.failure = error instanceof Error ? error.message : 'Media operation failed'; this.desiredPlay = false;
      this.dispatchEvent(new Event('error'));
    }).finally(() => {
      this.task = null; this.dispatchEvent(new Event('statechange'));
      if (this.pendingSeek !== null || this.audio !== null || this.subtitle !== null || this.appliedPlay !== this.desiredPlay || this.appliedRate !== this.rate || this.appliedVolume !== this.loudness) this.kick();
    });
  }
  private async drain() {
    while (!this.disposed) {
      if (this.pendingSeek !== null) {
        const position = this.pendingSeek; this.pendingSeek = null;
        await this.driver.seek(BigInt(Math.round(position * 1000)));
        if (!this.captionEnabled) this.driver.setSubtitleEnable(false);
        if (this.pendingSeek === null) this.target = null;
        this.appliedPlay = [5,6].includes(this.driver.getStatus());
        this.dispatchEvent(new Event('timeupdate')); continue;
      }
      if (this.audio !== null) {
        const id = this.audio; this.audio = null; await this.driver.selectAudio(id);
        this.appliedPlay = [5,6].includes(this.driver.getStatus()); this.dispatchEvent(new Event('trackschange')); continue;
      }
      if (this.subtitle !== null) {
        const id = this.subtitle; this.subtitle = null;
        if (id >= 0) {
          if (this.driver.getSelectedSubtitleStreamId?.() !== id) await this.driver.selectSubtitle(id);
          // Flush cues queued from the old stream, retaining the local position.
          await this.driver.seek(this.driver.currentTime);
          this.appliedPlay = [5,6].includes(this.driver.getStatus());
        }
        this.captionEnabled = id >= 0;
        if (!this.captionEnabled) this.driver.setSubtitleEnable(false); this.dispatchEvent(new Event('trackschange')); continue;
      }
      if (this.appliedRate !== this.rate) { this.driver.setPlaybackRate(this.rate); this.appliedRate = this.rate; continue; }
      if (this.appliedVolume !== this.loudness) { this.driver.setVolume(this.loudness); this.appliedVolume = this.loudness; continue; }
      if (this.appliedPlay !== this.desiredPlay) {
        const play = this.desiredPlay;
        if (play) await this.driver.play(); else await this.driver.pause();
        if (!this.captionEnabled) this.driver.setSubtitleEnable(false);
        this.appliedPlay = play; this.dispatchEvent(new Event(play ? 'playing' : 'pause')); continue;
      }
      break;
    }
  }
}
