import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Haptics from 'expo-haptics';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { usePresence } from '@/features/presence/PresenceProvider';
import type { ScribbleMatchRow } from '@/types/db';
import { Drawing } from './DrawingCanvas';
import { drawerOf, gameSchema, packetSchema, strokeSchema, type Feed, type Game, type Packet, type Point, type Stroke } from './model';
import { choices, closeGuess, normalize, pattern, pointsFor } from './words';

const buzz = () => { void Haptics.selectionAsync().catch(() => {}); };
const message = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Could not connect. Try again.';
const hashWord = (word: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalize(word));
export function useScribble() {
  const profile = useProfile(); const partner = usePartner();
  const uid = profile.data?.id; const couple = profile.data?.couple_id;
  const partnerOnline = usePresence(state => state.partnerOnline);
  const [rows, setRows] = useState<ScribbleMatchRow[]>([]);
  const [match, setMatch] = useState<ScribbleMatchRow | null>(null);
  const row = useRef(match); row.current = match;
  const [game, setGame] = useState<Game | null>(null); const state = useRef<Game | null>(null);
  const [feed, setFeed] = useState<Feed[]>([]); const feedRef = useRef<Feed[]>([]);
  const [options, setOptions] = useState<string[]>(choices);
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false); const [peerReady, setPeerReady] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const drawing = useRef(new Drawing()).current;
  const secret = useRef(''); const activeStroke = useRef<Stroke | null>(null); const batch = useRef<Point[]>([]);
  const lastPeer = useRef(0); const peerActive = useRef(false); const transportReady = useRef(false);
  const available = useRef(false); available.current = foreground && partnerOnline && connected && peerReady;
  const locking = useRef(false); const hintIndexes = useRef<number[]>([]);
  const seen = useRef(new Set<string>()); const requested = useRef(''); const lastGuess = useRef(0);
  function apply(next: Game) { state.current = next; setGame(next); }
  function addFeed(item: Feed) {
    feedRef.current = [...feedRef.current.filter(entry => entry.id !== item.id), item].slice(-60); setFeed(feedRef.current);
  }
  function send(event: string, fields: Partial<Packet> = {}) {
    const current = state.current;
    if (!uid || !current || !channel.current) return;
    void channel.current.send({ type: 'broadcast', event, payload: { sender: uid, round: current.round, id: Crypto.randomUUID(), ...fields } }).then(result => {
      if (result !== 'ok') setError('A message was not confirmed. The drawing resyncs automatically; return to the lobby and resume if this continues.');
    }).catch(failure => setError(message(failure)));
  }
  async function refresh() {
    if (!couple) return;
    const result = await supabase.from('scribble_matches').select('*').eq('couple_id', couple).order('created_at', { ascending: false }).limit(12);
    if (result.error) setError(message(result.error)); else setRows(result.data);
  }
  useEffect(() => { void refresh(); const timer = setInterval(() => { void refresh(); }, 5000); return () => clearInterval(timer); }, [couple]);
  async function save(next: Game, completed: number) {
    const current = row.current;
    if (!current || !couple) throw new Error('Match is unavailable.');
    const { data, error: failure } = await supabase.from('scribble_matches').update({ scores: { ...next.scores, _scribble: next }, rounds_played: completed })
      .eq('id', current.id).eq('couple_id', couple).eq('updated_at', current.updated_at).select().maybeSingle();
    if (failure) throw failure;
    if (!data) throw new Error('Match changed on another screen. Return to lobby and resume.');
    row.current = data; setMatch(data);
  }
  async function run(work: () => Promise<void>) {
    if (locking.current) return;
    locking.current = true; setBusy(true); setError(null);
    try { await work(); } catch (failure) { setError(message(failure)); } finally { locking.current = false; setBusy(false); }
  }
  async function join(selected: ScribbleMatchRow) {
    await run(async () => {
      const parsed = gameSchema.safeParse(selected.scores._scribble);
      if (!parsed.success || !uid || !parsed.data.players.includes(uid)) throw new Error('This match uses an unsupported format. Start a new match.');
      const restored = parsed.data;
      const local = await AsyncStorage.getItem(`scribble:${selected.id}:${uid}`);
      secret.current = ''; drawing.replace([]); feedRef.current = []; setFeed([]);
      if (local && drawerOf(restored) === uid) {
        try {
          const value: unknown = JSON.parse(local);
          if (value && typeof value === 'object' && 'round' in value && value.round === restored.round && 'word' in value && typeof value.word === 'string') {
            secret.current = value.word;
            if ('strokes' in value) { const strokes = strokeSchema.array().max(200).safeParse(value.strokes); if (strokes.success) drawing.replace(strokes.data); }
            if ('game' in value) { const cached = gameSchema.safeParse(value.game); if (cached.success && cached.data.round === restored.round && restored.phase === 'draw') restored.remaining = Math.min(restored.remaining, cached.data.remaining); }
          }
        } catch { /* A damaged local cache cannot expose or fabricate the answer. */ }
      }
      hintIndexes.current = [...restored.mask.replace(/\s/g, '')].flatMap((letter, index) => letter === '_' ? [] : [index]);
      setOptions(choices()); apply(restored); row.current = selected; setMatch(selected);
    });
  }
  function start(total: number) {
    return run(async () => {
      if (!uid || !couple || !partner.data) throw new Error('Link both partners before starting.');
      const next: Game = { round: 0, total, players: [uid, partner.data.id], phase: 'pick', remaining: 80, mask: '', hash: '', revealed: '', solved: false, scores: { [uid]: 0, [partner.data.id]: 0 }, hints: 0 };
      const { data, error: failure } = await supabase.from('scribble_matches').insert({ couple_id: couple, created_by: uid, scores: { ...next.scores, _scribble: next } }).select().single();
      if (failure) throw failure;
      secret.current = ''; drawing.replace([]); feedRef.current = []; setFeed([]); setOptions(choices()); apply(next); row.current = data; setMatch(data); buzz();
    });
  }
  function cache() {
    if (row.current && uid && state.current && drawerOf(state.current) === uid) {
      void AsyncStorage.setItem(`scribble:${row.current.id}:${uid}`, JSON.stringify({ round: state.current.round, word: secret.current, game: state.current, strokes: drawing.strokes })).catch(() => setError('Could not save a local recovery copy. Keep this screen open.'));
    }
  }
  function pick(word: string) {
    return run(async () => {
      const current = state.current;
      if (!current || drawerOf(current) !== uid || current.phase !== 'pick' || !available.current || !options.includes(word)) return;
      secret.current = word; hintIndexes.current = []; drawing.replace([]);
      const next: Game = { ...current, phase: 'draw', remaining: 80, hash: await hashWord(word), mask: pattern(word), hints: 0 };
      await save(next, current.round); apply(next); cache(); send('round_start', { game: next }); buzz();
    });
  }
  async function finish(solved: boolean) {
    if (locking.current) return;
    await run(async () => {
      const current = state.current;
      if (!current || current.phase !== 'draw' || drawerOf(current) !== uid) return;
      endStroke();
      const points = solved ? pointsFor(current.remaining) : { guesser: 0, drawer: 0 };
      const guesser = current.players.find(player => player !== uid)!;
      const next: Game = { ...current, phase: current.round + 1 === current.total ? 'final' : 'summary', solved, revealed: secret.current || '(round interrupted)', scores: { ...current.scores, [uid]: (current.scores[uid] ?? 0) + points.drawer, [guesser]: (current.scores[guesser] ?? 0) + points.guesser } };
      await save(next, current.round + 1); apply(next); cache(); send('round_end', { game: next });
      void Haptics.notificationAsync(solved ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
    });
  }
  function nextRound() {
    return run(async () => {
      const current = state.current;
      if (!current || current.phase !== 'summary' || drawerOf(current) !== uid || !available.current) return;
      const next: Game = { ...current, round: current.round + 1, phase: 'pick', remaining: 80, mask: '', hash: '', revealed: '', solved: false, hints: 0 };
      await save(next, next.round); apply(next); secret.current = ''; drawing.replace([]); setOptions(choices()); feedRef.current = []; setFeed([]); send('round_start', { game: next }); buzz();
    });
  }
  useEffect(() => {
    if (!match?.id || !uid || !partner.data?.id) return;
    let alive = true; let lastTick = Date.now();
    const peer = partner.data.id;
    seen.current.clear(); requested.current = ''; lastPeer.current = 0; peerActive.current = false; setPeerReady(false);
    const current = supabase.channel(`scribble:${match.id}`, { config: { private: true, broadcast: { ack: true } } }); channel.current = current;
    function request() { requested.current = Crypto.randomUUID(); send('sync_request', { sync: requested.current }); }
    async function receive(event: string, raw: unknown) {
      if (!alive) return;
      const parsed = packetSchema.safeParse(raw); if (!parsed.success) return;
      const packet = parsed.data; const now = state.current;
      if (!now || packet.sender !== peer || seen.current.has(packet.id)) return;
      seen.current.add(packet.id); if (seen.current.size > 2000) seen.current.delete(seen.current.values().next().value!);
      if (event === 'ready') { lastPeer.current = Date.now(); peerActive.current = packet.ready === true; setPeerReady(peerActive.current); return; }
      const authority = drawerOf(now); const fromDrawer = peer === authority;
      if (event === 'sync_request') {
        // The previous drawer owns the handoff until the new drawer has seen
        // the next pick screen. Recover a dropped round_start without deadlock.
        const handingOff = now.phase === 'pick' && packet.round === now.round - 1 && now.players[(now.round - 1) % 2] === uid;
        if (authority === uid || handingOff) send('sync_state', { target: peer, sync: packet.sync, game: now, strokes: drawing.strokes, feed: feedRef.current });
        return;
      }
      if (event === 'sync_state' && fromDrawer && packet.target === uid && packet.sync === requested.current && packet.game) {
        if (packet.game.players.join() !== now.players.join() || packet.game.total !== now.total || packet.game.round < now.round) return;
        apply(packet.game); drawing.replace(packet.strokes ?? []); feedRef.current = packet.feed ?? []; setFeed(feedRef.current);
        if (packet.game.round !== now.round || packet.game.phase !== now.phase) {
          setOptions(choices());
          const result = await supabase.from('scribble_matches').select('*').eq('id', match!.id).single();
          if (alive && result.data) { row.current = result.data; setMatch(result.data); }
        }
        return;
      }
      if (event === 'round_start' && packet.game && fromDrawer && packet.game.players.join() === now.players.join() && packet.game.total === now.total) {
        const incoming = packet.game;
        if (incoming.round === now.round && now.phase === 'pick' && incoming.phase === 'draw' || incoming.round === now.round + 1 && now.phase === 'summary' && incoming.phase === 'pick') {
          apply(incoming); drawing.replace([]); secret.current = ''; setOptions(choices()); feedRef.current = []; setFeed([]);
          // Fetch the saved version for the next drawer's compare-and-swap.
          const result = await supabase.from('scribble_matches').select('*').eq('id', match!.id).single();
          if (alive && result.data) { row.current = result.data; setMatch(result.data); }
        }
        return;
      }
      if (packet.round !== now.round) return;
      if (event === 'round_end' && fromDrawer && packet.game && packet.game.round === now.round && ['summary', 'final'].includes(packet.game.phase) && now.phase === 'draw') {
        if (packet.game.players.join() !== now.players.join() || packet.game.total !== now.total) return;
        if (packet.game.revealed && await hashWord(packet.game.revealed) !== now.hash && packet.game.solved) { setError('Answer validation failed. Return to lobby to reload the saved round.'); return; }
        apply(packet.game); buzz(); return;
      }
      if (now.phase !== 'draw') return;
      if ((event === 'clock' || event === 'hint') && fromDrawer && packet.game && packet.game.round === now.round) {
        apply({ ...now, remaining: packet.game.remaining, mask: packet.game.mask, hints: packet.game.hints }); return;
      }
      if (fromDrawer && event === 'stroke' && packet.stroke) drawing.append(packet.stroke, false, packet.offset);
      if (fromDrawer && event === 'stroke_end' && packet.stroke) drawing.append(packet.stroke, true);
      if (fromDrawer && event === 'undo') drawing.undo();
      if (fromDrawer && event === 'clear') drawing.replace([]);
      if (event === 'guess' && authority === uid && packet.guess && packet.guess.sender === peer && available.current) {
        const item = packet.guess; addFeed(item);
        if (normalize(item.text) === normalize(secret.current) && secret.current) {
          addFeed({ ...item, text: 'Guessed the word!', feedback: 'correct' }); send('correct', { guess: { ...item, text: 'Guessed the word!', feedback: 'correct' } }); await finish(true);
        } else if (secret.current && closeGuess(item.text, secret.current)) { const close: Feed = { ...item, feedback: 'close' }; addFeed(close); send('guess', { guess: close }); }
        else send('guess', { guess: item });
      } else if ((event === 'guess' || event === 'correct') && fromDrawer && packet.guess) { addFeed(packet.guess); if (event === 'correct') buzz(); }
    }
    const events = ['ready', 'sync_request', 'sync_state', 'round_start', 'round_end', 'clock', 'hint', 'stroke', 'stroke_end', 'undo', 'clear', 'guess', 'correct'];
    events.forEach(event => current.on('broadcast', { event }, ({ payload }: { payload: unknown }) => { void receive(event, payload).catch(failure => setError(message(failure))); }));
    current.subscribe(status => {
      if (!alive) return;
      transportReady.current = status === 'SUBSCRIBED'; setConnected(transportReady.current);
      if (transportReady.current) { setError(null); send('ready', { ready: AppState.currentState === 'active' }); request(); }
    });
    const app = AppState.addEventListener('change', status => {
      setForeground(status === 'active'); send('ready', { ready: status === 'active' }); lastTick = Date.now();
      if (status === 'active') { request(); cache(); } else { endStroke(); cache(); }
    });
    const timer = setInterval(() => {
      const now = state.current; if (!now) return;
      const elapsed = Math.min(1.25, (Date.now() - lastTick) / 1000); lastTick = Date.now();
      if (transportReady.current) send('ready', { ready: AppState.currentState === 'active' });
      if (Date.now() - lastPeer.current > 3500) setPeerReady(false);
      const ready = AppState.currentState === 'active' && usePresence.getState().partnerOnline && peerActive.current && Date.now() - lastPeer.current < 3500 && transportReady.current;
      if (drawerOf(now) !== uid) { if (ready && !requested.current) request(); return; }
      if (now.phase !== 'draw' || !ready || locking.current) return;
      if (!secret.current) { void finish(false); return; }
      const next = { ...now, remaining: Math.max(0, now.remaining - elapsed) };
      const level = next.remaining <= 30 ? 2 : next.remaining <= 50 ? 1 : 0;
      if (level > now.hints) {
        const indexes = [...secret.current].map((_, i) => i).filter(i => secret.current[i] !== ' ' && !hintIndexes.current.includes(i));
        if (indexes.length) hintIndexes.current.push(indexes[Math.floor(Math.random() * indexes.length)]!);
        next.hints = level; next.mask = pattern(secret.current, hintIndexes.current); send('hint', { game: next });
      }
      apply(next); cache(); send('clock', { game: next });
      if (next.remaining === 0) void finish(false);
    }, 1000);
    const syncTimer = setInterval(() => { if (state.current && drawerOf(state.current) !== uid && transportReady.current) request(); }, 5000);
    const batches = setInterval(flush, 50);
    return () => { cache(); alive = false; app.remove(); clearInterval(timer); clearInterval(syncTimer); clearInterval(batches); transportReady.current = false; setConnected(false); channel.current = null; void supabase.removeChannel(current); };
  }, [match?.id, uid, partner.data?.id]);
  function flush() {
    const stroke = activeStroke.current;
    if (!stroke || !batch.current.length) return;
    const offset = stroke.points.length - batch.current.length;
    send('stroke', { stroke: { ...stroke, points: batch.current.splice(0) }, offset });
  }
  function begin(point: Point, color: string, size: number) {
    if (!state.current || state.current.phase !== 'draw' || drawerOf(state.current) !== uid || !available.current || drawing.count() >= 7900 || drawing.strokes.length >= 200) return;
    const stroke: Stroke = { id: Crypto.randomUUID(), color, size, points: [point] }; activeStroke.current = stroke; batch.current = [point]; drawing.append(stroke);
  }
  function point(point: Point) {
    const stroke = activeStroke.current; if (!stroke || !available.current || drawing.count() >= 8000) return;
    const last = stroke.points[stroke.points.length - 1]; if (last && Math.hypot(last.x - point.x, last.y - point.y) < 2) return;
    stroke.points.push(point); batch.current.push(point); drawing.append({ ...stroke, points: [point] });
  }
  function endStroke() { const stroke = activeStroke.current; if (!stroke) return; flush(); send('stroke_end', { stroke }); activeStroke.current = null; cache(); }
  function tool(action: 'undo' | 'clear') {
    if (!state.current || drawerOf(state.current) !== uid || state.current.phase !== 'draw' || !available.current) return;
    endStroke(); if (action === 'undo') drawing.undo(); else drawing.replace([]); send(action); cache(); buzz();
  }
  function guess(text: string) {
    const now = state.current; const trimmed = text.trim().slice(0, 80);
    if (!now || drawerOf(now) === uid || now.phase !== 'draw' || !available.current || !trimmed || Date.now() - lastGuess.current < 700) return false;
    lastGuess.current = Date.now(); const item: Feed = { id: Crypto.randomUUID(), sender: uid!, text: trimmed, feedback: 'guess' }; addFeed(item); send('guess', { guess: item }); return true;
  }
  function leave() { endStroke(); cache(); send('ready', { ready: false }); setMatch(null); row.current = null; applyStateNull(); void refresh(); }
  function applyStateNull() { state.current = null; setGame(null); }
  return { profile, partner, uid, rows, match, game, feed, options, error: error ?? profile.error?.message ?? partner.error?.message, busy, connected, paused: !foreground || !partnerOnline || !connected || !peerReady, drawing, secret: secret.current, start, join, pick, nextRound, begin, point, endStroke, tool, guess, leave, refresh };
}
