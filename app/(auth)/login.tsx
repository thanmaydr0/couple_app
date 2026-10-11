import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Screen, Text, Button, theme } from '@/ui';
import { FormField } from '@/ui/FormField';
export default function LoginScreen() {
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
  return <Screen bottomInset><KeyboardAvoidingView behavior="height" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 32 }}>
    <View style={{ gap: 24 }}>
      <Ionicons name="heart" size={56} color={theme.colors.primary} />
      <Text accessibilityRole="header" style={{ fontSize: 38, lineHeight: 46, fontWeight: '700' }}>A little closer.</Text>
      <Text style={{ color: theme.colors.muted }}>Your private space for the two of you. Sign in with the account your admin created.</Text>
      <FormField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" editable={!busy} />
      <FormField label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" editable={!busy} returnKeyType="go" onSubmitEditing={() => { void signIn(); }} />
      {!!error && <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text>}
      <Button title={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={() => { void signIn(); }} />
    </View>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
