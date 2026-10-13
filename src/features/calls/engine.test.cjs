// Native-free lifecycle tests: node --test src/features/calls/engine.test.cjs
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const ts = require('typescript');
const { create } = require('zustand');
const tick = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };
function load(name, mocks, globals = {}) {
  const filename = path.join(__dirname, name);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, require: (id) => {
    if (!(id in mocks)) throw new Error(`Unexpected import: ${id}`);
    return mocks[id];
  }, Date, console, __DEV__: false, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 2, clearInterval() {}, ...globals }, { filename });
  return module.exports;
}
function harness(uid = 'a', partnerId = 'b') {
  const rows = new Map(); const sent = []; const peers = []; const streams = []; const timers = new Map();
  let sequence = 0; let allowed = true; let acquire;
  class Stream {
    constructor(video = false) { this.tracks = [{ id: 'audio', kind: 'audio', enabled: true, stopped: false, stop() { this.stopped = true; } }]; if (video === true) this.tracks.push({ id: 'video', kind: 'video', enabled: true, stopped: false, stop() { this.stopped = true; } }); this.released = false; streams.push(this); }
    getTracks() { return this.tracks; } getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); } getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); }
    addTrack(track) { this.tracks.push(track); } release() { this.released = true; }
  }
  class Peer {
    constructor() { this.senders = []; this.transceivers = []; this.handlers = {}; this.signalingState = 'stable'; this.connectionState = 'new'; this.iceConnectionState = 'new'; this.offers = []; this.answers = 0; this.ice = []; peers.push(this); }
    addTrack(track) { const sender = { id: String(this.senders.length), track, getParameters: () => ({ encodings: [{}] }), setParameters: async parameters => { sender.parameters = parameters; } }; this.senders.push(sender); return sender; }
    addTransceiver() { const sender = this.addTrack(null); sender.replaceTrack = async track => { sender.track = track; }; const transceiver = { mid: String(this.transceivers.length), sender }; this.transceivers.push(transceiver); return transceiver; }
    getSenders() { return this.senders; } getTransceivers() { return this.transceivers; }
    addEventListener(event, fn) { this.handlers[event] = fn; }
    async createOffer(options) { this.offers.push(options); return { type: 'offer', sdp: 'test-offer' }; }
    async createAnswer() { this.answers++; return { type: 'answer', sdp: 'test-answer' }; }
    async setLocalDescription(description) { this.localDescription = description; this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable'; }
    async setRemoteDescription(description) { this.remoteDescription = description; this.signalingState = description.type === 'offer' ? 'have-remote-offer' : 'stable'; }
    async addIceCandidate(candidate) { this.ice.push(candidate); }
    async getStats() { return new Map([['transport', { type: 'transport', selectedCandidatePairId: 'pair' }], ['pair', { localCandidateId: 'relay' }], ['relay', { candidateType: 'relay' }]]); }
    close() { this.closed = true; }
    emit(event) { this.handlers[event]?.({}); }
  }
  const channel = { handlers: {}, on(type, filter, handler) { if (type === 'broadcast') this.handlers[filter.event] = handler; return this; },
    subscribe(handler) { handler('SUBSCRIBED'); return this; }, async send(message) { sent.push(message); return 'ok'; },
    receive(event, payload) { this.handlers[event]?.({ payload }); },
  };
  function query() {
    let insert; let update; const filters = [];
    const run = () => {
      if (insert) { const row = { id: `generated-${++sequence}`, started_at: new Date().toISOString(), answered_at: null, ended_at: null, ...insert }; rows.set(row.id, row); return [row]; }
      const selected = [...rows.values()].filter((row) => filters.every((f) => f(row)));
      if (update) for (const row of selected) Object.assign(row, update);
      return selected.map((row) => ({ ...row }));
    };
    const q = { insert(value) { insert = value; return q; }, update(value) { update = value; return q; }, select() { return q; },
      eq(key, value) { filters.push((r) => r[key] === value); return q; }, in(key, values) { filters.push((r) => values.includes(r[key])); return q; },
      lt(key, value) { filters.push((r) => r[key] < value); return q; }, gte(key, value) { filters.push((r) => r[key] >= value); return q; },
      order() { return q; }, limit() { return q; }, async single() { return { data: run()[0], error: null }; },
      async maybeSingle() { return { data: run()[0] ?? null, error: null }; }, then(resolve, reject) { return Promise.resolve({ data: run(), error: null }).then(resolve, reject); },
    }; return q;
  }
  const types = load('types.ts', {});
  const engineModule = load('engine.ts', {
    'expo-constants': { expoConfig: { extra: { ringingMediaProjectionReady: true } } },
    'react-native': { AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) }, DeviceEventEmitter: { addListener: () => ({ remove() {} }) } },
    'react-native-incall-manager': new Proxy({}, { get: (_target, property) => property === '__esModule' ? false : () => {} }),
    'react-native-webrtc': { RTCPeerConnection: Peer, MediaStream: Stream, RTCIceCandidate: class { constructor(candidate) { Object.assign(this, candidate); } }, RTCSessionDescription: class { constructor(description) { Object.assign(this, description); } }, mediaDevices: { getDisplayMedia: async () => { const stream = new Stream(true); stream.getVideoTracks()[0].addEventListener = () => {}; return stream; }, getUserMedia: constraints => acquire ? acquire() : Promise.resolve(new Stream(!!constraints.video)) } },
    zustand: { create }, '@/lib/supabase': { supabase: { channel: () => channel, from: () => query(), removeChannel: async () => {}, functions: { invoke: async () => ({ error: null }) } } },
    './media': { clearIceCache() {}, iceServers: async () => [], requestCallPermissions: async () => allowed }, './types': types,
    '../ringing/runtime': { startCallService: async () => {}, stopCallService: async () => {}, dismissIncoming: async () => {} },
    '@/features/pulse': { setAvailability: async () => {} },
    './notifications': { requestBluetoothRouting: async () => {} },
  }, { setTimeout: (fn, ms) => { const token = {}; timers.set(token, { fn, ms }); return token; }, clearTimeout: (token) => timers.delete(token) });
  const engine = new engineModule.CallEngine(uid, 'couple', partnerId); engine.mount();
  const incoming = (id = 'incoming') => { const row = { id, couple_id: 'couple', caller_id: partnerId, kind: 'audio', status: 'ringing', started_at: new Date().toISOString(), answered_at: null, ended_at: null }; rows.set(id, row); return row; };
  const signal = (id, extra = {}) => ({ id, from: partnerId, to: uid, coupleId: 'couple', kind: 'audio', sentAt: Date.now(), ...extra });
  return { engine, store: engineModule.useCalls, rows, sent, peers, streams, incoming, signal, channel, types, timers,
    deny: () => { allowed = false; }, deferMedia: () => { let resolve; acquire = () => new Promise((done) => { resolve = done; }); return () => { const stream = new Stream(); resolve(stream); return stream; }; } };
}
test('notification taps open only the requested fresh partner invite', async () => {
  const h = harness(); await tick();
  const row = h.incoming();
  assert.equal(await h.engine.openIncomingNotification('missing'), false);
  row.started_at = new Date(Date.now() - 40000).toISOString();
  assert.equal(await h.engine.openIncomingNotification(row.id), false);
  row.started_at = new Date().toISOString(); row.status = 'ended';
  assert.equal(await h.engine.openIncomingNotification(row.id), false);
  row.status = 'ringing'; row.caller_id = 'outsider';
  assert.equal(await h.engine.openIncomingNotification(row.id), false);
  row.caller_id = 'b'; row.couple_id = 'other-couple';
  assert.equal(await h.engine.openIncomingNotification(row.id), false);
  row.couple_id = 'couple';
  assert.equal(await h.engine.openIncomingNotification(row.id), true);
  assert.equal(h.store.getState().phase, 'incoming');
  h.engine.dispose();
});

