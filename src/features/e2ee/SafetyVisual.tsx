import Svg, { Rect } from 'react-native-svg';
import nacl from 'tweetnacl';
import { utf8 } from './crypto';
import { useTheme } from '@/theme';
// Visual fingerprint for side-by-side comparison, deliberately not a QR code.
export function SafetyVisual({ number }: { number: string }) {
  const { colors, geometry } = useTheme();
  const hash = nacl.hash(utf8(`us.e2ee.visual.v1:${number}`));
  return <Svg accessibilityLabel="Visual safety fingerprint. Compare the 60 digits to verify." width={geometry.touch * 4} height={geometry.touch * 4} viewBox="0 0 18 18">
    <Rect width="18" height="18" fill={colors.surface} />
    {Array.from({ length: 256 }, (_, index) => (hash[Math.floor(index / 8)] ?? 0) & (1 << (index % 8)) ? <Rect key={index} x={index % 16 + 1} y={Math.floor(index / 16) + 1} width="1" height="1" fill={colors.textPrimary} /> : null)}
  </Svg>;
}
