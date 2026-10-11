import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { Chess, Color, Square } from 'chess.js';
import type { ChessGameRow } from '@/types/db';
import { glyphs } from './rules';

export function Board({ chess, game, color, selected, disabled, onTap }: {
  chess: Chess; game: ChessGameRow; color: Color; selected: Square | null; disabled: boolean; onTap: (square: Square) => void;
}) {
  const { width } = useWindowDimensions();
  const size = Math.floor(Math.min(width - 48, 480) / 8);
  const files = color === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = color === 'w' ? '87654321' : '12345678';
  const legal = selected ? chess.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  return <View style={{ alignSelf: 'center', width: size * 8, borderRadius: 8, overflow: 'hidden' }}>{[...ranks].map((rank, row) => <View key={rank} style={{ flexDirection: 'row' }}>{[...files].map((file, col) => {
    const square = `${file}${rank}` as Square;
    const piece = chess.get(square);
    const check = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck();
    const last = game.last_move_from === square || game.last_move_to === square;
    const light = (row + col) % 2 === 0;
    return <Pressable key={square} disabled={disabled} onPress={() => onTap(square)} accessibilityRole="button"
      accessibilityLabel={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${ { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }[piece.type]}` : ' empty'}${legal.includes(square) ? ', legal move' : ''}`}
      accessibilityState={{ selected: selected === square, disabled }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: check ? '#ED797B' : selected === square ? '#EBA5B5' : last ? '#C6BA83' : light ? '#EADDCF' : '#9B7489' }}>
      {piece && <Text allowFontScaling={false} style={{ fontSize: size * 0.78, lineHeight: size * 0.96, color: piece.color === 'w' ? '#FFF9EE' : '#241927', textShadowColor: piece.color === 'w' ? '#362037' : '#F3E5D9', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>{glyphs[piece.color][piece.type]}</Text>}
      {legal.includes(square) && <View pointerEvents="none" style={piece ? styles.capture : styles.dot} />}
      {col === 0 && <Text allowFontScaling={false} style={[styles.rank, { color: light ? '#553D50' : '#FFF4E8' }]}>{rank}</Text>}
      {row === 7 && <Text allowFontScaling={false} style={[styles.file, { color: light ? '#553D50' : '#FFF4E8' }]}>{file}</Text>}
    </Pressable>;
  })}</View>)}</View>;
}
const styles = StyleSheet.create({
  dot: { position: 'absolute', width: '24%', height: '24%', borderRadius: 99, backgroundColor: '#36203770' },
  capture: { position: 'absolute', width: '90%', height: '90%', borderRadius: 99, borderWidth: 3, borderColor: '#36203790' },
  rank: { position: 'absolute', top: 1, left: 3, fontSize: 10, fontWeight: '700' }, file: { position: 'absolute', bottom: 0, right: 3, fontSize: 10, fontWeight: '700' },
});
