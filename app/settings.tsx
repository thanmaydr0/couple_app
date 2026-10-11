import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAvatar, useCouple, useProfile } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { uploadAvatar, validAnniversary } from '@/lib/settings';
import { friendlyError } from '@/lib/errors';
import { Avatar, Button, Card, Screen, Text, theme } from '@/ui';
import { FormField } from '@/ui/FormField';
import { LoadingScreen } from '@/ui/LoadingScreen';
export default function SettingsScreen() {
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
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
    if (signOutError) throw signOutError;
    return '';
  } });
  const busy = saveName.isPending || saveAnniversary.isPending || avatarMutation.isPending || logout.isPending;
  const perform = async (action: () => Promise<string>) => {
    setMessage(''); setError('');
    try { setMessage(await action()); }
    catch (cause) {
      const detail = cause instanceof Error ? cause.message : '';
      setError(/^(Display name|Enter a valid date)/.test(detail) ? detail : /permission denied/i.test(detail) ? 'Allow access to photos in Android settings, then try again.' : friendlyError(cause));
    }
  };
  if (profile.isPending || couple.isPending) return <LoadingScreen />;
  if (profile.isError || couple.isError || !profile.data || !couple.data) return <Screen centered><Text>We couldn’t load settings.</Text><Button title="Try again" onPress={() => { void profile.refetch(); void couple.refetch(); }} /></Screen>;
  return <Screen bottomInset><KeyboardAvoidingView behavior="height" style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 24, paddingBottom: 32 }}>
    <Card style={{ gap: 20 }}><View style={{ alignItems: 'center', gap: 16 }}><Avatar name={profile.data.display_name || 'You'} uri={avatar.data} size={96} /><Button title={avatarMutation.isPending ? 'Uploading…' : 'Change avatar'} disabled={busy} onPress={() => { void perform(() => avatarMutation.mutateAsync()); }} /></View>
      <FormField label="Display name" value={name} onChangeText={setName} maxLength={80} editable={!busy} autoComplete="name" />
      <Button title={saveName.isPending ? 'Saving…' : 'Save name'} disabled={busy} onPress={() => { void perform(() => saveName.mutateAsync()); }} />
    </Card>
    <Card style={{ gap: 16 }}><Text accessibilityRole="header" style={{ fontSize: 22 }}>Your story began</Text><FormField label="Anniversary (YYYY-MM-DD)" value={anniversary} onChangeText={setAnniversary} maxLength={10} placeholder="2024-02-14" autoCapitalize="none" editable={!busy} /><Text style={{ color: theme.colors.muted }}>Leave blank to hide the days-together counter.</Text><Button title={saveAnniversary.isPending ? 'Saving…' : 'Save anniversary'} disabled={busy} onPress={() => { void perform(() => saveAnniversary.mutateAsync()); }} /></Card>
    {!!message && <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.success }}>{message}</Text>}
    {!!error && <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>{error}</Text>}
    <Button title={logout.isPending ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => { void perform(() => logout.mutateAsync()); }} />
  </ScrollView></KeyboardAvoidingView></Screen>;
}
