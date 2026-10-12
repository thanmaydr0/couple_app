import { compare, driftCorrection, packet, reactions, type EventName, type Packet, type Stamp } from './model';

export interface Playback {
  currentTime: number; playbackRate: number; readonly playing: boolean; readonly duration: number;
  play(): void; pause(): void;
}
export type SyncState = { connected: boolean; partnerHere: boolean; bothReady: boolean; latency: number; drift: number; ended: boolean; notice: string };
type Options = {
  user: string; partner: string; host: string; client: string; player: Playback;
  send(event: EventName, payload: Packet): void; change(state: SyncState): void;
  reaction(emoji: string): void; now?: () => number;
};

/** Only explicit controls broadcast transport actions. Native play/seek callbacks
 * never rebroadcast a remote action, so decoder callbacks cannot form an echo loop. */
export class WatchSync {
  state: SyncState = { connected: false, partnerHere: false, bothReady: false, latency: 0, drift: 0, ended: false, notice: 'Connecting…' };
  private ready = false;
  private peerReady = false;
  private foreground = true;
  private desired = false;
  private resume = false;
  private stamp: Stamp = { counter: 0, actor: '' };
  private authority: string;
  private seq = 0;
  private seen = new Map<string, number>();
  private pings = new Map<string, number>();
  private samples: { latency: number; offset: number }[] = [];
  private offset = 0;
  private peerAt = 0;
  private lastPing = -Infinity;
  private lastBeat = -Infinity;
  private lastMovement = 0;
  private previousPos = -1;
  private resumePos = 0;
  private ignoreUntil = 0;
  private reference: { pos: number; at: number } | null = null;
  private now: () => number;
  constructor(private o: Options) { this.authority = o.host; this.now = o.now ?? Date.now; }
  private update(notice?: string) {
    this.state = { ...this.state, bothReady: this.ready && this.peerReady && this.state.partnerHere && this.state.connected && this.foreground,
      ...(notice === undefined ? {} : { notice }) };
    this.o.change(this.state);
  }
  private emit(event: EventName, extra: Partial<Packet> = {}) {
    if (!this.state.connected || this.state.ended) return;
    this.o.send(event, { sender: this.o.user, client: this.o.client, seq: ++this.seq, sentAt: this.now(),
      pos: this.o.player.currentTime, playing: this.desired, ready: this.ready && this.foreground,
      stamp: this.stamp, resume: this.resume, ...extra });
  }
  private pauseNative() { this.ignoreUntil = this.now() + 1500; this.o.player.pause(); this.o.player.playbackRate = 1; }
  private seekNative(pos: number, userAction = true) {
    if (userAction) { this.ignoreUntil = this.now() + 1500; this.lastMovement = this.now(); }
    this.o.player.currentTime = Math.max(0, Math.min(pos, this.o.player.duration || pos));
    this.previousPos = this.o.player.currentTime;
  }
  private nextStamp() { this.stamp = { counter: this.stamp.counter + 1, actor: this.o.client }; this.authority = this.o.user; }
  connect(value: boolean) {
    this.state.connected = value;
    if (!value) { this.desired = false; this.resume = false; this.peerReady = false; this.pauseNative(); }
    this.update(value ? 'Waiting for your partner…' : 'Connection lost. Both must reconnect before playing.');
    if (value) { this.peerReady = false; this.state.partnerHere = false; this.lastBeat = -Infinity; this.lastPing = -Infinity; this.emit('ready'); this.tick(); }
  }
  setReady(value: boolean) {
    const changed = this.ready !== value;
    if (!value && this.desired) this.stall();
    this.ready = value; this.update();
    if (changed) this.emit('ready');
    this.maybeResume();
  }
  setForeground(value: boolean) {
    this.foreground = value;
    if (!value) { this.control('pause'); this.emit('leave'); this.peerReady = false; }
    else { this.emit('ready'); this.lastPing = -Infinity; }
    this.update(value ? 'Back together? Wait for both ready, then play.' : 'Paused while the app is in the background.');
  }
  private stall() {
    this.resume = this.desired || this.resume; this.resumePos = this.o.player.currentTime;
    this.desired = false; this.ready = false; this.nextStamp(); this.pauseNative();
    this.emit('pause', { resume: this.resume, ready: false }); this.update('Buffering — both paused. Resuming when both are ready.');
  }
  private maybeResume() {
    this.update();
    // One coordinator avoids simultaneous auto-resume commands. Either can manually play.
    if (this.resume && this.state.bothReady && this.o.user === this.o.host) this.control('play', this.resumePos);
  }
  control(event: 'play' | 'pause' | 'seek', position = this.o.player.currentTime) {
    if (this.state.ended) return;
    if (event !== 'pause' && !this.state.bothReady) { this.update('Both partners must be connected and ready first.'); return; }
    this.nextStamp(); this.resume = false;
    if (event === 'play') this.desired = true;
    if (event === 'pause') this.desired = false;
    this.seekNative(position);
    if (this.desired) { this.o.player.playbackRate = 1; this.o.player.play(); } else this.pauseNative();
    this.emit(event); this.update(this.desired ? 'Watching together' : 'Paused together');
  }
  unexpectedPause() {
    if (this.desired && this.now() > this.ignoreUntil) this.control('pause');
  }
  reaction(emoji: string) { if (reactions.some(r => r === emoji)) { this.emit('reaction', { emoji }); this.o.reaction(emoji); } }
  leave() { this.desired = false; this.resume = false; this.pauseNative(); this.emit('leave'); }
  end(broadcast = true) {
    this.desired = false; this.resume = false; this.pauseNative();
    if (broadcast) this.emit('end');
    this.state.ended = true; this.update('Session ended. Your local file and saved position are kept.');
  }
  private ping() {
    const t0 = this.now(); const pingId = `${this.o.client}:${++this.seq}`;
    this.pings.set(pingId, t0); this.lastPing = t0;
    this.emit('ping', { pingId, t0 });
  }
  private age(p: Packet) {
    // NTP-style offset is peer clock minus local clock. RTT/2 works before calibration.
    return this.samples.length ? Math.max(0, Math.min(2000, this.now() - (p.sentAt - this.offset))) / 1000 : this.state.latency / 1000;
  }
  receive(event: EventName, value: unknown) {
    if (!packet(value) || value.sender !== this.o.partner || value.client === this.o.client || this.state.ended) return;
    const p = value;
    if (p.seq <= (this.seen.get(p.client) ?? -1)) return;
    this.seen.set(p.client, p.seq); this.peerAt = this.now();
    const wasHere = this.state.partnerHere; this.state.partnerHere = event !== 'leave';
    this.peerReady = p.ready && event !== 'leave';
    if (event === 'ping' && typeof p.t0 === 'number' && p.pingId) {
      this.emit('pong', { pingId: p.pingId, t0: p.t0, t1: this.now(), t2: this.now() });
    }
    if (event === 'pong' && p.pingId && typeof p.t1 === 'number' && typeof p.t2 === 'number') {
      const t0 = this.pings.get(p.pingId);
      if (t0 !== undefined) {
        this.pings.delete(p.pingId);
        const rtt = this.now() - t0 - (p.t2 - p.t1);
        if (rtt >= 0 && rtt < 4000) {
          this.samples.push({ latency: rtt / 2, offset: ((p.t1 - t0) + (p.t2 - this.now())) / 2 });
          this.samples = this.samples.slice(-8);
          const best = this.samples.reduce((a, b) => a.latency < b.latency ? a : b);
          this.state.latency = best.latency; this.offset = best.offset;
        }
      }
    }
    if (event === 'end') { this.end(false); return; }
    if (event === 'reaction' && p.emoji && reactions.some(r => r === p.emoji)) this.o.reaction(p.emoji);
    if (event === 'leave') {
      this.desired = false; this.resume = false; this.pauseNative(); this.update('Partner left. Return to this session when they are back.'); return;
    }
    const order = compare(p.stamp, this.stamp);
    if (['play', 'pause', 'seek', 'heartbeat', 'ready'].includes(event) && order >= 0) {
      if (order > 0) { this.stamp = p.stamp; this.authority = p.sender; }
      // The host owns the initial resume point; thereafter the last controller leads.
      const authoritative = this.authority === p.sender;
      if (authoritative && (order > 0 || event === 'heartbeat' || event === 'ready')) {
        this.resume = p.resume; this.resumePos = p.pos;
        this.desired = p.playing && this.ready && this.foreground && this.peerReady && this.state.connected;
        const target = p.pos + (p.playing ? this.age(p) : 0);
        this.reference = p.playing ? { pos: target, at: this.now() } : null;
        this.state.drift = target - this.o.player.currentTime;
        if (event === 'play' || event === 'seek' || (!p.playing && Math.abs(this.state.drift) > 0.02)) this.seekNative(target);
        else if (this.desired) {
          const correction = driftCorrection(this.state.drift);
          if (correction.seek) this.seekNative(target, false);
          this.o.player.playbackRate = correction.seek ? 1 : correction.rate;
        }
        if (this.desired) this.o.player.play(); else this.pauseNative();
      }
    }
    if (!this.peerReady && this.desired) { this.resume = true; this.resumePos = p.pos; this.desired = false; this.pauseNative(); }
    this.update(event === 'pause' ? (p.resume ? 'Partner is buffering — both paused' : 'Partner is paused') : event === 'seek' ? 'Partner is seeking' : event === 'play' ? 'Watching together' : undefined);
    if (!wasHere) { this.emit('ready'); this.ping(); }
    this.maybeResume();
  }
  tick() {
    if (this.state.ended) return;
    const now = this.now();
    if (this.state.connected && this.foreground && now - this.lastBeat >= 4000) { this.lastBeat = now; this.emit('heartbeat'); }
    if (this.state.connected && this.foreground && now - this.lastPing >= 30000) this.ping();
    for (const [id, sent] of this.pings) if (now - sent > 10000) this.pings.delete(id);
    if (this.state.partnerHere && now - this.peerAt > 12000) {
      this.state.partnerHere = false; this.peerReady = false; this.desired = false; this.resume = false;
      this.pauseNative(); this.update('Partner disconnected. Your position is saved; return here to continue.');
    }
    if (this.reference && this.authority !== this.o.user && this.desired && this.ready && this.peerReady) {
      const target = this.reference.pos + (now - this.reference.at) / 1000;
      this.state.drift = target - this.o.player.currentTime;
      const correction = driftCorrection(this.state.drift);
      if (correction.seek) this.seekNative(target, false);
      this.o.player.playbackRate = correction.seek ? 1 : correction.rate;
    }
    const pos = this.o.player.currentTime;
    if (Math.abs(pos - this.previousPos) > 0.02 || !this.desired) { this.lastMovement = now; this.previousPos = pos; }
    else if (now - this.lastMovement > 3000 && now > this.ignoreUntil) this.stall();
    this.update();
  }
}
