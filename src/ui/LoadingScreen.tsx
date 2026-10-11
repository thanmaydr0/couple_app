import { View } from 'react-native';
import { Screen } from './Screen';
import { Text } from './Text';
import { theme } from './theme';
export function LoadingScreen() {
  return <Screen><Text accessibilityRole="header">Getting your space ready…</Text>
    <View accessibilityLabel="Loading" accessibilityRole="progressbar" style={{ gap: 20, marginTop: 32 }}>
      {[100, 160, 100, 100].map((height, index) => <View key={index} style={{ height, borderRadius: 20, backgroundColor: theme.colors.surfaceRaised }} />)}
    </View>
  </Screen>;
}
