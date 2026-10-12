import { AppState, DeviceEventEmitter } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import { mediaDevices, RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, MediaStream, type MediaStreamTrack } from 'react-native-webrtc';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { CallKind, CallRow, CallStatus } from '@/types/db';
import { clearIceCache, iceServers, requestCallPermissions } from './media';
import { requestBluetoothRouting } from './notifications';
import { EVENTS, freshInvite, initialState, parseSignal, RING_MS, type CallState, type Candidate, type Description, type Signal, type SignalEvent } from './types';

export const useCalls = create<CallState>(() => ({ ...initialState }));
const set = (patch: Partial<CallState>) => useCalls.setState(patch);
// The installed library's EventTarget base declaration loses these methods
// under RN's TS config. Describe only the native events used by this feature.
type PeerEvents = {
  icecandidate: { candidate: RTCIceCandidate | null };
  track: { streams: MediaStream[]; track: MediaStreamTrack | null };
  connectionstatechange: unknown; iceconnectionstatechange: unknown;
};
type NativePeer = RTCPeerConnection & {
  addEventListener<K extends keyof PeerEvents>(event: K, listener: (value: PeerEvents[K]) => void): void;
};
let currentEngine: CallEngine | undefined;
export async function startCall(kind: CallKind): Promise<void> {
  if (!currentEngine) { set({ error: 'Sign in and pair with your partner before calling.' }); return; }
  await currentEngine.start(kind);
}
export function getCallEngine() { return currentEngine; }
export function attachEngine(engine: CallEngine) { currentEngine = engine; }
export function detachEngine(engine: CallEngine) { if (currentEngine === engine) currentEngine = undefined; }

export class CallEngine {
  private channel: RealtimeChannel | undefined;
  private pc: NativePeer | undefined;
  private local: MediaStream | undefined;
  private call: CallRow | undefined;
  private preparing = false;
  private disposed = false;
  private generation = 0;
  private accepting = false;
  private pendingIce: Candidate[] = [];
  private queue: Promise<void> = Promise.resolve();
  private ringTimer: ReturnType<typeof setTimeout> | undefined;
  private connectTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setInterval> | undefined;
  private recoveryTimer: ReturnType<typeof setInterval> | undefined;
  private appSubscription: ReturnType<typeof AppState.addEventListener> | undefined;
  private audioSubscription: ReturnType<typeof DeviceEventEmitter.addListener> | undefined;
  private recovering = false;
  private offered = false;
  private offerBusy = false;
  private backgroundCamera = false;
  constructor(readonly uid: string, readonly coupleId: string, readonly partnerId: string) {}

