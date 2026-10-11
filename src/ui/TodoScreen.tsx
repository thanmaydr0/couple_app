import { Screen } from './Screen';
import { Text } from './Text';

export function TodoScreen({ feature }: { feature: string }) {
  return <Screen centered><Text accessibilityRole="header">TODO {feature}</Text></Screen>;
}
