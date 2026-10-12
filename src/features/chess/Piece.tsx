import Svg, { Path, Circle, G } from 'react-native-svg';
import type { Color, PieceSymbol } from 'chess.js';
import { useTheme } from '@/theme';

// Original silhouettes on a shared vector grid, with contrasting outlines.
export function Piece({ type, color, size }: { type: PieceSymbol; color: Color; size: number }) {
  const { colors, dark, geometry } = useTheme();
  const light = dark ? colors.textPrimary : colors.bgElevated;
  const ink = dark ? colors.bg : colors.textPrimary;
  const fill = color === 'w' ? light : ink;
  const stroke = color === 'w' ? ink : light;
  const paths: Record<PieceSymbol, string> = {
    p: 'M18 31 Q24 23 30 31 L33 41 H15 Z',
    r: 'M14 12 H20 V19 H25 V12 H30 V19 H35 V12 H40 V25 H35 L33 41 H19 L17 25 H14 Z',
    n: 'M16 41 L18 32 L28 23 L17 27 L12 22 L23 13 L24 7 L31 12 Q43 18 36 41 Z',
    b: 'M25 8 Q9 23 23 29 L18 41 H34 L29 29 Q43 23 25 8 Z M26 16 L22 24',
    q: 'M12 17 L20 24 L26 12 L32 24 L40 17 L34 38 H18 Z',
    k: 'M26 7 V20 M20 13 H32 M18 38 L16 27 Q12 18 22 21 L26 25 L30 21 Q40 18 36 27 L34 38 Z',
  };
  return <Svg width={size} height={size} viewBox="0 0 52 52" accessible={false}><G fill={fill} stroke={stroke} strokeWidth={geometry.stroke} strokeLinejoin="round" strokeLinecap="round">
    <Path d={paths[type]} />{type === 'p' && <Circle cx="24" cy="19" r="7" />}
    {type === 'n' && <Circle cx="29" cy="18" r="1" fill={stroke} />}
    <Path d="M16 41 H36 L39 46 H13 Z" />
  </G></Svg>;
}
