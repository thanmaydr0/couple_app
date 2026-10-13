import { validVideoId } from './links';
import { reactions, timing, type Command, type PlayerSnapshot } from './types';
export type SyncView = { connected: boolean; partnerHere: boolean; bothReady: boolean; playing: boolean; notice: string; latency: number; drift: number };
export const initialSync: SyncView = { connected: false, partnerHere: false, bothReady: false, playing: false, notice: 'Connecting…', latency: 0, drift: 0 };
type Packet = { sender: string; client: string; seq: number; at: number; videoId: string; pos: number; state: number; ready: boolean; desired: boolean; counter: number; actor: string; rate: number; t0?: number; t1?: number; t2?: number; emoji?: string };
type Options = { user: string; partner: string; host: string; client: string; videoId: string; autoStart?: boolean; send(event: string, packet: Packet): void; command(command: Command): void; change(view: SyncView): void; reaction(emoji: string): void; ended(): void; now?: () => number };
const transport = ['play', 'pause', 'seek', 'rate', 'load'];
function packet(value: unknown): value is Packet {
  if (!value || typeof value !== 'object') return false;
  const p = value as Partial<Packet>;
  return typeof p.sender === 'string' && typeof p.client === 'string' && validVideoId(p.videoId) && Number.isSafeInteger(p.seq) && Number.isSafeInteger(p.counter) && typeof p.actor === 'string' && typeof p.ready === 'boolean' && typeof p.desired === 'boolean' && [p.at, p.pos, p.state, p.rate].every(n => typeof n === 'number' && Number.isFinite(n)) && (p.pos ?? -1) >= 0 && (p.rate ?? 0) > 0 && (p.rate ?? 3) <= 2;
}
export class YouTubeSync {
  view = { ...initialSync };
  snapshot: PlayerSnapshot = { pos: 0, state: -1, duration: 0, rates: [1] };
  private ready = false;
  private peerReady = false;
  private peerState = -1;
  private foreground = true;
  private desired = false;
  private recovery = false;
  private seq = 0;
  private counter = 0;
  private actor = '';
  private authority: string;
  private peerAt = 0;
  private lastBeat = -Infinity;
  private lastPing = -Infinity;
  private probeAt = 0;
  private bufferingAt = 0;
  private commandedAt = 0;
  private rate = 1;
  private appliedRate = 1;
  private nudgeUntil = 0;
  private lastNudge = -Infinity;
  private seen = new Map<string, number>();
  private pending = new Map<number, number>();
  private samples: { latency: number; offset: number }[] = [];
  private reference: { pos: number; at: number } | null = null;
  private lastReaction = -Infinity;
  private sent: number[] = [];
  private autoPending: boolean;
  private now: () => number;
  constructor(private o: Options) { this.authority = o.host; this.now = o.now ?? Date.now; this.autoPending = !!o.autoStart; }
  private update() {
    this.view = { ...this.view, bothReady: this.ready && this.peerReady && this.view.connected && this.view.partnerHere && this.foreground,
      playing: this.desired && this.snapshot.state === 1 && this.peerState === 1 };
    if (this.view.playing) this.view.notice = 'Watching together';
    this.o.change({ ...this.view });
  }
  private command(action: Command['action'], value?: number) { this.commandedAt = this.now(); this.o.command({ action, value }); }
  private emit(event: string, extra: Partial<Packet> = {}) {
    if (!this.foreground || !this.view.connected || !this.view.partnerHere) return;
    this.sent = this.sent.filter(at => this.now() - at < 1000);
    if (this.sent.length >= 15) return;
    this.sent.push(this.now());
    this.o.send(event, { sender: this.o.user, client: this.o.client, seq: ++this.seq, at: this.now(), videoId: this.o.videoId,
      pos: this.snapshot.pos, state: this.snapshot.state, ready: this.ready, desired: this.desired, counter: this.counter, actor: this.actor, rate: this.rate, ...extra });
  }
  connect(connected: boolean) {
    this.view.connected = connected;
    if (connected && this.autoPending) { this.desired = true; this.recovery = true; this.autoPending = false; }
    if (!connected) { this.desired = false; this.recovery = false; this.peerReady = false; this.view.partnerHere = false; this.command('pause'); }
    this.view.notice = connected ? 'Waiting for them…' : 'Offline — playback paused. Reconnect to continue.'; this.update();
  }
  presence(present: boolean) {
    const changed = this.view.partnerHere !== present;
    this.view.partnerHere = present;
    if (present && changed) { this.peerAt = this.now(); this.lastBeat = -Infinity; this.lastPing = -Infinity; this.emit('ready'); }
    if (!present) { this.peerReady = false; this.peerState = -1; this.desired = false; this.recovery = false; this.command('pause'); this.view.notice = 'Waiting for them…'; }
    this.update();
  }
  foregroundState(active: boolean) {
    if (!active) { this.control('pause'); this.emit('leave'); }
    this.foreground = active;
    if (!active) { this.ready = false; this.peerReady = false; this.command('pause'); }
    else { this.ready = [1, 2, 5].includes(this.snapshot.state); this.lastBeat = -Infinity; this.emit('ready'); }
    this.update();
  }
  loaded() { this.ready = true; this.bufferingAt = 0; this.emit('load'); this.emit('ready'); this.update(); this.resume(); }
  failure(message: string) { this.control('pause'); this.ready = false; this.emit('buffering'); this.view.notice = message; this.update(); }
  sample(snapshot: PlayerSnapshot) {
    const previous = this.snapshot.state;
    this.snapshot = snapshot;
    if (snapshot.state === 3 && previous !== 3) {
      this.ready = false; this.bufferingAt = this.now(); this.recovery = this.desired || this.recovery;
      this.command('pause'); this.emit('buffering'); this.view.notice = 'Waiting for them… Buffering or an ad.';
    } else if ([1, 2, 5].includes(snapshot.state)) {
      const changed = !this.ready; this.ready = true;
      if (changed || previous !== snapshot.state) this.emit('ready');
      // YouTube's own tap-to-play UI can still emit state changes. Treat these as
      // controls only outside the command acknowledgement window.
      if (this.now() - this.commandedAt > 1500 && !this.recovery && previous !== snapshot.state) {
        if (snapshot.state === 1 && !this.desired) this.control('play');
        if (snapshot.state === 2 && this.desired) this.control('pause');
      }
    }
    if (snapshot.state === 0 && previous !== 0) {
      this.desired = false; this.recovery = false; this.emit('ended');
      if (this.o.user === this.o.host) this.o.ended();
    }
    this.update(); this.resume();
  }
  private resume() {
    if (this.recovery && this.view.bothReady && this.o.user === this.o.host && this.now() - this.probeAt > 2000) {
      this.probeAt = this.now(); this.control('play');
    }
    if (this.view.playing) { this.recovery = false; this.bufferingAt = 0; }
  }
  control(event: 'play' | 'pause' | 'seek' | 'rate', value = this.snapshot.pos) {
    if (event !== 'pause' && !this.view.bothReady) { this.command('pause'); this.view.notice = 'Waiting for them… Both players must be ready.'; this.update(); return; }
    this.counter++; this.actor = this.o.client; this.authority = this.o.user; this.reference = null;
    if (event === 'play') { this.desired = true; this.command('play'); this.probeAt = this.now(); this.view.notice = 'Waiting for them… Starting both players.'; }
    if (event === 'pause') { this.desired = false; this.recovery = false; this.bufferingAt = 0; this.command('pause'); this.view.notice = 'Paused together'; }
    if (event === 'seek') { value = Math.max(0, Math.min(value, this.snapshot.duration || value)); this.command('seek', value); }
    if (event === 'rate') { if (!this.snapshot.rates.includes(value)) return; this.rate = value; this.appliedRate = value; this.command('rate', value); }
    this.emit(event, event === 'seek' ? { pos: value } : {}); this.update();
  }
  reaction(emoji: string) {
    if (!reactions.some(r => r === emoji) || this.now() - this.lastReaction < timing.reaction || !this.view.partnerHere) return;
    this.lastReaction = this.now(); this.o.reaction(emoji); this.emit('reaction', { emoji });
  }
  receive(event: string, value: unknown) {
    if (!this.foreground || !this.view.connected || !packet(value)) return;
    const p = value;
    if (p.sender !== this.o.partner || p.client === this.o.client || p.videoId !== this.o.videoId || p.seq <= (this.seen.get(p.client) ?? 0)) return;
    this.seen.set(p.client, p.seq); this.peerAt = this.now(); this.view.partnerHere = event !== 'leave'; this.peerReady = p.ready; this.peerState = p.state;
    if (event === 'leave') { this.presence(false); return; }
    if (event === 'ping' && typeof p.t0 === 'number') this.emit('pong', { t0: p.t0, t1: this.now(), t2: this.now() });
    if (event === 'pong' && typeof p.t0 === 'number' && typeof p.t1 === 'number' && typeof p.t2 === 'number' && this.pending.has(p.t0)) {
      this.pending.delete(p.t0); const rtt = this.now() - p.t0 - (p.t2 - p.t1);
      if (rtt >= 0 && rtt < 4000) {
        this.samples.push({ latency: rtt / 2, offset: ((p.t1 - p.t0) + (p.t2 - this.now())) / 2 }); this.samples = this.samples.slice(-8);
        this.view.latency = Math.min(...this.samples.map(s => s.latency));
      }
    }
    if (event === 'reaction' && reactions.some(r => r === p.emoji)) this.o.reaction(p.emoji!);
    const comparison = p.counter - this.counter || p.actor.localeCompare(this.actor);
    if (transport.includes(event) && event !== 'load' && comparison > 0) {
      this.counter = p.counter; this.actor = p.actor; this.authority = p.sender; this.rate = p.rate; this.appliedRate = p.rate;
      this.desired = p.desired; this.reference = null;
      if (event === 'seek') this.command('seek', p.pos);
      if (event === 'rate') this.command('rate', p.rate);
      if (event === 'pause') { this.recovery = false; this.command('pause'); this.view.notice = 'Paused together'; }
      if (event === 'play') { if (this.ready) this.command('play'); this.probeAt = this.now(); this.view.notice = 'Waiting for them… Starting both players.'; }
    }
    if (event === 'buffering') {
      this.peerReady = false; this.recovery = this.desired || p.desired || this.recovery; this.bufferingAt ||= this.now(); this.command('pause'); this.view.notice = 'Waiting for them… Buffering or an ad.';
    }
    if (event === 'heartbeat' && (this.authority === p.sender || comparison > 0) && comparison >= 0) {
      this.authority = p.sender;
      this.counter = p.counter; this.actor = p.actor;
      const best = [...this.samples].sort((a, b) => a.latency - b.latency)[0];
      const age = best ? Math.max(0, Math.min(2000, this.now() - (p.at - best.offset))) / 1000 : this.view.latency / 1000;
      this.reference = { pos: p.pos + (p.state === 1 ? age * p.rate : 0), at: this.now() };
      // Heartbeats also repair a dropped control packet.
      if (p.desired !== this.desired) {
        this.desired = p.desired;
        if (this.desired && this.ready && this.peerReady) this.command('play'); else this.command('pause');
      }
      this.rate = p.rate;
    }
    if (!p.ready && this.desired && event !== 'ended') {
      this.recovery = true; this.bufferingAt ||= this.now(); this.command('pause'); this.view.notice = 'Waiting for them… Buffering or an ad.';
    }
    if (event === 'ended' && this.o.user === this.o.host) this.o.ended();
    this.update(); this.resume();
  }
  tick() {
    if (!this.foreground || !this.view.connected || !this.view.partnerHere) return;
    const now = this.now();
    if (this.nudgeUntil && now >= this.nudgeUntil) { this.command('rate', this.rate); this.appliedRate = this.rate; this.nudgeUntil = 0; }
    if (!this.nudgeUntil && this.appliedRate !== this.rate) { this.command('rate', this.rate); this.appliedRate = this.rate; }
    if (now - this.peerAt > timing.timeout) { this.presence(false); return; }
    if (now - this.lastBeat >= timing.heartbeat) { this.lastBeat = now; this.emit('heartbeat'); }
    if (now - this.lastPing >= timing.ping) { this.lastPing = now; this.pending.set(now, now); this.emit('ping', { t0: now }); }
    for (const [id, at] of this.pending) if (now - at > timing.timeout) this.pending.delete(id);
    if ((this.bufferingAt && now - this.bufferingAt > timing.prepare) || (this.desired && !this.view.playing && !this.recovery && now - this.probeAt > timing.prepare)) {
      this.control('pause'); this.view.notice = 'Playback could not start together. Tap Play to retry or skip this video.';
    }
    if (this.reference && this.desired && !this.recovery && this.view.bothReady && this.snapshot.state === 1 && this.peerState === 1 && this.authority !== this.o.user) {
      const target = this.reference.pos + (now - this.reference.at) / 1000 * this.rate;
      this.view.drift = target - this.snapshot.pos;
      if (Math.abs(this.view.drift) > 1) { this.command('seek', target); this.reference = null; }
      else {
        // YouTube rounds 1.03 back to 1. Use a short pulse at the nearest
        // supported rate instead, restoring the user's rate on the next tick.
        const candidates = this.snapshot.rates.filter(r => this.view.drift > 0 ? r > this.rate : r < this.rate).sort((a, b) => Math.abs(a - this.rate) - Math.abs(b - this.rate));
        const supported = candidates[0];
        if (supported && Math.abs(this.view.drift) > 0.2 && !this.nudgeUntil && now - this.lastNudge >= 2000) {
          this.command('rate', supported); this.appliedRate = supported; this.nudgeUntil = now + timing.sample; this.lastNudge = now;
        }
      }
    }
    this.update(); this.resume();
  }
}
