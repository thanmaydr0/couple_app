import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '@/theme';
import { Avatar, Card, EmptyState, ErrorState, Header, PressableScale, Screen, Skeleton, Text, TextField } from '@/ui';
import { useAvatar, usePartner } from '@/lib/hooks';
import { useFocus } from './useFocus';
import { Ring } from './Ring';
import { Garden } from './Garden';
export default function FocusScreen() {
    const f = useFocus(true);
    const { colors, spacing, radius, geometry } = useTheme();
    const partner = usePartner();
    const ownAvatar = useAvatar(f.profile.data?.avatar_path);
    const partnerAvatar = useAvatar(partner.data?.avatar_path);
    const [tab, setTab] = useState<'room' | 'garden'>('room');
    const [work, setWork] = useState('25');
    const [rest, setRest] = useState('5');
    const [cycles, setCycles] = useState('4');
    const [label, setLabel] = useState('');
    const [validation, setValidation] = useState('');
    const action = (title: string, onPress: () => void, disabled = false) => <PressableScale accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={{ minHeight: geometry.touch, padding: spacing.md, borderRadius: radius.md, backgroundColor: disabled ? colors.surfaceAlt : colors.primary, alignItems: 'center', justifyContent: 'center' }}><Text color={disabled ? 'textSecondary' : 'primaryContrast'}>{title}</Text></PressableScale>;
    const disabled = f.busy || f.offline || f.query.isPending || !f.coupleId;
    function start() { const w = Number(work), b = Number(rest), c = Number(cycles); if (!Number.isInteger(w) || w < 1 || w > 180 || !Number.isInteger(b) || b < 1 || b > 60 || !Number.isInteger(c) || c < 1 || c > 12) {
        setValidation('Choose 1–180 work minutes, 1–60 break minutes, and 1–12 cycles.');
        return;
    } setValidation(''); void f.start(w * 60, b * 60, c, label.trim()); }
    return <Screen bottomInset><Header title={tab === 'garden' ? 'Our focus garden' : 'Focus together'} subtitle="Small moments. Shared growth." onBack={() => router.back()}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
  <View style={{ flexDirection: 'row', gap: spacing.sm }}>{action('Room', () => setTab('room'))}{action('Garden', () => setTab('garden'))}</View>
  {f.offline && <Text accessibilityLiveRegion="polite" color="warning">Offline · Saved room shown. Reconnect to join or end. Timer continues.</Text>}
  {!!(f.notice || validation) && <Text accessibilityLiveRegion="polite">{validation || f.notice}</Text>}
  {(f.query.isPending || f.profile.isPending) && !f.query.data && !f.offline ? <View accessibilityLabel="Loading your focus room" style={{ gap: spacing.md }}><Skeleton height={geometry.touch * 5} style={{ borderRadius: radius.lg }}/><Skeleton /><Skeleton /></View> : null}
  {(f.query.error || f.profile.error) && <ErrorState description="Could not sync your room. Your last saved view stays here." onRetry={() => { void f.profile.refetch(); void f.refresh(); }}/>}
  {!f.profile.isPending && !f.coupleId && <EmptyState title="A room for two" description="Link your couple before starting a shared focus room."/>}
  {tab === 'garden' ? <Garden plants={f.query.data?.plants ?? []} logs={f.query.data?.logs ?? []} userId={f.userId} now={f.now}/> : f.session?.status === 'active' && f.phase ? <>
   {!f.joined && <Card style={{ gap: spacing.md }}><Text variant="title/M">Your partner started a room</Text><Text>Join their rhythm. No need to restart the clock.</Text>{action('Join', () => { void f.join(); }, disabled)}</Card>}
   <Text variant="title/L" style={{ textAlign: 'center' }}>{f.session.label || 'A little quiet time'}</Text>
   <Ring progress={f.phase.progress} seconds={f.phase.remaining} phase={f.phase.phase} phaseKey={f.phase.key}/>
   <Text style={{ textAlign: 'center' }} accessibilityLiveRegion="polite">{f.phase.phase} · Cycle {f.phase.cycle} of {f.session.cycles}</Text>
   <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg }}><View style={{ alignItems: 'center', gap: spacing.sm }}><Avatar name={f.profile.data?.display_name || 'You'} uri={ownAvatar.data}/><Text>You {f.present.includes(f.userId ?? '') ? '· here' : '· away'}</Text></View><View style={{ alignItems: 'center', gap: spacing.sm }}><Avatar name={partner.data?.display_name || 'Partner'} uri={partnerAvatar.data}/><Text>Partner {f.present.some(id => id !== f.userId) ? '· here' : '· away'}</Text></View></View>
   <Text style={{ textAlign: 'center' }} color="textSecondary">{f.present.includes(f.userId ?? '') && f.present.some(id => id !== f.userId) ? 'Both here 🌱' : 'Your shared rhythm continues'}</Text>
   {f.joined && <>{action('Send a little cheer', () => { void f.cheer(); }, disabled || !f.present.some(id => id !== f.userId))}{action('Enable phase reminders', () => { void f.reminders(); }, disabled)}{action('End early, gently', () => Alert.alert('End this room?', 'Completed work cycles stay in your garden. This ends the timer for both of you.', [{ text: 'Keep focusing', style: 'cancel' }, { text: 'End early', onPress: () => { void f.end(); } }]), disabled)}<Text color="textSecondary">No pause needed. If life interrupts, you can end early.</Text></>}
  </> : <Card style={{ gap: spacing.md }}>
   <Text variant="title/M">{f.session?.status === 'finished' ? 'Well done. Something grew.' : f.session?.status === 'cancelled' ? 'Every little effort counts.' : 'Make room for a little focus'}</Text>
   <Text color="textSecondary">Choose your rhythm. Both phones follow one server clock.</Text>
   <View style={{ flexDirection: 'row', gap: spacing.sm }}>{action('25 / 5', () => { setWork('25'); setRest('5'); })}{action('50 / 10', () => { setWork('50'); setRest('10'); })}</View>
   <TextField label="What are you working on?" placeholder="DSA revision" value={label} onChangeText={setLabel} maxLength={80}/>
   <TextField label="Work minutes (custom)" value={work} onChangeText={setWork} keyboardType="number-pad" maxLength={3}/><TextField label="Break minutes" value={rest} onChangeText={setRest} keyboardType="number-pad" maxLength={2}/><TextField label="Cycles" value={cycles} onChangeText={setCycles} keyboardType="number-pad" maxLength={2}/>
   {action(f.busy ? 'Starting…' : 'Start together', start, disabled)}<Text variant="caption" color="textSecondary">The last work cycle ends the session, without a final break. Enable reminders after starting to receive phase alerts.</Text>
  </Card>}
 </ScrollView></Screen>;
}
