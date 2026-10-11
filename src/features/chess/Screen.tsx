import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { Color, Square } from 'chess.js';
import { Screen, Text, Button, Card } from '@/ui';
import { usePresence } from '@/features/presence/PresenceProvider';
import { Board } from './Board';
import { captures, drawReason, glyphs, material, restore } from './rules';
import { useChess } from './useChess';

export default function ChessScreen() {
  const state = useChess();
  const online = usePresence(store => store.partnerOnline);
  const [playing, setPlaying] = useState(false);
  const [choice, setChoice] = useState<'w' | 'b' | 'random'>('random');
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const game = state.active ?? state.games[0];
  const restored = useMemo(() => {
    if (!game) return { chess: null, failure: null };
    try { return { chess: restore(game), failure: null }; }
    catch (error) { return { chess: null, failure: error instanceof Error ? error.message : 'Cannot load this board.' }; }
  }, [game?.fen, game?.pgn]);
  const chess = restored.chess;
  const color: Color = game?.black_id === state.uid ? 'b' : 'w';
  const participant = !!game && (game.white_id === state.uid || game.black_id === state.uid);
  const myTurn = participant && game?.status === 'active' && game.turn === color && !state.busy;
  useEffect(() => { setSelected(null); setPromotion(null); }, [game?.id, game?.fen, game?.status]);
  const partnerName = state.partner.data?.display_name || 'Your partner';
  function tap(square: Square) {
    if (!chess || !game || !myTurn) return;
    if (selected) {
      const moves = chess.moves({ square: selected, verbose: true }).filter(move => move.to === square);
      if (moves.length) {
        if (moves.some(move => move.promotion)) setPromotion({ from: selected, to: square });
        else { void state.move(game, selected, square); setSelected(null); }
        return;
      }
    }
    setSelected(chess.get(square)?.color === color && selected !== square ? square : null);
    void Haptics.selectionAsync().catch(() => {});
  }
  const result = game && chess ? game.status === 'active' ? 'Game in progress' : game.status === 'draw' || game.status === 'stalemate' ? drawReason(chess)
    : `${game.winner_id === state.uid ? 'You won' : `${partnerName} won`} · ${game.status === 'resigned' ? 'resignation' : 'checkmate'}` : '';
  const completed = state.games.filter(row => row.status !== 'active');
  return <Screen bottomInset><ScrollView contentContainerStyle={styles.content}>
    <View style={styles.row}><Text style={styles.title}>Chess</Text><Button title={playing ? 'Lobby' : 'Games'} onPress={() => playing ? setPlaying(false) : router.replace('/(tabs)/games')} /></View>
    <Text>{partnerName} · {online ? 'Online' : 'Offline'} · {state.connected ? 'Live sync' : 'Connecting / retrying'}</Text>
    {(state.error || restored.failure) && <Card><Text style={{ color: '#FF9C9C' }}>{state.error || restored.failure}</Text><Button title="Refresh" onPress={state.refresh} /></Card>}
    {state.nudge && <Text accessibilityLiveRegion="polite">{state.nudge}</Text>}
    {state.loading ? <Text>Loading your games…</Text> : !state.profile.data?.couple_id ? <Card><Text>Link your couple in Settings to play together.</Text></Card> : !playing || !game ? <>
      <Card style={styles.content}><Text style={styles.heading}>A little friendly rivalry</Text><Text>Take your time. Your board will be here when you return.</Text>
        {state.active ? <><Text>You play {color === 'w' ? 'white' : 'black'} · {state.active.turn === color ? 'Your turn' : 'Partner’s turn'}</Text><Button title="Resume game" onPress={() => setPlaying(true)} /></>
          : <><Text>Choose your color</Text><View style={styles.wrap}>{(['w', 'b', 'random'] as const).map(value => <Button key={value} title={`${choice === value ? '✓ ' : ''}${value === 'w' ? 'White' : value === 'b' ? 'Black' : 'Random'}`} onPress={() => setChoice(value)} disabled={state.busy} />)}</View>
            <Button title={state.busy ? 'Starting…' : 'New game'} disabled={state.busy || !state.partner.data || state.loading} onPress={() => { void state.start(choice).then(() => setPlaying(true)); }} /></>}
      </Card>
      {!state.partner.data && <Text>Waiting for your linked partner’s profile.</Text>}
      {game && game.status !== 'active' && <Card style={styles.content}><Text style={styles.heading}>{result}</Text><Button title="Rematch · swap colors" disabled={state.busy || !state.partner.data} onPress={() => { void state.start('random', game).then(() => setPlaying(true)); }} /><Button title="View final board" onPress={() => setPlaying(true)} /></Card>}
      <Text>Recent {completed.length} games: {completed.filter(row => row.winner_id === state.uid).length} wins · {completed.filter(row => row.winner_id && row.winner_id !== state.uid).length} losses · {completed.filter(row => !row.winner_id).length} draws</Text>
    </> : chess && <>
      <Text style={styles.heading} accessibilityLiveRegion="polite">{game.status !== 'active' ? result : `${myTurn ? 'Your turn' : game.turn === color ? 'Saving…' : `${partnerName}’s turn`}${chess.isCheck() ? ' · Check!' : ''}`}</Text>
      <Text>You play {color === 'w' ? 'white' : 'black'}{state.busy ? ' · Saving…' : ''}</Text>
      <Text>Partner captured: {captures(chess, color === 'w' ? 'b' : 'w').map(piece => glyphs[color][piece]).join(' ') || '—'}</Text>
      <Board chess={chess} game={game} color={color} selected={selected} disabled={!myTurn} onTap={tap} />
      <Text>You captured: {captures(chess, color).map(piece => glyphs[color === 'w' ? 'b' : 'w'][piece]).join(' ') || '—'} · Material {material(chess, color) > 0 ? '+' : ''}{material(chess, color)}</Text>
      {game.status === 'active' && participant ? <>
        {game.draw_offered_by && <Card style={styles.content}><Text>{game.draw_offered_by === state.uid ? 'Draw offered. Waiting for your partner.' : 'Your partner offers a draw.'}</Text>
          {game.draw_offered_by !== state.uid && <View style={styles.wrap}><Button title="Accept draw" disabled={state.busy} onPress={() => { void state.action(game, 'accept'); }} /><Button title="Decline" disabled={state.busy} onPress={() => { void state.action(game, 'decline'); }} /></View>}
        </Card>}
        <View style={styles.wrap}><Button title="👋 Nudge" disabled={!state.connected || state.busy} onPress={() => { void state.sendNudge(game); }} /><Button title="Offer draw" disabled={state.busy || !!game.draw_offered_by} onPress={() => { void state.action(game, 'offer'); }} /><Button title="Resign" disabled={state.busy} onPress={() => Alert.alert('Resign this game?', 'Your partner will win.', [{ text: 'Keep playing', style: 'cancel' }, { text: 'Resign', style: 'destructive', onPress: () => { void state.action(game, 'resign'); } }])} /></View>
      </> : <Button title="Rematch · swap colors" disabled={state.busy || !participant || !state.partner.data} onPress={() => { void state.start('random', game); }} />}
      <Card style={styles.content}><Text style={styles.heading}>Moves</Text>{chess.history().length ? Array.from({ length: Math.ceil(chess.history().length / 2) }, (_, index) => <Text key={index} selectable>{index + 1}. {chess.history()[index * 2]}   {chess.history()[index * 2 + 1] ?? ''}</Text>) : <Text>White moves first. Tap a piece to see its legal moves.</Text>}</Card>
    </>}
  </ScrollView>
    <Modal visible={!!promotion} transparent animationType="fade" onRequestClose={() => setPromotion(null)}><View style={styles.overlay}><Card style={styles.content}><Text style={styles.heading}>Promote your pawn</Text><View style={styles.wrap}>{(['q', 'r', 'b', 'n'] as const).map(piece => <Button key={piece} title={`${glyphs[color][piece]} ${ { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[piece]}`} onPress={() => { if (promotion && game && myTurn) void state.move(game, promotion.from, promotion.to, piece); setPromotion(null); setSelected(null); }} />)}</View><Button title="Cancel" onPress={() => setPromotion(null)} /></Card></View></Modal>
  </Screen>;
}
const styles = StyleSheet.create({ content: { gap: 16, paddingBottom: 24 }, title: { fontSize: 30, lineHeight: 38, fontWeight: '700' }, heading: { fontSize: 20, lineHeight: 28, fontWeight: '600' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, overlay: { flex: 1, backgroundColor: '#000A', justifyContent: 'center', padding: 24 } });