test('ready does not answer a ringing call and resends the offer after durable consent', async () => {
  const h = harness(); await tick(); await h.engine.start('audio');
  const row = [...h.rows.values()][0];
  h.channel.receive('ready', h.signal(row.id)); await tick();
  assert.equal(h.peers.length, 0);
  row.status = 'answered';
  h.channel.receive('ready', h.signal(row.id)); await tick();
  assert.equal(h.peers.length, 1);
  const offers = h.sent.filter(message => message.event === 'offer').length;
  h.channel.receive('ready', h.signal(row.id)); await tick();
  assert.equal(h.sent.filter(message => message.event === 'offer').length, offers + 1);
  assert.equal(h.peers[0].offers.length, 1);
});

test('video screen sharing uses a separate sender and stopping preserves camera and microphone', async () => {
  const h = harness(); await tick(); await h.engine.start('video');
  const row = [...h.rows.values()][0]; row.status = 'answered';
  h.channel.receive('accept', h.signal(row.id, { kind: 'video' })); await tick();
  const peer = h.peers[0]; peer.connectionState = 'connected'; peer.emit('connectionstatechange'); await tick();
  const local = h.store.getState().local;
  await h.engine.shareScreen();
  assert.equal(h.store.getState().sharing, true);
  assert.equal(local.getVideoTracks()[0].stopped, false);
  assert.equal(local.getAudioTracks()[0].stopped, false);
  assert(h.sent.some(message => message.event === 'share' && message.payload.sharing));
  await h.engine.stopSharing();
  assert.equal(h.store.getState().sharing, false);
  assert.equal(peer.transceivers[0].sender.track, null);
  assert.equal(local.getVideoTracks()[0].stopped, false);
  await h.engine.end(); assert(local.getTracks().every(track => track.stopped));
});

