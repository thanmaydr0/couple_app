import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Screen, Text, Button, Header, Card } from '@/ui';
import { useTheme } from '@/theme';
import { FadeInView, HeartbeatView, PulseRing } from '@/motion';
import { FailureToast, OfflineNotice } from '@/features/presence/Presentation';
import { FormField } from '@/ui/FormField';
export default function LoginScreen() {
  const { colors, spacing, geometry } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signIn = async () => {
    if (busy) return;
    setError('');
    if (!isSupabaseConfigured) { setError('The app is missing its Supabase configuration. Please contact the admin.'); return; }
    if (!email.trim() || !password) { setError('Enter your email and password to continue.'); return; }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;
    } catch (cause) { setError(friendlyError(cause)); }
    finally { setBusy(false); }
  };
  return <Screen bottomInset gradient><KeyboardAvoidingView behavior="height" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl }}>
    <View style={{ gap: spacing.lg }}>
      <OfflineNotice /><FailureToast message={error} />
      <FadeInView><HeartbeatView><PulseRing size={spacing.s56}><Ionicons name="heart" size={geometry.icon} color={colors.primary} /></PulseRing></HeartbeatView></FadeInView>
      <Header title="A little closer." subtitle="Your private space for the two of you. Sign in with your admin-created account." />
      <FadeInView><Card style={{ gap: spacing.md }}>
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!busy} returnKeyType="go" onSubmitEditing={() => { void signIn(); }} />
      {!!error && <Text accessibilityRole="alert" color="danger">{error}</Text>}
      <Button title={busy ? 'Signing in…' : 'Sign in'} loading={busy} disabled={busy} onPress={() => { void signIn(); }} />
      </Card></FadeInView>
      <Text variant="caption" color="textSecondary">A little space, just for us.</Text>
    </View>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
