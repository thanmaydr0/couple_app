/** Movie playback tolerates small clock differences instead of interrupting frames. */
export class PlaybackSmoother {
  private settleUntil = 0;
  private sampledAt = -Infinity;
  private largeSince: number | null = null;
  private direction = 0;
  private rate = 1;

  reset(now: number) {
    this.settleUntil = Math.max(this.settleUntil, now + 5000);
    this.sampledAt = now;
    this.largeSince = null;
    this.direction = 0;
    this.rate = 1;
  }

  correction(drift: number, now: number): { seek: boolean; rate: number } {
    if (now < this.settleUntil) return { seek: false, rate: 1 };
    if (now - this.sampledAt < 1000) return { seek: false, rate: this.rate };
    this.sampledAt = now;
    const magnitude = Math.abs(drift);
    const direction = Math.sign(drift);
    if (magnitude > 4) {
      if (this.largeSince === null || direction !== this.direction) this.largeSince = now;
      if (now - this.largeSince >= 8000) {
        this.reset(now);
        // A hard correction needs time to refill and settle before another one.
        this.settleUntil = now + 15000;
        return { seek: true, rate: 1 };
      }
    } else this.largeSince = null;
    if (magnitude <= 0.3 || direction !== this.direction) this.rate = 1;
    if (magnitude > 0.75) this.rate = direction > 0 ? 1.01 : 0.99;
    this.direction = direction;
    return { seek: false, rate: this.rate };
  }
}
