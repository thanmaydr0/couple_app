import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router, Stack } from 'expo-router';
import Constants from 'expo-constants';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAvatar, useCouple, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { uploadAvatar, validAnniversary } from '@/lib/settings';
import { friendlyError } from '@/lib/errors';
import { Avatar, Button, Card, Screen, Text, Header, ErrorState, ListItem, PressableScale } from '@/ui';
import { useTheme } from '@/theme';
import { StaggerList } from '@/motion';
import { FailureToast, OfflineNotice, PageSkeleton } from '@/features/presence/Presentation';
import { FormField } from '@/ui/FormField';
import { testNotification, unregisterPush } from '@/features/notifications/service';
import { SettingsSections } from '@/features/shared/FeatureSlots';
import { ProfileDetails } from '@/features/settings/ProfileDetails';
import { stopSharing } from '@/features/location/runtime';

export default function SettingsScreen() {
  const { spacing, geometry } = useTheme();
  const profile = useProfile();
  const couple = useCouple();
  const avatar = useAvatar(profile.data?.avatar_path);
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [anniversary, setAnniversary] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { setName(profile.data?.display_name ?? ''); }, [profile.data?.display_name]);
  useEffect(() => { setAnniversary(couple.data?.anniversary ?? ''); }, [couple.data?.anniversary]);
  const saveName = useMutation({ mutationFn: async () => {
    if (!profile.data) throw new Error('Missing profile');
    if (!name.trim() || name.trim().length > 80) { throw new Error('Display name must be between 1 and 80 characters.'); }
    const { error: updateError } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', profile.data.id).select('id').single();
    if (updateError) throw updateError;
    await client.invalidateQueries({ queryKey: ['profile'] });
    return 'Display name saved.';
  } });
  const saveAnniversary = useMutation({ mutationFn: async () => {
    if (!couple.data) throw new Error('Missing couple');
    if (!validAnniversary(anniversary)) throw new Error('Enter a valid date as YYYY-MM-DD, or leave it blank.');
    const { error: updateError } = await supabase.from('couples').update({ anniversary: anniversary || null }).eq('id', couple.data.id).select('id').single();
    if (updateError) throw updateError;
    await client.invalidateQueries({ queryKey: ['couple'] });
    return 'Anniversary saved.';
  } });
  const avatarMutation = useMutation({ mutationFn: async () => {
    if (!profile.data) throw new Error('Missing profile');
    const path = await uploadAvatar(profile.data);
    if (!path) return '';
    await client.invalidateQueries({ queryKey: ['profile'] });
    await client.invalidateQueries({ queryKey: ['avatar'] });
    return 'Avatar updated.';
  } });
  const logout = useMutation({ mutationFn: async () => {
    await stopSharing();
    if (profile.data) await unregisterPush(profile.data.id);
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    return '';
  } });
  const pushTest = useMutation({ mutationFn: async () => {
    if (!profile.data) throw new Error('Missing profile');
    return testNotification(profile.data.id);
  } });
  const busy = saveName.isPending || saveAnniversary.isPending || avatarMutation.isPending || logout.isPending || pushTest.isPending;
  const perform = async (action: () => Promise<string>) => {
    setMessage(''); setError('');
    try { setMessage(await action()); }
    catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(/^(Display name|Enter a valid date|The remote test|Could not (save|remove) notification|The EAS push)/.test(detail) ? detail : /permission denied/i.test(detail) ? 'Allow access to photos in Android settings, then try again.' : friendlyError(cause));
    }
  };
  if (profile.isPending || couple.isPending) return <><Stack.Screen options={{ headerShown: false }} /><PageSkeleton title="Settings" /></>;
  if (profile.isError || couple.isError || !profile.data || !couple.data) return <Screen><Stack.Screen options={{ headerShown: false }} /><Header title="Settings" onBack={() => router.back()} /><OfflineNotice /><FailureToast message="We couldn’t load settings." /><ErrorState title="Settings couldn’t load" onRetry={() => { void profile.refetch(); void couple.refetch(); }} /></Screen>;
  return <Screen bottomInset><Stack.Screen options={{ headerShown: false }} /><KeyboardAvoidingView behavior="height" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
    <View><Text variant="caption" color="textSecondary">MAKE YOURSELF AT HOME</Text><Header title="Settings" onBack={() => router.back()} /></View>
    <OfflineNotice /><FailureToast message={error} />
    <StaggerList style={{ gap: spacing.lg }}>
    <Card style={{ gap: spacing.s20 }}><Text variant="title/M" accessibilityRole="header">Profile</Text><View style={{ alignItems: 'center', gap: spacing.md }}><Avatar name={profile.data.display_name || 'You'} uri={avatar.data} size={geometry.avatar * 2} /><Button title={avatarMutation.isPending ? 'Uploading…' : 'Change avatar'} loading={avatarMutation.isPending} disabled={busy} onPress={() => { void perform(() => avatarMutation.mutateAsync()); }} /></View>
      <FormField label="Display name" value={name} onChangeText={setName} maxLength={80} editable={!busy} autoComplete="name" />
      <Button title={saveName.isPending ? 'Saving…' : 'Save name'} loading={saveName.isPending} disabled={busy} onPress={() => { void perform(() => saveName.mutateAsync()); }} />
    </Card>
    <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" variant="title/M">Your story began</Text><FormField label="Anniversary (YYYY-MM-DD)" value={anniversary} onChangeText={setAnniversary} maxLength={10} placeholder="2024-02-14" autoCapitalize="none" editable={!busy} /><Text variant="body/S" color="textSecondary">Leave blank to hide the days-together counter.</Text><Button title={saveAnniversary.isPending ? 'Saving…' : 'Save anniversary'} loading={saveAnniversary.isPending} disabled={busy} onPress={() => { void perform(() => saveAnniversary.mutateAsync()); }} /></Card>
    <Card style={{ gap: spacing.md }}><Text accessibilityRole="header" variant="title/M">Stay connected</Text>
      <Text variant="body/S" color="textSecondary">Check remote push delivery to this phone. For reliable messages and calls, allow notifications and unrestricted battery use for Us in Android settings.</Text>
      <Button title={pushTest.isPending ? 'Sending test…' : 'Test notification'} loading={pushTest.isPending} disabled={busy} onPress={() => { void perform(() => pushTest.mutateAsync()); }} />
    </Card>
    <Card><ListItem title="Appearance" subtitle="Eight themes, your accent, your pace" onPress={() => router.push('/settings/appearance')} /></Card>
    </StaggerList>
    <ProfileDetails />
    <Card><ListItem title="Privacy · Encryption" subtitle="Recovery keys, safety numbers and encrypted chat" onPress={() => router.push('/us/e2ee')} /></Card>
    <Card><ListItem title="All features" subtitle="Browse everything, organized by category" onPress={() => router.push('/us')} /><ListItem title="Home shortcuts" subtitle="Choose what appears on your home screen" onPress={() => router.push('/settings/features')} /></Card>
    <SettingsSections />
    {!!message && <Text accessibilityLiveRegion="polite" color="success">{message}</Text>}
    {!!error && <Text accessibilityRole="alert" color="danger">{error}</Text>}
    <Button title={logout.isPending ? 'Signing out…' : 'Sign out'} variant="ghost" loading={logout.isPending} disabled={busy} onPress={() => { void perform(() => logout.mutateAsync()); }} />
    <PressableScale accessibilityRole="button" accessibilityLabel={`Us version ${Constants.expoConfig?.version ?? '—'}`} accessibilityHint={__DEV__ ? 'Long press to open the UI lab' : undefined} disabled={!__DEV__} onLongPress={() => router.push('/ui-lab')} accessibilityActions={__DEV__ ? [{ name: 'longpress', label: 'Open UI lab' }] : undefined} onAccessibilityAction={() => { if (__DEV__) router.push('/ui-lab'); }} style={{ minHeight: geometry.touch, justifyContent: 'center' }}><Text variant="caption" color="textSecondary" style={{ textAlign: 'center' }}>Us · {Constants.expoConfig?.version ?? '—'}</Text></PressableScale>
  </ScrollView></KeyboardAvoidingView></Screen>;
}