  mount() {
    const channel = supabase.channel(`call:${this.coupleId}`, { config: { private: true, broadcast: { ack: true, self: false } } });
    this.channel = channel;
    for (const event of EVENTS) channel.on('broadcast', { event }, ({ payload }: { payload: unknown }) => {
      const signal = parseSignal(payload);
      if (!signal || signal.from !== this.partnerId || signal.to !== this.uid || signal.coupleId !== this.coupleId) return;
      // Terminal messages must interrupt pending permission/media operations immediately.
      if (['cancel', 'decline', 'end', 'busy'].includes(event)) { void this.receive(event, signal).catch((e: unknown) => this.fail(e)); return; }
      this.queue = this.queue.then(() => this.receive(event, signal)).catch((e: unknown) => { if (this.call?.id === signal.id) this.fail(e); });
    });
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'calls', filter: `couple_id=eq.${this.coupleId}` }, () => { void this.recover(); });
    channel.subscribe((status) => {
      if (this.disposed) return;
      set({ ready: status === 'SUBSCRIBED' });
      if (status === 'SUBSCRIBED') { void this.recover(); if (this.pc && useCalls.getState().phase === 'reconnecting') void this.restart(); }
    });
    this.appSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (this.backgroundCamera && useCalls.getState().camera) this.local?.getVideoTracks().forEach((t) => { t.enabled = true; });
        this.backgroundCamera = false;
        void this.recover();
      } else if (this.local) {
        // Keep microphone/peer/signaling alive; pause video for Android camera privacy.
        this.backgroundCamera = true;
        this.local.getVideoTracks().forEach((t) => { t.enabled = false; });
      }
    });
    this.audioSubscription = DeviceEventEmitter.addListener('onAudioDeviceChanged', (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if ('selectedAudioDevice' in value && typeof value.selectedAudioDevice === 'string') set({ route: value.selectedAudioDevice });
      if ('availableAudioDeviceList' in value && typeof value.availableAudioDeviceList === 'string') {
        try {
          const routes: unknown = JSON.parse(value.availableAudioDeviceList);
          if (Array.isArray(routes) && routes.every((r: unknown) => typeof r === 'string')) set({ routes });
        } catch { /* Ignore malformed native event. */ }
      }
    });
    // Also recovers missed broadcast delivery and a push cold start before subscription.
    this.recoveryTimer = setInterval(() => { void this.recover(); }, 4_000);
  }

  private alive(call: CallRow) { return !this.disposed && this.call?.id === call.id; }
  private async send(event: SignalEvent, call: CallRow, extra: Partial<Pick<Signal, 'description' | 'candidate' | 'restart'>> = {}) {
    if (this.disposed || !this.channel) return;
    const result = await this.channel.send({ type: 'broadcast', event, payload: {
      id: call.id, from: this.uid, to: this.partnerId, coupleId: this.coupleId,
      kind: call.kind, sentAt: Date.now(), ...extra,
    } satisfies Signal });
    if (result !== 'ok') throw new Error('Call signaling is unavailable. Check your connection and try again.');
  }

  private armRing(call: CallRow) {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = setTimeout(() => {
      if (this.alive(call) && ['incoming', 'outgoing'].includes(useCalls.getState().phase)) {
        void this.finish('missed', call.caller_id === this.uid ? 'cancel' : 'end', 'Call missed');
      }
    }, Math.max(0, Date.parse(call.started_at) + RING_MS - Date.now()));
  }

  async start(kind: CallKind) {
    if (this.disposed || this.call || this.preparing) return;
    if (!useCalls.getState().ready) { set({ error: 'Connecting to calling service. Please try again in a moment.' }); return; }
    this.preparing = true;
    const generation = ++this.generation;
    set({ phase: 'preparing', error: null });
    try {
      const allowed = await requestCallPermissions(kind);
      if (this.disposed || generation !== this.generation) return;
      if (!allowed) { this.cleanup(); return; }
      await requestBluetoothRouting(); // Optional permission; native manager then discovers paired headsets.
      if (this.disposed || generation !== this.generation) return;
      const { data, error } = await supabase.from('calls').insert({ couple_id: this.coupleId, caller_id: this.uid, kind, status: 'ringing' }).select('*').single();
      if (error) throw new Error('Could not save the call. Please try again.');
      if (this.disposed || generation !== this.generation) {
        await supabase.from('calls').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', data.id).eq('couple_id', this.coupleId).eq('status', 'ringing');
        return;
      }
      this.call = data; this.preparing = false;
      set({ call: data, phase: 'outgoing', camera: kind === 'video' });
      InCallManager.start({ media: kind, auto: true, ringback: '_DTMF_' });
      InCallManager.setKeepScreenOn(true);
      this.armRing(data);
      // Warm credentials at call start; media capture waits until the partner accepts.
      void iceServers(this.uid);
      await this.send('invite', data);
      if (!this.alive(data)) return;
      void supabase.functions.invoke('notify-partner', { body: {
        type: 'call', title: 'Incoming call', body: kind === 'video' ? 'Your partner is video calling you' : 'Your partner is calling you',
        data: { type: 'call', callId: data.id, coupleId: this.coupleId, startedAt: data.started_at, url: '/call' },
      }}).then(({ error: pushError }) => { if (pushError) console.warn('[calls] Partner push could not be delivered.'); })
        .catch(() => { console.warn('[calls] Partner push could not be delivered.'); });
    } catch (error) { if (generation === this.generation) this.fail(error); }
  }

  private async incoming(call: CallRow) {
    if (this.disposed || !freshInvite(call.started_at)) return;
    if (this.call?.id === call.id) return;
    if (this.call || this.preparing) {
      const phase = useCalls.getState().phase;
      if (['preparing', 'outgoing'].includes(phase)) {
        if (this.uid < this.partnerId) return; // Lower user ID remains caller.
        if (this.call) await this.finish('ended', 'cancel'); else this.cleanup();
      } else { await this.send('busy', call); return; }
    }
    if (this.disposed || !freshInvite(call.started_at)) return;
    this.call = call;
    set({ ...initialState, ready: useCalls.getState().ready, call, phase: 'incoming', camera: call.kind === 'video' });
    InCallManager.startRingtone('_DEFAULT_', [0, 600, 500, 600], 'default', Math.max(1, Math.ceil((Date.parse(call.started_at) + RING_MS - Date.now()) / 1000)));
    InCallManager.setKeepScreenOn(true);
    this.armRing(call);
    void iceServers(this.uid);
  }

  async accept() {
    const call = this.call;
    if (!call || this.accepting || useCalls.getState().phase !== 'incoming') return;
    this.accepting = true;
    try {
      if (!await requestCallPermissions(call.kind)) { if (this.alive(call)) await this.finish('declined', 'decline'); return; }
      if (!this.alive(call)) return;
      await requestBluetoothRouting();
      if (!this.alive(call)) return;
      if (!freshInvite(call.started_at)) { await this.finish('missed', 'end'); return; }
      await this.makePeer(call);
      if (!this.alive(call)) return;
      // Recheck after media/TURN awaits; a cancelled invite cannot be revived.
      const { data, error } = await supabase.from('calls').update({ status: 'answered', answered_at: new Date().toISOString() })
        .eq('id', call.id).eq('couple_id', this.coupleId).eq('status', 'ringing').select('*').maybeSingle();
      if (error) throw new Error('Could not answer the call.');
      if (!this.alive(call)) return;
      if (!data) { this.cleanup(); set({ error: 'This call is no longer ringing.' }); return; }
      this.call = data;
      this.stopRinging();
      set({ call: data, phase: 'connecting' });
      this.armConnectionTimeout(data);
      await this.send('accept', data);
    } catch (error) { if (this.alive(call)) this.fail(error); }
    finally { if (this.alive(call)) this.accepting = false; }
  }

  private stopRinging() {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer = undefined;
    InCallManager.stopRingtone(); InCallManager.stopRingback();
  }
  private armConnectionTimeout(call: CallRow) {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = setTimeout(() => {
      if (this.alive(call)) void this.finish('ended', 'end', 'Unable to connect. Please try calling again.');
    }, 30_000);
    if (!this.retryTimer) this.retryTimer = setInterval(() => { void this.restart(); }, 5_000);
  }
  private async makePeer(call: CallRow) {
    if (this.pc) return;
    const servers = await iceServers(this.uid);
    if (!this.alive(call)) return;
    const stream = await mediaDevices.getUserMedia({ audio: true, video: call.kind === 'video' ? { facingMode: 'user', width: 640, height: 480, frameRate: 24 } : false });
    if (!this.alive(call)) { stream.getTracks().forEach((t) => t.stop()); stream.release(); return; }
    this.local = stream;
    const state = useCalls.getState();
    stream.getAudioTracks().forEach((track) => { track.enabled = !state.muted; });
    stream.getVideoTracks().forEach((track) => { track.enabled = state.camera && AppState.currentState === 'active'; });
    this.backgroundCamera = AppState.currentState !== 'active';
    const pc = new RTCPeerConnection({ iceServers: servers }) as NativePeer; this.pc = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    InCallManager.start({ media: call.kind, auto: true }); InCallManager.setKeepScreenOn(true);
    InCallManager.setMicrophoneMute(state.muted);
    set({ local: stream });
    pc.addEventListener('icecandidate', (event) => {
      if (this.pc === pc && this.alive(call) && event.candidate) void this.send('ice', call, { candidate: event.candidate.toJSON() }).catch((e: unknown) => { if (this.alive(call)) this.fail(e); });
    });
    pc.addEventListener('track', (event) => {
      if (this.pc !== pc || !this.alive(call) || !event.track) return;
      const track = event.track;
      const remote = event.streams[0] ?? useCalls.getState().remote ?? new MediaStream();
      if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
      set({ remote });
    });
    const changed = () => {
      if (this.pc !== pc || !this.alive(call)) return;
      const broken = ['disconnected', 'failed'].includes(pc.connectionState) || ['disconnected', 'failed'].includes(pc.iceConnectionState);
      if (!broken && (pc.connectionState === 'connected' || ['connected', 'completed'].includes(pc.iceConnectionState))) {
        if (this.connectTimer) clearTimeout(this.connectTimer);
        if (this.retryTimer) clearInterval(this.retryTimer);
        this.connectTimer = undefined; this.retryTimer = undefined;
        this.stopRinging();
        set({ phase: 'connected', connectedAt: useCalls.getState().connectedAt ?? Date.now() });
        void this.selectedPath(pc);
      } else if (broken) {
        if (useCalls.getState().phase === 'reconnecting') return;
        set({ phase: 'reconnecting' }); this.armConnectionTimeout(call);
        void this.restart();
      }
    };
    pc.addEventListener('connectionstatechange', changed);
    pc.addEventListener('iceconnectionstatechange', changed);
  }

  private async selectedPath(pc: RTCPeerConnection) {
    try {
      const stats: Map<string, Record<string, unknown>> = await pc.getStats();
      if (this.pc !== pc) return;
      let pair: Record<string, unknown> | undefined;
      stats.forEach((entry) => {
        if (entry.type === 'transport' && typeof entry.selectedCandidatePairId === 'string') pair = stats.get(entry.selectedCandidatePairId);
      });
      if (!pair) stats.forEach((entry) => { if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && (entry.nominated === true || entry.selected === true)) pair = entry; });
      if (!pair) return;
      const local = typeof pair.localCandidateId === 'string' ? stats.get(pair.localCandidateId) : undefined;
      const remote = typeof pair.remoteCandidateId === 'string' ? stats.get(pair.remoteCandidateId) : undefined;
      const path = local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'relay' : 'direct';
      set({ path }); if (__DEV__) console.debug('[calls] Selected candidate pair:', path);
    } catch { /* Diagnostic only; never log SDP, IP addresses or credentials. */ }
  }

  private async offer(call: CallRow, restart = false) {
    const pc = this.pc;
    if (!pc || call.caller_id !== this.uid || this.offerBusy) return;
    if (pc.signalingState === 'have-local-offer' && pc.localDescription) {
      // Repair a lost offer/answer without creating another offer or glare.
      await this.send('offer', call, { description: { type: 'offer', sdp: pc.localDescription.sdp }, restart });
      return;
    }
    if (pc.signalingState !== 'stable') return;
    this.offerBusy = true;
    try {
      const description: Description = await pc.createOffer({ iceRestart: restart });
      if (!this.alive(call) || this.pc !== pc) return;
      await pc.setLocalDescription(description);
      if (this.alive(call)) { this.offered = true; await this.send('offer', call, { description, restart }); }
    } finally { if (this.pc === pc) this.offerBusy = false; }
  }
  private async restart() {
    const call = this.call;
    if (!call || !this.pc || this.disposed || !useCalls.getState().ready) return;
    try {
      if (call.caller_id === this.uid) await this.offer(call, true);
      else await this.send('accept', call, { restart: true }); // Only the caller creates restart offers.
    } catch { /* Recovery retries until its bounded connection timeout. */ }
  }
  private async flushIce(pc: RTCPeerConnection) {
    const candidates = this.pendingIce.splice(0);
    for (const candidate of candidates) { if (this.pc !== pc) return; await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
  }

  private async receive(event: SignalEvent, signal: Signal) {
    if (this.disposed) return;
    if (event === 'invite') {
      if (Date.now() - signal.sentAt > RING_MS || signal.sentAt > Date.now() + 5_000) return;
      const { data } = await supabase.from('calls').select('*').eq('id', signal.id).eq('couple_id', this.coupleId).eq('caller_id', this.partnerId).eq('status', 'ringing').maybeSingle();
      if (data) await this.incoming(data);
      return;
    }
    const call = this.call;
    if (!call || signal.id !== call.id || signal.kind !== call.kind) return;
    if (['cancel', 'decline', 'end', 'busy'].includes(event)) {
      await this.finish(event === 'decline' || event === 'busy' ? 'declined' : useCalls.getState().phase === 'incoming' ? 'missed' : 'ended', undefined,
        event === 'busy' ? 'Your partner is already in a call.' : event === 'decline' ? 'Your partner declined the call.' : undefined);
      return;
    }
    if (event === 'accept' && call.caller_id === this.uid) {
      if (this.offered && !signal.restart) return;
      this.stopRinging();
      if (!signal.restart) { set({ phase: 'connecting' }); this.armConnectionTimeout(call); }
      await this.makePeer(call);
      if (this.alive(call)) await this.offer(call, signal.restart);
    } else if (event === 'offer' && call.caller_id === this.partnerId && signal.description?.type === 'offer') {
      const pc = this.pc;
      if (!pc || !['connecting', 'connected', 'reconnecting'].includes(useCalls.getState().phase)) return;
      await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
      if (!this.alive(call)) return;
      await this.flushIce(pc);
      const description: Description = await pc.createAnswer();
      if (!this.alive(call)) return;
      await pc.setLocalDescription(description);
      if (this.alive(call)) await this.send('answer', call, { description });
    } else if (event === 'answer' && call.caller_id === this.uid && signal.description?.type === 'answer') {
      const pc = this.pc;
      if (!pc || pc.signalingState !== 'have-local-offer') return;
      await pc.setRemoteDescription(new RTCSessionDescription(signal.description));
      if (this.alive(call)) await this.flushIce(pc);
    } else if (event === 'ice' && signal.candidate) {
      if (this.pc?.remoteDescription) await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      else if (this.pendingIce.length < 256) this.pendingIce.push(signal.candidate);
    }
  }

  async openIncomingNotification(id: string): Promise<boolean> {
    const { data, error } = await supabase.from('calls').select('*').eq('id', id)
      .eq('couple_id', this.coupleId).eq('caller_id', this.partnerId).maybeSingle();
    if (error) throw new Error('Could not check the incoming call.');
    if (this.disposed || !data || data.status !== 'ringing' || !freshInvite(data.started_at)) return false;
    await this.incoming(data);
    return this.call?.id === id;
  }

  async recover() {
    if (this.disposed || this.recovering) return;
    this.recovering = true;
    try {
      // Reconcile a caller process that died while ringing; never revive stale pushes.
      await supabase.from('calls').update({ status: 'missed', ended_at: new Date().toISOString() })
        .eq('couple_id', this.coupleId).eq('status', 'ringing').lt('started_at', new Date(Date.now() - RING_MS).toISOString());
      if (this.disposed) return;
      const current = this.call;
      if (current) {
        const { data } = await supabase.from('calls').select('*').eq('id', current.id).eq('couple_id', this.coupleId).maybeSingle();
        if (!this.alive(current) || !data) return;
        if (['ended', 'declined', 'missed'].includes(data.status)) { this.cleanup(); return; }
        // The durable answer repairs a lost accept broadcast.
        if (data.status === 'answered' && current.caller_id === this.uid && useCalls.getState().phase === 'outgoing') {
          this.call = data; set({ call: data });
          this.queue = this.queue.then(() => this.receive('accept', { id: data.id, from: this.partnerId, to: this.uid, coupleId: this.coupleId, kind: data.kind, sentAt: Date.now() })).catch((e: unknown) => { if (this.alive(current)) this.fail(e); });
        }
        return;
      }
      const { data, error } = await supabase.from('calls').select('*').eq('couple_id', this.coupleId).eq('caller_id', this.partnerId)
        .eq('status', 'ringing').gte('started_at', new Date(Date.now() - RING_MS).toISOString()).order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (!error && data && !this.disposed && !this.call) await this.incoming(data);
    } finally { this.recovering = false; }
  }

  async finish(status: CallStatus = 'ended', event?: SignalEvent, message?: string) {
    const call = this.call;
    const connectedAt = useCalls.getState().connectedAt;
    this.cleanup();
    if (message) set({ error: message });
    if (!call) return;
    // Cleanup is immediate; durable terminal state is written even if broadcast fails.
    if (event) void this.send(event, call).catch(() => { console.warn('[calls] End signal unavailable; history recovery will reconcile.'); });
    const terminal = connectedAt ? 'ended' : status;
    const { error } = await supabase.from('calls').update({ status: terminal, ended_at: new Date().toISOString() })
      .eq('id', call.id).eq('couple_id', this.coupleId).in('status', ['ringing', 'answered']);
    if (error && !this.disposed && !this.call) set({ error: 'Call ended on this device. History could not sync; check your connection.' });
  }
  end() {
    const phase = useCalls.getState().phase;
    return this.finish(phase === 'incoming' ? 'declined' : 'ended', phase === 'incoming' ? 'decline' : phase === 'outgoing' ? 'cancel' : 'end');
  }
  mute() {
    const muted = !useCalls.getState().muted;
    this.local?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    InCallManager.setMicrophoneMute(muted); set({ muted });
  }
  camera() {
    const camera = !useCalls.getState().camera;
    this.local?.getVideoTracks().forEach((t) => { t.enabled = camera && AppState.currentState === 'active'; });
    set({ camera });
  }
  flip() { this.local?.getVideoTracks().forEach((t) => t._switchCamera()); set({ front: !useCalls.getState().front }); }
  async route(route: string) {
    try { await InCallManager.chooseAudioRoute(route); set({ route }); }
    catch { set({ error: 'Could not change audio output. Check your headset connection.' }); }
  }
  private fail(error: unknown) {
    if (this.disposed) return;
    void this.finish('ended', 'end', error instanceof Error ? error.message : 'The call could not connect. Please try again.');
  }
  private cleanup() {
    ++this.generation;
    this.call = undefined; this.preparing = false; this.accepting = false;
    this.stopRinging();
    if (this.connectTimer) clearTimeout(this.connectTimer);
    if (this.retryTimer) clearInterval(this.retryTimer);
    this.connectTimer = undefined; this.retryTimer = undefined;
    const pc = this.pc; this.pc = undefined; pc?.close();
    this.local?.getTracks().forEach((t) => t.stop()); this.local?.release(); this.local = undefined;
    useCalls.getState().remote?.release();
    this.pendingIce = []; this.offered = false; this.offerBusy = false; this.backgroundCamera = false;
    InCallManager.setMicrophoneMute(false); InCallManager.stop(); InCallManager.setKeepScreenOn(false);
    set({ ...initialState, ready: useCalls.getState().ready });
  }
  dispose() {
    void this.finish('ended', 'end');
    this.disposed = true;
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.appSubscription?.remove(); this.audioSubscription?.remove();
    if (this.channel) void supabase.removeChannel(this.channel);
    clearIceCache(); set({ ready: false });
  }
}
