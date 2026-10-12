import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, useWindowDimensions } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import type { Chess, Color, Square, Piece as ChessPiece } from 'chess.js';
import type { ChessGameRow } from '@/types/db';
import { PressableScale, Text } from '@/ui';
import { FadeInView, motionTokens, useMotion } from '@/motion';
import { useTheme } from '@/theme';
import { Piece } from './Piece';
import { PopView } from './presentation';

function SquareContent({ chess, square, size, selected, check, from, animate }: { chess: Chess; square: Square; size: number; selected: boolean; check: boolean; from: Square | null; animate: boolean }) {
  const piece = chess.get(square); const before = useRef(piece); const [ghost, setGhost] = useState<ChessPiece | null>(null); const fade = useSharedValue(0); const motion = useMotion(); const { colors, spacing, radius, geometry, elevations } = useTheme();
  useEffect(() => {
    const old = before.current; before.current = piece;
    if (old && old.color === chess.turn() && (!piece || piece.color !== old.color)) {
      setGhost(old); fade.value = motion.level === 'off' ? 0 : 1;
      fade.value = withTiming(0, { duration: motion.duration('base') });
    }
    return () => cancelAnimation(fade);
  }, [chess.fen(), square, motion.level, fade]);
  const captureStyle = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: motion.level === 'full' ? fade.value : 1 }] }));
  const x = useSharedValue(0); const y = useSharedValue(0); const lift = useSharedValue(0); const pulse = useSharedValue(1);
  useEffect(() => {
    cancelAnimation(x); cancelAnimation(y);
    if (animate && from && motion.level === 'full') {
      x.value = (from.charCodeAt(0) - square.charCodeAt(0)) * size;
      y.value = (Number(square[1]) - Number(from[1])) * size;
      x.value = withSpring(0, motion.spring('gentle')); y.value = withSpring(0, motion.spring('gentle'));
    } else { x.value = 0; y.value = 0; }
    return () => { cancelAnimation(x); cancelAnimation(y); };
  }, [from, square, size, motion.level, chess.fen(), x, y]);
  useEffect(() => { lift.value = motion.level === 'full' ? withSpring(selected ? -spacing.xs : 0, motion.spring('snappy')) : 0; }, [selected, motion.level, lift, spacing.xs]);
  useEffect(() => { cancelAnimation(pulse); pulse.value = 1; if (check && motion.level === 'full') pulse.value = withRepeat(withTiming(0.4, { duration: motion.duration('pulse') }), -1, true); return () => cancelAnimation(pulse); }, [check, motion.level, pulse]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value + lift.value }] }));
  const warning = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <>{ghost && <Animated.View pointerEvents="none" style={[{ position: 'absolute' }, captureStyle]}><Piece type={ghost.type} color={ghost.color} size={Math.abs(size) - spacing.xs} /></Animated.View>}{check && <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: geometry.hairline, borderColor: colors.danger, borderWidth: geometry.stroke, borderRadius: radius.sm }, warning]} />}{piece && <Animated.View pointerEvents="none" style={[{ shadowColor: colors.shadowColor, shadowOpacity: elevations[1]!.opacity, shadowRadius: elevations[1]!.blur, shadowOffset: { width: 0, height: elevations[1]!.y } }, style]}><Piece type={piece.type} color={piece.color} size={Math.abs(size) - spacing.xs} /></Animated.View>}</>;
}

export function Board({ chess, game, color, selected, disabled, onTap }: {
  chess: Chess; game: ChessGameRow; color: Color; selected: Square | null; disabled: boolean; onTap: (square: Square) => void;
}) {
  const { width } = useWindowDimensions(); const { colors, spacing, radius, geometry, typography } = useTheme();
  const previous = useRef(game.fen); const moved = previous.current !== game.fen;
  useEffect(() => { previous.current = game.fen; }, [game.fen]);
  const size = Math.max(geometry.touch, Math.floor((width - spacing.lg * 2) / 8));
  const files = color === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = color === 'w' ? '87654321' : '12345678';
  const lastMove = chess.history({ verbose: true }).slice(-1)[0];
  const legal = selected ? chess.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  return <ScrollView horizontal accessibilityLabel="Chess board; scroll horizontally on narrow screens" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}><View style={{ width: size * 8, borderRadius: radius.sm, overflow: 'hidden' }}>{[...ranks].map((rank, row) => <View key={rank} style={{ flexDirection: 'row', zIndex: game.last_move_to?.[1] === rank ? 1 : 0 }}>{[...files].map((file, col) => {
    const square = `${file}${rank}` as Square; const piece = chess.get(square);
    const check = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck();
    const last = game.last_move_from === square || game.last_move_to === square;
    const castleRook = lastMove?.isKingsideCastle() && square === `f${lastMove.to[1]}` ? `h${lastMove.to[1]}` : lastMove?.isQueensideCastle() && square === `d${lastMove.to[1]}` ? `a${lastMove.to[1]}` : null;
    return <PressableScale key={square} haptic={false} disabled={disabled} onPress={() => onTap(square)} accessibilityRole="button"
      accessibilityLabel={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${{ k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' }[piece.type]}` : ' empty'}${legal.includes(square) ? ', legal move' : ''}${check ? ', in check' : ''}`}
      accessibilityState={{ selected: selected === square, disabled }}
      style={{ width: size, height: size, zIndex: selected === square || game.last_move_to === square ? 1 : 0, alignItems: 'center', justifyContent: 'center', backgroundColor: (row + col) % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
      {(last || selected === square) && <FadeInView key={`${game.fen}-${selected}`} pointerEvents="none" style={{ position: 'absolute', inset: geometry.hairline, borderRadius: radius.sm, borderWidth: geometry.stroke, borderColor: colors.primary }} />}
      <SquareContent chess={chess} square={square} size={color === 'w' ? size : -size} selected={selected === square} check={check} from={(castleRook ?? game.last_move_from) as Square | null} animate={moved && (game.last_move_to === square || !!castleRook)} />
      {legal.includes(square) && <PopView key={`${selected}-${square}`} delay={legal.indexOf(square) * motionTokens.stagger} pointerEvents="none" style={piece ? { position: 'absolute', width: size - spacing.xs, height: size - spacing.xs, borderRadius: radius.pill, borderWidth: geometry.stroke, borderColor: colors.primary } : { position: 'absolute', width: geometry.dot, height: geometry.dot, borderRadius: radius.pill, backgroundColor: colors.primary }} />}
      {col === 0 && <Text allowFontScaling={false} style={{ position: 'absolute', top: 0, left: spacing.xs, ...typography.caption }}>{rank}</Text>}
      {row === 7 && <Text allowFontScaling={false} style={{ position: 'absolute', bottom: 0, right: spacing.xs, ...typography.caption }}>{file}</Text>}
    </PressableScale>;
  })}</View>)}</View></ScrollView>;
}
