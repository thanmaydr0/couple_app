import { Text as NativeText, type TextProps } from 'react-native';
import { theme } from './theme';

export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ color: theme.colors.text, fontSize: 16, lineHeight: 24 }, style]} />;
}
