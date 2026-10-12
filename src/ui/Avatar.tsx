import { useState } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';
import { geometry as metrics } from '../theme/tokens';
export function Avatar({ name, uri, size = metrics.avatar }: { name: string; uri?: string; size?: number }) {
  const { colors, geometry } = useTheme(); const [failedUri, setFailedUri] = useState<string>();
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri && uri !== failedUri ? <Image source={{ uri }} accessibilityLabel={name} style={style} contentFit="cover" onError={() => setFailedUri(uri)} /> : <View accessible accessibilityLabel={name} style={[style, { backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }]}><Text color="primary" style={{ fontSize: size * geometry.avatarInitialRatio }}>{name.trim().charAt(0).toUpperCase() || '?'}</Text></View>;
}
