import { Image } from 'expo-image';
import { View } from 'react-native';
import { Text } from './Text';
import { theme } from './theme';

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string; size?: number }) {
  const style = { width: size, height: size, borderRadius: size / 2 };
  return uri ? <Image source={{ uri }} accessibilityLabel={name} style={style} contentFit="cover" /> :
    <View accessible accessibilityLabel={name} style={[style, { backgroundColor: theme.colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: theme.colors.primary, fontSize: size * 0.4 }}>{name.trim().charAt(0).toUpperCase() || '♥'}</Text>
    </View>;
}
