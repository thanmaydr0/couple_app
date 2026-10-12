import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { motionTokens } from '@/motion';
import { clamp, decode, LIMITS, together } from './protocol';
import type { Intensity, Message, Point, Touch } from './types';

const empty = (): Touch => ({ x: 0.5, y: 0.5, down: false, at: 0, seq: 0 });
type Body = Message extends infer M ? M extends Message ? Omit<M, 'user' | 'instance' | 'seq' | 'at'> : never : never;
export function useTouchRoom(couple: string | undefined, user: string | undefined, partner: string | undefined, accent: string, enabled: boolean, intensity: Intensity, fullMotion: boolean) {
  const mine = useRef(empty()); const theirs = useRef(empty()); const previous = useRef(empty());
  const [status, setStatus] = useState('Connecting…'); const [present, setPresent] = useState(false);
  const [partnerAccent, setPartnerAccent] = useState<string>(); const [active, setActive] = useState(AppState.currentState === 'active');
  const [online, setOnline] = useState(true); const [expired, setExpired] = useState(false);
  const [held, setHeld] = useState(0); const [merged, setMerged] = useState(false); const [bloom, setBloom] = useState(0);
  const [heart, setHeart] = useState<{ point: Point; at: number }>();
  const total = useRef(0); const joinedAt = useRef(0); const contactAt = useRef(0);
  const settings = useRef({ intensity, fullMotion }); settings.current = { intensity, fullMotion };
  const send = useRef<(body: Body) => void>(() => {}); const release = useRef<() => void>(() => {});
  const lastSent = useRef(0); const sentPoint = useRef<Point | undefined>(undefined); const lastTap = useRef<{ at: number; point: Point } | undefined>(undefined);
  const lastGesture = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const flush = () => {
    if (!mine.current.down) return;
    const p = mine.current;
    if (sentPoint.current?.x === p.x && sentPoint.current.y === p.y) return;
    const wait = LIMITS.sendMs - (Date.now() - lastSent.current);
    if (wait > 0) { if (!pending.current) pending.current = setTimeout(() => { pending.current = undefined; flush(); }, wait); return; }
    lastSent.current = Date.now(); sentPoint.current = { x: p.x, y: p.y };
    send.current({ kind: 'touch', point: sentPoint.current, down: true });
  };
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') release.current(); setActive(state === 'active'); });
    const net = NetInfo.addEventListener(state => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
    return () => { sub.remove(); net(); };
  }, []);
  useEffect(() => {
    if (!enabled) { joinedAt.current = 0; setExpired(false); return; }
    if (!joinedAt.current) { joinedAt.current = Date.now(); total.current = 0; setHeld(0); }
    if (!couple || !user || !partner || !active || !online || expired) { setStatus(!online ? 'Offline · reconnecting…' : 'Room paused'); return; }
    let alive = true; let ready = false; let peer = false; let peerInstance = ''; let seq = 0; let incoming = -1;
    let lastSeen = 0; let peerSince = 0; let offset = 0; let bestRtt = Infinity; let lastPing = 0; let lastPulse = 0; let lastHeart = 0;
    const instance = `${user}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const room = supabase.channel(`touch:${couple}`, { config: { private: true, broadcast: { self: false, ack: true }, presence: { key: instance } } });
    const endContact = () => { if (contactAt.current) { total.current += Date.now() - contactAt.current; contactAt.current = 0; } setMerged(false); setHeld(total.current); };
    const canSend = () => alive && ready && peer && AppState.currentState === 'active';
    const transmit = (body: Body) => {
      if (!canSend() || ((body.kind === 'touch' || body.kind === 'heart' || body.kind === 'pulse') && Date.now() - lastSeen > LIMITS.staleMs)) return;
      void room.send({ type: 'broadcast', event: 'signal', payload: { ...body, user, instance, seq: ++seq, at: Date.now() } }).then(result => {
        if (alive && result !== 'ok') { theirs.current.down = false; endContact(); setStatus('Reconnecting…'); }
      }).catch(() => { if (alive) setStatus('Reconnecting…'); });
    };
    send.current = transmit;
    const schedulePulse = (when: number) => {
      const delay = when - Date.now(); if (delay < -LIMITS.sendMs || delay > LIMITS.pulseMs) return;
      const timer = setTimeout(() => {
        timers.delete(timer);
        const s = settings.current;
        if (!canSend() || !together(mine.current, theirs.current) || s.intensity === 'off' || !s.fullMotion) return;
        const style = s.intensity === 'strong' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light;
        void Haptics.impactAsync(style).catch(() => {});
        const second = setTimeout(() => { timers.delete(second); if (canSend() && settings.current.intensity !== 'off' && settings.current.fullMotion && together(mine.current, theirs.current)) void Haptics.impactAsync(style).catch(() => {}); }, motionTokens.fast);
        timers.add(second);
      }, Math.max(0, delay)); timers.add(timer);
    };
    release.current = () => { if (mine.current.down) transmit({ kind: 'up' }); mine.current.down = false; theirs.current.down = false; endContact(); };
    room.on('presence', { event: 'sync' }, () => {
      if (!alive) return;
      const entries = Object.values(room.presenceState<{ user: string; instance: string; accent: string }>()).flat();
      const other = entries.filter(p => p.user === partner && typeof p.instance === 'string').sort((a, b) => a.instance.localeCompare(b.instance))[0];
      const changed = other?.instance !== peerInstance;
      peer = !!other; setPresent(peer);
      if (changed) { peerSince = Date.now(); peerInstance = other?.instance ?? ''; incoming = -1; bestRtt = Infinity; theirs.current = empty(); previous.current = empty(); sentPoint.current = undefined; endContact(); }
      if (other && /^#[0-9a-f]{6}$/i.test(other.accent)) setPartnerAccent(other.accent);
      if (peer) { lastSeen = Date.now(); setStatus('Together · touch to connect'); if (changed) transmit({ kind: 'ready' }); flush(); }
      else { theirs.current.down = false; endContact(); setStatus('Waiting for them…'); }
    }).on('broadcast', { event: 'signal' }, ({ payload }: { payload: unknown }) => {
      const m = decode(payload); if (!alive || !peer || !m || m.user !== partner || m.instance !== peerInstance || m.seq <= incoming) return;
      incoming = m.seq; lastSeen = Date.now(); setStatus('Together · touch to connect');
      if (m.kind === 'ready') { sentPoint.current = undefined; flush(); }
      if (m.kind === 'touch') { previous.current = theirs.current; theirs.current = { ...m.point, down: true, at: Date.now(), seq: m.seq }; }
      if (m.kind === 'up') { theirs.current.down = false; endContact(); }
      if (m.kind === 'heart' && Date.now() - lastHeart >= motionTokens.hero) { lastHeart = Date.now(); setHeart({ point: m.point, at: Date.now() }); }
      if (m.kind === 'ping') transmit({ kind: 'pong', sent: m.sent, received: Date.now() });
      if (m.kind === 'pong') { const rtt = Date.now() - m.sent; if (rtt >= 0 && rtt < bestRtt) { bestRtt = rtt; offset = m.received - (m.sent + rtt / 2); } }
      if (m.kind === 'pulse' && partner < user && bestRtt < LIMITS.leadMs) schedulePulse(m.when - offset);
    }).subscribe(state => {
      if (!alive) return;
      ready = state === 'SUBSCRIBED';
      if (ready) { setStatus('Waiting for them…'); void room.track({ user, instance, accent }).then(result => { if (alive && result !== 'ok') setStatus('Presence unavailable · retry room'); }); }
      else { peer = false; setPresent(false); theirs.current.down = false; mine.current.down = false; endContact(); setStatus(state === 'CHANNEL_ERROR' ? 'Private room unavailable · check authorization or retry' : 'Reconnecting…'); }
    });
    const tick = setInterval(() => {
      const now = Date.now();
      if (now - joinedAt.current >= LIMITS.capMs) { release.current(); setExpired(true); return; }
      if (!canSend()) return;
      if (now - lastSeen > LIMITS.staleMs) { mine.current.down = false; theirs.current.down = false; sentPoint.current = undefined; endContact(); setStatus('Reconnecting…'); }
      if (now - lastPing >= LIMITS.clockMs) { lastPing = now; transmit({ kind: 'ping', sent: now }); }
      const close = together(mine.current, theirs.current);
      if (close && !contactAt.current) { contactAt.current = now; setMerged(true); setBloom(n => n + 1); }
      if (!close && contactAt.current) endContact();
      if (close) { setHeld(total.current + now - contactAt.current); if (user < partner && now - peerSince >= LIMITS.clockMs && now - lastPulse >= LIMITS.pulseMs && bestRtt < LIMITS.leadMs) { lastPulse = now; const when = now + LIMITS.leadMs; transmit({ kind: 'pulse', when }); schedulePulse(when); } }
    }, LIMITS.sendMs);
    return () => {
      release.current(); alive = false; ready = false; send.current = () => {}; release.current = () => {};
      clearInterval(tick); timers.forEach(clearTimeout); if (pending.current) clearTimeout(pending.current); pending.current = undefined;
      mine.current = empty(); theirs.current = empty(); sentPoint.current = undefined; setPresent(false);
      void room.untrack().catch(() => {}); void supabase.removeChannel(room).catch(() => {});
    };
  }, [couple, user, partner, enabled, active, online, expired, accent]);
  function move(point: Point) {
    if (!enabled || !active || !online || expired) return;
    mine.current = { x: clamp(point.x), y: clamp(point.y), down: true, at: Date.now(), seq: mine.current.seq + 1 };
    if (pending.current) return;
    const wait = LIMITS.sendMs - (Date.now() - lastSent.current);
    if (wait <= 0) flush(); else pending.current = setTimeout(() => { pending.current = undefined; flush(); }, wait);
  }
  function up() {
    if (pending.current) clearTimeout(pending.current); pending.current = undefined;
    if (mine.current.down) send.current({ kind: 'up' }); mine.current.down = false; sentPoint.current = undefined;
  }
  function tap(point: Point) {
    const now = Date.now(); const last = lastTap.current;
    if (last && now - last.at < motionTokens.hero && now - lastGesture.current >= motionTokens.hero && Math.hypot(last.point.x - point.x, last.point.y - point.y) < LIMITS.threshold) { lastGesture.current = now; send.current({ kind: 'heart', point }); setHeart({ point, at: now }); lastTap.current = undefined; }
    else lastTap.current = { at: now, point };
  }
  return { mine, theirs, previous, status, present, partnerAccent, active, online, expired, held, merged, bloom, heart, move, up, tap,
    continueRoom: () => { joinedAt.current = Date.now(); setExpired(false); } };
}

let inviting = false;
export async function invitePartner(user: string) {
  if (inviting) return 'Invitation already sending.';
  inviting = true;
  try {
    const key = `touch:last-invite:${user}`; const now = Date.now();
    const last = Number(await AsyncStorage.getItem(key));
    if (now - last < LIMITS.inviteMs) return 'Invitation sent recently. You can still join the room.';
    await AsyncStorage.setItem(key, String(now));
    const { data, error } = await supabase.functions.invoke('notify-partner', { body: { channel: 'pulse', title: 'A hand to hold', body: 'Meet me in Touch Together', data: { route: '/us/touch' } } });
    if (error || data?.error) return 'Invitation could not be sent. You can both open Touch directly.';
    return 'Invitation sent. Waiting for your partner.';
  } catch { return 'Invitation could not be sent. You can both open Touch directly.'; }
  finally { inviting = false; }
}