test('goodnight caps only the audio sender and publishes sleeping availability', async () => {
  const h = harness(); await tick(); await h.engine.start('audio');
  const row = [...h.rows.values()][0]; row.status = 'answered';
  h.channel.receive('accept', h.signal(row.id)); await tick();
  await h.engine.goodnight();
  assert.equal(h.store.getState().sleeping, true);
  assert.equal(h.peers[0].senders[0].parameters.encodings[0].maxBitrate, 20000);
  await h.engine.markAsleep();
  assert(h.sent.some(message => message.event === 'sleep' && message.payload.asleep));
});

test('protocol validates envelopes and rejects malformed/stale invite timestamps', () => {
  const h = harness();
  assert.equal(h.types.parseSignal({}), null);
  assert.equal(h.types.parseSignal(h.signal('id', { candidate: { candidate: 4 } })), null);
  assert(h.types.parseSignal(h.signal('id')));
  assert.equal(h.types.freshInvite(new Date(Date.now() - 40001).toISOString()), false);
  assert.equal(h.types.freshInvite('invalid'), false);
  h.engine.dispose();
});
test('caller creates offer, drains early ICE after answer, logs relay and releases media on end', async () => {
  const h = harness(); await tick(); await h.engine.start('audio');
  const id = h.store.getState().call.id;
  h.channel.receive('accept', h.signal(id)); await tick();
  assert.equal(h.peers[0].offers.length, 1);
  h.channel.receive('ice', h.signal(id, { candidate: { candidate: 'early' } })); await tick();
  assert.equal(h.peers[0].ice.length, 0);
  h.channel.receive('answer', h.signal(id, { description: { type: 'answer', sdp: 'answer' } })); await tick();
  assert.equal(h.peers[0].ice.length, 1);
  h.peers[0].connectionState = 'connected'; h.peers[0].emit('connectionstatechange'); await tick();
  assert.equal(h.store.getState().path, 'relay');
  h.engine.mute(); assert.equal(h.streams[0].tracks[0].enabled, false);
  await h.engine.end(); assert.equal(h.store.getState().phase, 'idle'); assert(h.peers[0].closed); assert(h.streams[0].released);
  assert.equal(h.rows.get(id).status, 'ended'); h.engine.dispose();
});
test('callee answers only and requests caller-owned restart', async () => {
  const h = harness(); await tick(); const row = h.incoming();
  h.channel.receive('invite', h.signal(row.id)); await tick(); await h.engine.accept();
  assert.equal(h.rows.get(row.id).status, 'answered'); assert.equal(h.peers[0].offers.length, 0);
  h.channel.receive('offer', h.signal(row.id, { description: { type: 'offer', sdp: 'offer' } })); await tick();
  assert.equal(h.peers[0].answers, 1);
  h.peers[0].connectionState = 'failed'; h.peers[0].emit('connectionstatechange'); await tick();
  assert.equal(h.store.getState().phase, 'reconnecting'); assert.equal(h.peers[0].offers.length, 0);
  assert(h.sent.some((s) => s.event === 'ready' && s.payload.restart)); h.engine.dispose();
});
test('cancellation during media acquisition cannot resurrect a call or leak a stream', async () => {
  const h = harness(); await tick(); const row = h.incoming();
  h.channel.receive('invite', h.signal(row.id)); await tick(); const resolve = h.deferMedia();
  const accept = h.engine.accept(); await tick();
  h.channel.receive('cancel', h.signal(row.id)); await tick(); const stream = resolve(); await accept;
  assert.equal(h.store.getState().phase, 'idle'); assert(stream.released); assert(stream.tracks[0].stopped);
  assert.equal(h.peers.length, 0); assert.notEqual(h.rows.get(row.id).status, 'answered'); h.engine.dispose();
});
test('simultaneous calls: higher user ID cancels its invite and becomes callee', async () => {
  const h = harness('z', 'a'); await tick(); await h.engine.start('audio'); const own = h.store.getState().call.id;
  const row = h.incoming(); h.channel.receive('invite', h.signal(row.id)); await tick();
  assert.equal(h.store.getState().phase, 'incoming'); assert.equal(h.store.getState().call.id, row.id);
  assert.equal(h.rows.get(own).status, 'ended'); assert(h.sent.some((s) => s.event === 'cancel' && s.payload.id === own)); h.engine.dispose();
});
test('simultaneous calls: lower user ID remains caller', async () => {
  const h = harness('a', 'z'); await tick(); await h.engine.start('audio'); const own = h.store.getState().call.id;
  const row = h.incoming(); h.channel.receive('invite', h.signal(row.id)); await tick();
  assert.equal(h.store.getState().phase, 'outgoing'); assert.equal(h.store.getState().call.id, own); h.engine.dispose();
});
test('already in a call responds busy without replacing the current call', async () => {
  const h = harness(); await tick(); await h.engine.start('audio'); const own = h.store.getState().call.id;
  h.channel.receive('accept', h.signal(own)); await tick(); const row = h.incoming('other');
  h.channel.receive('invite', h.signal(row.id)); await tick();
  assert.equal(h.store.getState().call.id, own); assert(h.sent.some((s) => s.event === 'busy' && s.payload.id === row.id)); h.engine.dispose();
});
test('denied caller permission does not create history or capture media; stale invite is ignored', async () => {
  const h = harness(); await tick(); h.deny(); await h.engine.start('audio');
  assert.equal(h.rows.size, 0); assert.equal(h.streams.length, 0); assert.equal(h.store.getState().phase, 'idle');
  const row = h.incoming(); row.started_at = new Date(Date.now() - 60000).toISOString();
  h.channel.receive('invite', h.signal(row.id)); await tick(); assert.equal(h.store.getState().phase, 'idle'); h.engine.dispose();
});
test('ring timeout writes missed and releases the incoming screen', async () => {
  const h = harness(); await tick(); const row = h.incoming();
  h.channel.receive('invite', h.signal(row.id)); await tick();
  const timer = [...h.timers.values()].find((t) => t.ms > 39000 && t.ms <= 40000);
  assert(timer); timer.fn(); await tick();
  assert.equal(h.store.getState().phase, 'idle'); assert.equal(h.rows.get(row.id).status, 'missed'); h.engine.dispose();
});
test('cold-start recovery finds fresh ringing history and reconciles a terminal update', async () => {
  const h = harness(); await tick(); const row = h.incoming(); await h.engine.recover();
  assert.equal(h.store.getState().phase, 'incoming');
  row.status = 'ended'; await h.engine.recover(); assert.equal(h.store.getState().phase, 'idle'); h.engine.dispose();
});
test('caller restart resends an unanswered offer, then creates ICE restart only after stable answer', async () => {
  const h = harness(); await tick(); await h.engine.start('audio'); const id = h.store.getState().call.id;
  h.channel.receive('accept', h.signal(id)); await tick();
  h.channel.receive('accept', h.signal(id, { restart: true })); await tick();
  assert.equal(h.peers[0].offers.length, 1); assert.equal(h.sent.filter((s) => s.event === 'offer').length, 2);
  h.channel.receive('answer', h.signal(id, { description: { type: 'answer', sdp: 'answer' } })); await tick();
  h.peers[0].connectionState = 'failed'; h.peers[0].emit('connectionstatechange'); await tick();
  assert.equal(h.peers[0].offers.length, 2); assert.equal(h.peers[0].offers[1].iceRestart, true); h.engine.dispose();
});
