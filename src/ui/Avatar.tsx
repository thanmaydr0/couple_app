import { useState } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../theme';
import { geometry as metrics } from '../theme/tokens';

export function Avatar({ name, uri, size = metrics.avatar }: { name: string; uri?: string; size?: number }) {
  const { colors, surfaces, geometry } = useTheme();
  const [failedUri, setFailedUri] = useState<string>();
  const style = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surfaces.rimStrong,
  };

  return uri && uri !== failedUri ? (
    <Image
      source={{ uri }}
      accessibilityLabel={name}
      style={style}
      contentFit="cover"
      transition={200}
      onError={() => setFailedUri(uri)}
    />
  ) : (
    <View
      accessible
      accessibilityLabel={name}
      style={[
        style,
        {
          backgroundColor: surfaces.softPrimary,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text color="primary" style={{ fontSize: size * geometry.avatarInitialRatio, fontWeight: '600' }}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
