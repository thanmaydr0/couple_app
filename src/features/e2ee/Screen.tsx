import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, Header, Card, Text, Button } from '@/ui';
import { FormField } from '@/ui/FormField';
import { useTheme } from '@/theme';
import { useSecureScreen } from '@/features/applock';
import { acknowledgeKey, refreshCrypto, restoreKeys, setEncryption, setupKeys } from './runtime';
import { useEncryption } from './Status';
import { encryptAuthoredHistory } from './history';
import { SafetyVisual } from './SafetyVisual';
export default function EncryptionScreen() {
  const state = useEncryption(); const { spacing } = useTheme();
  const protection = useSecureScreen(true);
  const [passphrase, setPassphrase] = useState(''); const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false); const [status, setStatus] = useState(''); const [error, setError] = useState('');
  const [compare, setCompare] = useState('');
  const run = async (action: () => Promise<unknown>, success: string) => {
    if (busy) return; setBusy(true); setError(''); setStatus('');
    try { await action(); setStatus(success); setPassphrase(''); setConfirm(''); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unavailable. Reconnect and retry.'); }
    finally { setBusy(false); }
  };
  const progress = (fraction: number) => setStatus(`Securing recovery key… ${Math.round(fraction * 100)}%`);
  const setup = (reset = false) => run(async () => {
    if (passphrase !== confirm) throw new Error('The recovery passphrases do not match');
    await setupKeys(passphrase, progress, reset);
  }, 'Recovery backup saved. Keep your passphrase somewhere safe.');
  return <Screen bottomInset><Header title="Privacy · Encryption" onBack={() => router.back()} />
    {!protection.ready ? <View style={{ padding: spacing.lg }}><Text color="danger">{protection.error ?? 'Protecting this screen…'}</Text></View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
      <Card style={{ gap: spacing.md }}>
        <Text variant="title/M">{state.enabled ? 'Chat encryption is on' : 'Chat encryption is off'}</Text>
        <Text>Update both phones first. Each phone must register a recovery-backed key. Encrypted messages, photos, voice notes and reactions need your keys. Timestamps, participants, sizes, reply relationships and receipts remain visible.</Text>
        <Text color="textSecondary">No forward secrecy. Losing your phone and recovery passphrase can permanently lock you out. Turning encryption off affects future sends; it does not decrypt history.</Text>
        <Text>{state.local ? 'This phone has your key.' : state.registered ? 'Restore your key on this phone.' : 'Register this phone’s key.'} {state.both ? 'Both accounts have keys.' : 'Waiting for both accounts to register.'}</Text>
        {!!state.changed && <Text accessibilityRole="alert" color="danger">Safety number changed. Confirm with your partner before continuing; a new key or an attack can cause this. The chat banner stays until acknowledged.</Text>}
        {!!state.error && <Text color="danger">{state.error}</Text>}
        <Button title="Refresh online status" disabled={busy} onPress={() => void run(refreshCrypto, 'Encryption status refreshed.')} />
      </Card>
      <Card style={{ gap: spacing.md }}>
        <Text variant="title/M">Recovery passphrase</Text>
        <Text>Prefer six random words. Save them outside this phone; never send them in chat. The encrypted backup is on Supabase; the passphrase is never uploaded. Weak passphrases can be guessed offline.</Text>
        <FormField label="Recovery passphrase" value={passphrase} onChangeText={setPassphrase} secureTextEntry autoCorrect={false} autoCapitalize="none" editable={!busy} />
        <FormField label="Confirm for registration or reset" value={confirm} onChangeText={setConfirm} secureTextEntry autoCorrect={false} autoCapitalize="none" editable={!busy} />
        {!state.registered && <Button title="Register key and recovery backup" disabled={busy || !state.user} loading={busy} onPress={() => void setup()} />}
        {state.registered && <Button title="Restore existing key" disabled={busy} onPress={() => void run(() => restoreKeys(passphrase, progress), 'Key restored. History encrypted for this key is readable.')} />}
        {state.registered && <Button title="Reset lost key…" variant="ghost" disabled={busy} onPress={() => Alert.alert('Old history may become unreadable', 'Reset replaces your key and backup. Old messages need the old key. Your partner will see a changed safety number. Keep any old device until recovery is resolved.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace key and backup', style: 'destructive', onPress: () => void setup(true) }])} />}
      </Card>
      {!!state.safety && <Card style={{ gap: spacing.md }}>
        <Text variant="title/M">Compare in person</Text><SafetyVisual number={state.safety} /><Text selectable>{state.safety}</Text>
        <Text>Compare all 60 digits on both phones, or paste the other phone’s number below through a trusted channel. The visual fingerprint is for side-by-side comparison; it is not a scannable QR code.</Text>
        <FormField label="Partner’s 60-digit safety number" value={compare} onChangeText={setCompare} keyboardType="number-pad" />
        <Button title={state.verified ? 'Verified on this phone' : 'Mark matching safety number verified'} disabled={busy || compare.replace(/\s/g, '') !== state.safety.replace(/\s/g, '')} onPress={() => void run(() => acknowledgeKey(true), 'Safety number verified on this phone.')} />
        {state.changed && <Button title="Acknowledge change without verification" variant="ghost" disabled={busy} onPress={() => void run(() => acknowledgeKey(false), 'Change acknowledged. Compare numbers before trusting the new key.')} />}
      </Card>}
      <Card style={{ gap: spacing.md }}>
        <Button title={state.enabled ? 'Turn off encryption…' : 'Turn on encryption…'} disabled={busy || !state.user || !state.enabled && (!state.local || !state.both || state.changed)} onPress={() => Alert.alert(state.enabled ? 'Future messages will be plaintext' : 'Turn on chat encryption', state.enabled ? 'Encrypted history still needs your key. Your partner will see encryption is off.' : 'Update both phones first. Older clients cannot send. Cancel pending plaintext schedules first. Compare safety numbers together.', [{ text: 'Cancel', style: 'cancel' }, { text: state.enabled ? 'Turn off' : 'Turn on', onPress: () => void run(() => setEncryption(!state.enabled), 'Encryption setting updated for both phones.') }])} />
        <Button title="Encrypt my legacy history" variant="ghost" disabled={busy || !state.enabled || !state.local} onPress={() => void run(() => encryptAuthoredHistory((done, skipped) => setStatus(`Encrypted ${done} messages; skipped ${skipped} view-once photos.`)), 'History pass finished. Legacy view-once photos stay unchanged. Each partner runs their own pass.')} />
        <Text color="textSecondary">History conversion can be retried. It cannot erase plaintext in server backups, push logs or old phones. Legacy view-once photos cannot be safely converted and are skipped.</Text>
      </Card>
      {!!status && <Text accessibilityLiveRegion="polite">{status}</Text>}{!!error && <Text accessibilityRole="alert" color="danger">{error}</Text>}
    </ScrollView>}
  </Screen>;
}
