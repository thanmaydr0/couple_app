import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import { useRealtimeTable } from '@/lib/data/useRealtimeTable';
import { BUNDLED } from './prompts';
import { pickPrompt } from './rules';
import { choiceSchema, customSchema, roundSchema, statsSchema, titles, type GameId, type Prompt, type Round } from './types';

type FeatureDB = { public: {
  Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }>;
  Views: Record<never, never>;
  Functions: { gamenight_action: { Args: { p_action: string; p_round: string | null; p_payload: Record<string, unknown> }; Returns: unknown } };
} };
const db = supabase as unknown as SupabaseClient<FeatureDB>;
const decodeRound = (row: unknown) => roundSchema.parse(row);
const decodeCustom = (row: unknown) => customSchema.parse(row);
const decodeStats = (row: unknown) => { const stats = statsSchema.parse(row); return { ...stats, id: `${stats.couple_id}:${stats.game}` }; };
const NOTIFY_COOLDOWN = 60_000;

export function useGameNight() {
  const profile = useProfile(); const partner = usePartner(); const session = useSession();
  const uid = session.data?.user.id;
  const coupleId = profile.data?.id === uid ? profile.data?.couple_id : null;
  const rounds = useRealtimeTable({ table: 'game_rounds', decode: decodeRound, limit: 120, orderBy: 'updated_at' });
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => { const listener = AppState.addEventListener('change', value => setForeground(value === 'active')); return () => listener.remove(); }, []);
  // Keep old unfinished invitations resumable even when they fall outside bounded history.
  const active = useQuery({ queryKey: ['gamenight-active', coupleId, uid], enabled: !!coupleId && !!uid && foreground,
    queryFn: async ({ signal }) => { const { data, error: failure } = await db.from('game_rounds').select('*').eq('couple_id', coupleId!).neq('status', 'finished').abortSignal(signal); if (failure) throw failure; return (data ?? []).map(decodeRound); } });
  const refetchActive = active.refetch;
  useEffect(() => { if (coupleId && foreground && rounds.dataUpdatedAt) void refetchActive(); }, [rounds.dataUpdatedAt, coupleId, foreground, refetchActive]);
  const customs = useRealtimeTable({ table: 'gamenight_prompts', decode: decodeCustom, limit: 200 });
  const stats = useRealtimeTable({ table: 'game_stats', decode: decodeStats, orderBy: 'game', limit: 4 });
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null); const locked = useRef(false);
  const pool = (game: GameId, category?: string) => (category === '__custom' ? customs.data ?? [] : [...BUNDLED, ...(customs.data ?? [])]).filter(p => p.game === game && (!category || category === '__custom' || p.category === category));
  async function notify(round: Round) {
    if (!uid || !coupleId || round.status === 'finished' || AppState.currentState !== 'active') return;
    const wantsPartner = round.status === 'lobby' || round.state.turn !== uid || round.game === 'rather' || round.game === 'know';
    if (!wantsPartner || round.state.reveal) return;
    try {
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id !== uid) return;
      const key = `gamenight-notify:${uid}:${coupleId}`; const now = Date.now();
      const previous = Number(await AsyncStorage.getItem(key));
      if (now - previous < NOTIFY_COOLDOWN) return;
      await AsyncStorage.setItem(key, String(now));
      const { error: failure } = await supabase.functions.invoke('notify-partner', { body: { channel: 'pulse', title: 'Your turn on game night', body: `${titles[round.game]} is ready for you.`, data: { route: '/us/gamenight', game: round.game, round: round.id } } });
      if (failure) setNotice('Game saved. The turn notification could not be sent.');
    } catch { setNotice('Game saved. The turn notification could not be sent.'); }
  }
  async function run(work: () => Promise<void>) {
    if (locked.current) return false;
    locked.current = true; setBusy(true); setError(null); setNotice(null);
    try {
      if (!uid || !coupleId || rounds.offline || AppState.currentState !== 'active') throw new Error('Connect to the internet and link your couple to play.');
      await work(); return true;
    } catch (failure) { setError(failure instanceof Error ? failure.message : typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : 'Could not save. Retry when connected.'); return false; }
    finally { locked.current = false; setBusy(false); }
  }
  async function action(kind: string, round?: Round, payload: Record<string, unknown> | (() => Record<string, unknown>) = {}) {
    return run(async () => {
      const { data: auth } = await supabase.auth.getSession();
      if (auth.session?.user.id !== uid) throw new Error('Your account changed. Reopen Game night.');
      const resolved = typeof payload === 'function' ? payload() : payload;
      const { data, error: failure } = await db.rpc('gamenight_action', { p_action: kind, p_round: round?.id ?? null, p_payload: { ...resolved, ...(round ? { step: round.state.step } : {}) } });
      if (failure) throw failure;
      const saved = roundSchema.parse(data);
      await Promise.all([rounds.refetch(), active.refetch(), stats.refetch()]);
      await notify(saved);
    });
  }
  function start(game: GameId, category?: string, previous?: Round) {
    return action('start', undefined, () => ({ game, prompt: game === 'connect' ? null : pickPrompt(pool(game, category), previous?.state.prompt?.id) }));
  }
  function next(round: Round, category?: string) {
    const last = round.state.step >= (round.game === 'roulette' ? 7 : 9);
    return action('next', round, () => ({ prompt: last ? null : pickPrompt(pool(round.game, category), round.state.prompt?.id) }));
  }
  function spin(round: Round, category?: string) {
    const all = pool('roulette', category); const fresh = all.filter(p => p.id !== round.state.prompt?.id);
    const prompts = fresh.length ? fresh : all;
    // Uniform shuffle keeps custom entries eligible even with a full bundled deck.
    for (let i = prompts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const p = prompts[i]!; prompts[i] = prompts[j]!; prompts[j] = p; }
    return action('spin', round, { pool: prompts.slice(0, 104) });
  }
  function addCustom(prompt: Omit<Prompt, 'id'>) {
    return run(async () => {
      customSchema.omit({ id: true, created_at: true }).parse({ ...prompt, couple_id: coupleId, created_by: uid });
      const { error: failure } = await db.from('gamenight_prompts').insert({ ...prompt, couple_id: coupleId, created_by: uid });
      if (failure) throw failure;
      await customs.refetch(); setNotice('Custom prompt saved for both of you.');
    });
  }
  function deleteCustom(id: string) {
    return run(async () => { const { error: failure } = await db.from('gamenight_prompts').delete().eq('id', id).eq('couple_id', coupleId!).eq('created_by', uid!); if (failure) throw failure; await customs.refetch(); });
  }
  const games = [...(active.data ?? []), ...(rounds.data ?? []).filter(r => !(active.data ?? []).some(a => a.id === r.id))];
  return { uid, coupleId, profile, partner, rounds, active, games, foreground, customs, stats, busy, error, notice, pool, action, start, next, spin, addCustom, deleteCustom,
    refresh: () => { void Promise.all([profile.refetch(), partner.refetch(), rounds.refetch(), active.refetch(), customs.refetch(), stats.refetch()]); } };
}
/** A round update changes RLS visibility of existing choices, so key by its revision.
 * The query is narrow: even an old unfinished game survives bounded history. */
export function useRoundChoices(engine: GameNightEngine, round: Round) {
  return useQuery({ queryKey: ['gamenight-choices', engine.coupleId, engine.uid, round.id, round.state.step, round.updated_at],
    enabled: !!engine.uid && !!engine.coupleId && engine.foreground && !engine.rounds.offline && (round.game === 'know' || round.game === 'rather'),
    queryFn: async ({ signal }) => { const { data, error: failure } = await db.from('gamenight_choices').select('*').eq('couple_id', engine.coupleId!).eq('round_id', round.id).eq('step', round.state.step).abortSignal(signal); if (failure) throw failure; return (data ?? []).map(row => choiceSchema.parse(row)); } });
}
export type GameNightEngine = ReturnType<typeof useGameNight>;
