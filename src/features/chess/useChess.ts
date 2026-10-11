import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Chess, type Square } from 'chess.js';
import { usePartner, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import type { ChessGameRow, Update } from '@/types/db';
import { outcome, restore } from './rules';

export function useChess() {
  const profile = useProfile();
  const partner = usePartner();
  const uid = profile.data?.id;
  const coupleId = profile.data?.couple_id;
  const client = useQueryClient();
  const key = ['chess-games', coupleId];
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastNudge = useRef(0);
  const query = useQuery({
    queryKey: key, enabled: !!coupleId, refetchInterval: 15000,
    queryFn: async ({ signal }) => {
      const { data, error: failure } = await supabase.from('chess_games').select('*').eq('couple_id', coupleId!).order('created_at', { ascending: false }).limit(100).abortSignal(signal);
      if (failure) throw failure;
      return data;
    },
  });
  const refresh = useCallback(() => { void client.invalidateQueries({ queryKey: ['chess-games', coupleId] }); }, [client, coupleId]);
  useEffect(() => {
    if (!coupleId || !uid) return;
    const current = supabase.channel(`chess:${coupleId}`, { config: { private: true, broadcast: { ack: true } } });
    channel.current = current;
    current.on('postgres_changes', { event: '*', schema: 'public', table: 'chess_games', filter: `couple_id=eq.${coupleId}` }, refresh)
      .on('broadcast', { event: 'nudge' }, ({ payload }: { payload: { sender?: string; game?: string } }) => {
        const games = client.getQueryData<ChessGameRow[]>(['chess-games', coupleId]);
        if (payload.sender !== partner.data?.id || !games?.some(game => game.id === payload.game && game.status === 'active')) return;
        setNudge('👋 Your partner nudged you!');
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }).subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') refresh();
      });
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { listener.remove(); channel.current = null; void supabase.removeChannel(current); };
  }, [coupleId, uid, partner.data?.id, client, refresh]);
  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => setNudge(null), 5000);
    return () => clearTimeout(timer);
  }, [nudge]);

  async function run(work: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(null);
    try { await work(); } catch (failure) {
      setError(failure instanceof Error ? failure.message : typeof failure === 'object' && failure && 'message' in failure ? String(failure.message) : 'Could not save. Please retry.');
      refresh();
    } finally { locked.current = false; setBusy(false); }
  }
  async function update(game: ChessGameRow, patch: Update<'chess_games'>) {
    if (!uid || ![game.white_id, game.black_id].includes(uid) || game.status !== 'active') throw new Error('This game is no longer available.');
    await client.cancelQueries({ queryKey: key });
    const optimistic = { ...game, ...patch, updated_at: new Date(Math.max(Date.now(), Date.parse(game.updated_at) + 1)).toISOString() };
    client.setQueryData<ChessGameRow[]>(key, old => old?.map(row => row.id === game.id ? optimistic : row));
    try {
      const { data, error: failure } = await supabase.from('chess_games').update({ ...patch, updated_at: optimistic.updated_at })
        .eq('id', game.id).eq('couple_id', game.couple_id).eq('fen', game.fen).eq('turn', game.turn).eq('updated_at', game.updated_at).eq('status', 'active').select().maybeSingle();
      if (failure) throw failure;
      if (!data) throw new Error('Your partner changed the game. Refreshing the board; try again.');
      client.setQueryData<ChessGameRow[]>(key, old => old?.map(row => row.id === game.id && row.updated_at === optimistic.updated_at ? data : row));
    } catch (failure) {
      // Restore immediately even offline; never overwrite a newer Realtime fetch.
      client.setQueryData<ChessGameRow[]>(key, old => old?.map(row => row.id === game.id && row.updated_at === optimistic.updated_at ? game : row));
      throw failure;
    } finally { refresh(); }
    void Haptics.selectionAsync().catch(() => {});
  }
  const games = query.data ?? [];
  const active = games.find(game => game.status === 'active');
  function start(choice: 'w' | 'b' | 'random', previous?: ChessGameRow) {
    return run(async () => {
      if (!uid || !coupleId || !partner.data) throw new Error('Both partners must be linked before starting chess.');
      const { data: existing, error: lookupError } = await supabase.from('chess_games').select('id').eq('couple_id', coupleId).eq('status', 'active').limit(1);
      if (lookupError) throw lookupError;
      if (existing?.length) { refresh(); return; }
      const color = choice === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : choice;
      const { error: failure } = await supabase.from('chess_games').insert({ couple_id: coupleId,
        white_id: previous ? previous.black_id : color === 'w' ? uid : partner.data.id,
        black_id: previous ? previous.white_id : color === 'b' ? uid : partner.data.id,
        fen: new Chess().fen(), pgn: '', turn: 'w', status: 'active' });
      refresh();
      if (failure) throw failure;
    });
  }
  function move(game: ChessGameRow, from: Square, to: Square, promotion?: string) {
    return run(async () => {
      if ((game.turn === 'w' ? game.white_id : game.black_id) !== uid) throw new Error('Wait for your partner’s turn.');
      const chess = restore(game);
      const played = chess.move({ from, to, promotion });
      const status = outcome(chess);
      await update(game, { fen: chess.fen(), pgn: chess.pgn(), turn: chess.turn(), status,
        winner_id: status === 'checkmate' ? uid : null, last_move_from: played.from, last_move_to: played.to, draw_offered_by: null });
    });
  }
  function action(game: ChessGameRow, kind: 'resign' | 'offer' | 'accept' | 'decline') {
    return run(async () => {
      if (kind === 'offer' && game.draw_offered_by) throw new Error('A draw offer is already pending.');
      if ((kind === 'accept' || kind === 'decline') && (!game.draw_offered_by || game.draw_offered_by === uid)) throw new Error('No partner draw offer to respond to.');
      await update(game, kind === 'resign' ? { status: 'resigned', winner_id: uid === game.white_id ? game.black_id : game.white_id, draw_offered_by: null }
        : kind === 'accept' ? { status: 'draw', winner_id: null, draw_offered_by: null }
          : { draw_offered_by: kind === 'offer' ? uid : null });
    });
  }
  async function sendNudge(game: ChessGameRow) {
    if (!connected || Date.now() - lastNudge.current < 5000) return;
    lastNudge.current = Date.now();
    const result = await channel.current?.send({ type: 'broadcast', event: 'nudge', payload: { sender: uid, game: game.id } });
    if (result !== 'ok') setError('Nudge could not be delivered. Try again when connected.');
    else setNudge('👋 Nudge sent');
  }
  return { games, active, profile, partner, uid, busy, error: error ?? query.error?.message ?? profile.error?.message ?? partner.error?.message,
    loading: query.isPending && !!coupleId || profile.isPending, connected, nudge, start, move, action, sendNudge, refresh };
}
