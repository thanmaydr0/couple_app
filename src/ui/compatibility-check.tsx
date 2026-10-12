/** Compile-only contracts: original public props and direct module paths. */
import { theme, Screen, Text, Button, IconButton, Avatar, Card } from './index';
import type { ButtonProps } from './Button';
import { FormField } from './FormField';
import { LoadingScreen } from './LoadingScreen';
import { TodoScreen } from './TodoScreen';
import type { PressableProps, TextProps, ViewProps } from 'react-native';
const button: ButtonProps = { title: 'Save', style: state => ({ opacity: state.pressed ? 0.7 : 1 }) };
export function LegacyCompatibilityContracts({ text, view, press }: { text: TextProps; view: ViewProps; press: PressableProps }) {
  return <Screen centered bottomInset style={{ padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.background }}><Text {...text} /><Card {...view} /><Button {...button} /><Button {...press} title="Legacy press" /><IconButton {...press} name="heart-outline" accessibilityLabel="Like" /><Avatar name="Alex" uri="https://example.com/avatar.jpg" size={48} /><FormField label="Name" value="Alex" onChangeText={() => {}} /><LoadingScreen /><TodoScreen feature="home" /></Screen>;
}
