import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { friendlyError } from '@/lib/errors';
import { Screen, Text, Button, Card } from '@/ui';
import { useTheme } from '@/theme';
import { FadeInView, HeartbeatView, PulseRing } from '@/motion';
import { FailureToast, OfflineNotice } from '@/features/presence/Presentation';
import { FormField } from '@/ui/FormField';

export default function LoginScreen() {
  const { colors, surfaces, spacing, radius } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    if (busy) return;
    setError('');
    if (!isSupabaseConfigured) {
      setError('The app is missing its Supabase configuration. Please contact the admin.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    setBusy(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) throw authError;
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen bottomInset atmosphere>
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: spacing.xl }}
        >
          <View style={{ gap: spacing.lg }}>
            <OfflineNotice />
            <FailureToast message={error} />

            <FadeInView style={{ alignItems: 'center', gap: spacing.md }}>
              <HeartbeatView>
                <PulseRing size={80}>
                  <View
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: radius.pill,
                      backgroundColor: surfaces.softPrimary,
                      borderWidth: StyleSheet.hairlineWidth,
                      borderColor: surfaces.rimStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="heart" size={26} color={colors.primary} />
                  </View>
                </PulseRing>
              </HeartbeatView>
              <View style={{ alignItems: 'center', gap: spacing.xs }}>
                <Text variant="display/M" style={{ textAlign: 'center' }}>
                  A little closer.
                </Text>
                <Text variant="body/S" color="textSecondary" style={{ textAlign: 'center', maxWidth: 280 }}>
                  Your private space for the two of you. Sign in with your account to begin.
                </Text>
              </View>
            </FadeInView>

            <FadeInView delay={80}>
              <Card variant="elevated" style={{ gap: spacing.md, padding: spacing.lg }}>
                <FormField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  editable={!busy}
                />
                <FormField
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  editable={!busy}
                  returnKeyType="go"
                  onSubmitEditing={() => {
                    void signIn();
                  }}
                />
                {!!error && (
                  <Text accessibilityRole="alert" variant="body/S" color="danger">
                    {error}
                  </Text>
                )}
                <Button
                  title={busy ? 'Signing in…' : 'Sign in'}
                  loading={busy}
                  disabled={busy}
                  onPress={() => {
                    void signIn();
                  }}
                />
              </Card>
            </FadeInView>

            <Text variant="caption" color="textMuted" style={{ textAlign: 'center', letterSpacing: 0.4 }}>
              PRIVATE · ENCRYPTED · JUST FOR US
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
