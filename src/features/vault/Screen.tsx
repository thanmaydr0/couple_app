import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Image, KeyboardAvoidingView, Modal, Platform, TextInput, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, router } from 'expo-router';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { supabase } from '@/lib/supabase';
import { useMotion } from '@/motion/useMotion';
import { FadeInView, PressableScale } from '@/motion';
import { Button, Header, Screen, Text } from '@/ui';
import { useSecureScreen } from '@/features/applock/useSecureScreen';
import { setCaptureProtection } from '@/features/applock/capture';
import { snapshot } from '@/features/e2ee/runtime';
import { useEncryption } from '@/features/e2ee/Status';
import { addMedia, addNote, clearDecryptedVault, listVaultItems, openItem, permanentlyRemoveItem, restoreItem, softDelete } from './service';
import type { DecryptedItem, VaultItem, VaultVisibility } from './types';

function friendlyError(error: unknown) { return error instanceof Error ? error.message : 'The vault could not complete that action. Please try again.'; }

function useVaultCaptureProtection(enabled: boolean) {
  const [ready, setReady] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!enabled) { setReady(false); setError(null); return () => { alive = false; }; }
    setReady(false); setError(null);
    void setCaptureProtection('vault.required.capture', true).then(() => { if (alive) setReady(true); }).catch(reason => { if (alive) setError(friendlyError(reason)); });
    return () => { alive = false; void setCaptureProtection('vault.required.capture', false).catch(() => {}); };
  }, [enabled]);
  return { ready, error };
}

function Tile({ item, width, onOpen }: { item: VaultItem; width: number; onOpen: (item: DecryptedItem) => void }) {
  const { colors, radius, spacing, geometry } = useTheme();
  const [uri, setUri] = useState<string>(); const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    if (item.kind === 'note') return () => { alive = false; };
    void openItem(item).then(value => { if (alive) setUri(value.localUri); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [item]);
  return <PressableScale accessibilityRole="button" accessibilityLabel={`Open ${item.kind} from ${new Date(item.created_at).toLocaleDateString()}`} onPress={() => void openItem(item).then(onOpen).catch(error => Alert.alert('Can’t open this item', friendlyError(error)))} style={{ width, aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: geometry.hairline, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
    {uri && item.kind === 'photo' ? <Image source={{ uri }} resizeMode="cover" style={{ width: '100%', height: '100%' }} /> : <View style={{ alignItems: 'center', gap: spacing.xs }}><Ionicons name={failed ? 'alert-circle-outline' : item.kind === 'note' ? 'document-text-outline' : item.kind === 'video' && uri ? 'play-circle-outline' : item.kind === 'video' ? 'videocam-outline' : 'image-outline'} size={geometry.icon} color={failed ? colors.danger : colors.primary} /><Text variant="caption" color="textSecondary">{failed ? 'Unavailable' : item.kind === 'note' ? 'Private note' : item.kind === 'video' && uri ? 'Video' : 'Loading preview'}</Text></View>}
    {item.enc.visibility === 'owner' && <View style={{ position: 'absolute', right: spacing.xs, top: spacing.xs, width: geometry.touch, height: geometry.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}><Ionicons name="person" size={geometry.icon} color={colors.textPrimary} /></View>}
  </PressableScale>;
}

function SecureVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, instance => { instance.loop = true; instance.play(); });
  return <VideoView player={player} style={{ width: '100%', height: '80%' }} nativeControls contentFit="contain" />;
}

function VaultViewer({ item, onClose, onDelete, onActivity }: { item: DecryptedItem | null; onClose: () => void; onDelete: (item: DecryptedItem) => void; onActivity: () => void }) {
  const { colors, spacing, radius, geometry } = useTheme();
  return <Modal visible={!!item} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <View onTouchStart={onActivity} style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: spacing.xl, right: spacing.lg, zIndex: 2 }}><PressableScale accessibilityRole="button" accessibilityLabel="Close viewer" onPress={onClose} style={{ minWidth: geometry.touch, minHeight: geometry.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}><Ionicons name="close" size={geometry.icon} color={colors.textPrimary} /></PressableScale></View>
      {item?.kind === 'note' ? <View style={{ backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, maxHeight: '70%' }}><Text variant="title/M">A note for us</Text><Text selectable style={{ marginTop: spacing.md }}>{item.note}</Text></View> : item?.kind === 'video' && item.localUri ? <SecureVideo uri={item.localUri} /> : item?.localUri ? <Image source={{ uri: item.localUri }} resizeMode="contain" style={{ width: '100%', height: '80%' }} /> : <ActivityIndicator color={colors.primary} />}
      {item && <Text variant="caption" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>{item.enc.visibility === 'owner' ? 'Only me' : 'Both of us'} · encrypted on this phone</Text>}
      {item && item.owner_id === snapshot().user && <View style={{ marginTop: spacing.md }}><Button title="Delete item" variant="danger" onPress={() => onDelete(item)} /></View>}
    </View>
  </Modal>;
}

export default function VaultScreen() {
  const [focused, setFocused] = useState(true);
  const { colors, spacing, radius, geometry } = useTheme(); const motion = useMotion(); const secure = useSecureScreen(focused); const capture = useVaultCaptureProtection(focused); const encryption = useEncryption();
  const { width: screenWidth } = useWindowDimensions();
  const [unlocked, setUnlocked] = useState(false); const [checking, setChecking] = useState(false); const [optedIn, setOptedIn] = useState<boolean | null>(null); const [rows, setRows] = useState<VaultItem[]>([]); const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null); const [editor, setEditor] = useState(false); const [note, setNote] = useState(''); const [visibility, setVisibility] = useState<VaultVisibility>('both'); const [saving, setSaving] = useState(false); const [viewer, setViewer] = useState<DecryptedItem | null>(null); const [undo, setUndo] = useState<VaultItem | null>(null);
  const lastActive = useRef(Date.now()); const timer = useRef<ReturnType<typeof setInterval> | null>(null); const purgeTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>()); const fade = useSharedValue(0); const authAttempted = useRef(false);
  const columns = 3; const gap = spacing.sm; const tileWidth = Math.max(geometry.touch, (screenWidth - spacing.lg * 2 - gap * (columns - 1)) / columns);
  const readyForKeys = encryption.local && encryption.both && !encryption.changed;
  useEffect(() => {
    let alive = true;
    setOptedIn(null);
    if (!encryption.user || !encryption.couple) { setOptedIn(false); return; }
    void AsyncStorage.getItem(`us.vault.opt-in.v1.${encryption.user}.${encryption.couple}`).then(value => { if (alive) setOptedIn(value === 'enabled'); }).catch(() => { if (alive) setOptedIn(false); });
    return () => { alive = false; };
  }, [encryption.user, encryption.couple]);
  const unlockAnimation = useAnimatedStyle(() => ({ opacity: 0.35 + fade.value * 0.65, transform: [{ scale: 0.88 + fade.value * 0.12 }] }));
  const lock = useCallback(() => {
    setUnlocked(false); setViewer(null); setEditor(false); setNote(''); setRows([]); setUndo(null); clearDecryptedVault();
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
  }, []);
  useFocusEffect(useCallback(() => { authAttempted.current = false; setFocused(true); lock(); return () => { setFocused(false); lock(); }; }, [lock]));

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows((await listVaultItems()).filter(item => item.enc.visibility !== 'owner' || item.owner_id === snapshot().user)); } catch (reason) { setError(friendlyError(reason)); }
    finally { setLoading(false); }
  }, []);
  const authenticate = useCallback(async () => {
    if (!secure.ready || secure.error || !readyForKeys || optedIn !== true || checking) return;
    setChecking(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Our Vault', fallbackLabel: 'Use device PIN', disableDeviceFallback: false });
      if (!result.success) return;
      setUnlocked(true); lastActive.current = Date.now(); fade.value = 0;
      if (motion.duration('base') > 0) fade.value = withTiming(1, { duration: motion.duration('base') }); else fade.value = 1;
      await refresh();
    } catch (reason) { setError(friendlyError(reason)); }
    finally { setChecking(false); }
  }, [secure.ready, secure.error, readyForKeys, optedIn, checking, motion, fade, refresh]);
  useEffect(() => { if (focused && !unlocked && !authAttempted.current && readyForKeys && optedIn === true && secure.ready) { authAttempted.current = true; void authenticate(); } }, [focused, unlocked, readyForKeys, optedIn, secure.ready, authenticate]);
  useEffect(() => {
    if (!unlocked || !focused) return;
    timer.current = setInterval(() => { if (Date.now() - lastActive.current >= 60_000) lock(); }, 1000);
    const app = AppState.addEventListener('change', state => { if (state !== 'active') lock(); });
    return () => { if (timer.current) clearInterval(timer.current); timer.current = null; app.remove(); };
  }, [unlocked, focused, lock]);
  useEffect(() => {
    if (!unlocked || !focused) return;
    const couple = snapshot().couple;
    if (!couple) return;
    const channel = supabase.channel(`vault:${couple}`).on('postgres_changes', { event: '*', schema: 'public', table: 'vault_items', filter: `couple_id=eq.${couple}` }, () => void refresh()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [unlocked, focused, refresh]);
  const touch = () => { lastActive.current = Date.now(); };
  const setVaultEnabled = async (enabled: boolean) => {
    const key = `us.vault.opt-in.v1.${encryption.user}.${encryption.couple}`;
    try { if (enabled) await AsyncStorage.setItem(key, 'enabled'); else await AsyncStorage.removeItem(key); setOptedIn(enabled); if (!enabled) lock(); }
    catch { setError('This phone could not save the vault setting. Try again.'); }
  };
  const addFromGallery = async () => {
    touch();
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error('Allow photo and video access in Android Settings to add an item.');
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: false, quality: 1, videoMaxDuration: 60 });
      if (picked.canceled || !picked.assets[0]) return;
      const asset = picked.assets[0];
      if (asset.type === 'video' && asset.duration && asset.duration > 60_000) throw new Error('Choose a video that is one minute or shorter.');
      const kind = asset.type === 'video' ? 'video' : 'photo';
      await addMedia(asset.uri, kind, asset.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'), visibility);
      await refresh();
      if (asset.assetId) Alert.alert('Added to Our Vault', 'The encrypted copy is safely uploaded. Would you like to move it by deleting the original from your gallery?', [
        { text: 'Keep original', style: 'cancel' },
        { text: 'Move into the vault', style: 'destructive', onPress: () => { void MediaLibrary.deleteAssetsAsync([asset.assetId as string]).catch(reason => Alert.alert('Original kept', friendlyError(reason))); } },
      ]);
    } catch (reason) { Alert.alert('Couldn’t add this item', friendlyError(reason)); }
  };
  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try { await addNote(note.trim(), visibility); setNote(''); setEditor(false); await refresh(); }
    catch (reason) { Alert.alert('Couldn’t save this note', friendlyError(reason)); }
    finally { setSaving(false); }
  };
  const remove = async (item: VaultItem) => {
    try {
      await softDelete(item); setRows(current => current.filter(row => row.id !== item.id)); setViewer(null); setUndo(item);
      const previous = purgeTimers.current.get(item.id); if (previous) clearTimeout(previous);
      const pending = setTimeout(() => { purgeTimers.current.delete(item.id); void permanentlyRemoveItem(item).catch(() => {}); setUndo(current => current?.id === item.id ? null : current); }, 5000);
      purgeTimers.current.set(item.id, pending);
    }
    catch (reason) { Alert.alert('Couldn’t delete this item', friendlyError(reason)); }
  };
  const undoDelete = async () => { if (!undo) return; const pending = purgeTimers.current.get(undo.id); if (pending) clearTimeout(pending); purgeTimers.current.delete(undo.id); try { await restoreItem(undo); setUndo(null); await refresh(); } catch (reason) { Alert.alert('Couldn’t restore this item', friendlyError(reason)); } };
  const encryptionNotReady = !readyForKeys;
  const status = useMemo(() => encryption.changed ? 'Encryption key changed. Review it in Encryption before opening the vault.' : encryption.error ? 'Encryption status is unavailable. Reconnect and try again.' : 'Set up encryption on both phones before using Our Vault.', [encryption.changed, encryption.error]);

  if (!secure.ready || !capture.ready) return <Screen centered><ActivityIndicator color={colors.primary} /><Text color="textSecondary" style={{ marginTop: spacing.md }}>{secure.error ?? capture.error ?? 'Securing this private space…'}</Text><Button title="Back" variant="secondary" onPress={() => router.back()} /></Screen>;
  if (encryptionNotReady) return <Screen><Header title="Our Vault" subtitle="A private place for the two of you" onBack={() => router.back()} /><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}><Ionicons name="key-outline" size={geometry.icon * 2} color={colors.primary} /><Text variant="title/M" accessibilityRole="header">Set up encryption first</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>{status}</Text><Button title="Set up encryption" onPress={() => router.push('/us/e2ee')} /></View></Screen>;
  if (optedIn === null) return <Screen centered><ActivityIndicator color={colors.primary} /><Text color="textSecondary" style={{ marginTop: spacing.md }}>Checking this phone’s vault setting…</Text></Screen>;
  if (!optedIn) return <Screen><Header title="Our Vault" subtitle="A private place for the two of you" onBack={() => router.back()} /><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md }}><Ionicons name="lock-closed-outline" size={geometry.icon * 2} color={colors.primary} /><Text variant="title/M" accessibilityRole="header">Turn on Our Vault?</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>Vault access is off on this phone until you choose to enable it. You can turn it off again at any time.</Text><Button title="Turn on this phone" onPress={() => void setVaultEnabled(true)} /><Button title="Back" variant="secondary" onPress={() => router.back()} /></View></Screen>;

  if (!unlocked) return <Screen centered><View onTouchStart={touch} style={{ flex: 1, width: '100%' }}><Header title="Our Vault" onBack={() => router.back()} right={<PressableScale accessibilityRole="button" accessibilityLabel="Turn off vault on this phone" onPress={() => void setVaultEnabled(false)} style={{ minWidth: geometry.touch, minHeight: geometry.touch, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="power-outline" size={geometry.icon} color={colors.textSecondary} /></PressableScale>} /><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}><Animated.View style={[unlockAnimation, { alignItems: 'center', justifyContent: 'center', width: spacing.s56 * 2, height: spacing.s56 * 2, borderRadius: radius.pill, backgroundColor: colors.surface }]}><Ionicons name="lock-closed" size={geometry.icon * 2} color={colors.primary} /></Animated.View><Text variant="title/M">Your private space</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>Unlock with your phone’s biometrics or PIN. It locks again after a minute away.</Text>{secure.error && <Text color="danger">{secure.error}</Text>}{error && <Text color="danger">{error}</Text>}<Button title={checking ? 'Checking…' : 'Unlock vault'} loading={checking} onPress={() => void authenticate()} /></View></View></Screen>;

  return <Screen bottomInset style={{ backgroundColor: colors.bg }}><View onTouchStart={touch} style={{ flex: 1 }}>
    <Header title="Our Vault" subtitle="Encrypted on this phone · locks after 60 seconds" onBack={() => { lock(); router.back(); }} right={<View style={{ flexDirection: 'row', gap: spacing.xs }}><PressableScale accessibilityRole="button" accessibilityLabel="Lock vault now" onPress={lock} style={{ minWidth: geometry.touch, minHeight: geometry.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}><Ionicons name="lock-closed" size={geometry.icon} color={colors.primary} /></PressableScale><PressableScale accessibilityRole="button" accessibilityLabel="Turn off vault on this phone" onPress={() => void setVaultEnabled(false)} style={{ minWidth: geometry.touch, minHeight: geometry.touch, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}><Ionicons name="power-outline" size={geometry.icon} color={colors.textSecondary} /></PressableScale></View>} />
    <PressableScale accessibilityRole="button" accessibilityLabel={`Visibility: ${visibility === 'both' ? 'Both of us' : 'Only me'}. Tap to change.`} onPress={() => setVisibility(value => value === 'both' ? 'owner' : 'both')} style={{ minHeight: geometry.touch, paddingHorizontal: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface }}><Ionicons name={visibility === 'both' ? 'people-outline' : 'person-outline'} size={geometry.icon} color={colors.primary} /><Text style={{ flex: 1 }}>New items: {visibility === 'both' ? 'Both of us' : 'Only me'}</Text><Text color="primary">Change</Text></PressableScale>
    <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}><Button title="Add photo or video" variant="secondary" onPress={() => void addFromGallery()} style={{ flex: 1 }} /><Button title="New note" onPress={() => { touch(); setEditor(true); }} style={{ flex: 1 }} /></View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface }}><Ionicons name="shield-checkmark-outline" size={geometry.icon} color={colors.primary} /><Text variant="body/S" color="textSecondary" style={{ flex: 1 }}>Items are encrypted before upload. You’re viewing the unlocked vault.</Text></View>
    {error && <View style={{ marginBottom: spacing.sm }}><Text color="danger">{error}</Text><Button title="Try again" variant="secondary" onPress={() => void refresh()} /></View>}
    {loading && rows.length === 0 ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /><Text color="textSecondary" style={{ marginTop: spacing.md }}>Opening your encrypted vault…</Text></View> : rows.length === 0 ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}><Ionicons name="sparkles-outline" size={geometry.icon * 2} color={colors.primary} /><Text variant="title/M">A little space for what matters</Text><Text color="textSecondary" style={{ textAlign: 'center' }}>Add a photo, a short video, or a note to begin.</Text></View> : <FlatList data={rows} keyExtractor={item => item.id} numColumns={columns} contentContainerStyle={{ gap }} columnWrapperStyle={{ gap }} renderItem={({ item, index }) => index < geometry.firstScreenful ? <FadeInView><Tile item={item} width={tileWidth} onOpen={setViewer} /></FadeInView> : <Tile item={item} width={tileWidth} onOpen={setViewer} />} onRefresh={() => void refresh()} refreshing={loading} />}
    {undo && <View style={{ paddingTop: spacing.sm }}><PressableScale accessibilityRole="button" onPress={() => void undoDelete()} style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surface }}><Text>Item deleted</Text><Text color="primary">Undo</Text></PressableScale></View>}
    <VaultViewer item={viewer} onClose={() => setViewer(null)} onDelete={item => void remove(item)} onActivity={touch} />
    <Modal visible={editor} animationType="slide" transparent onRequestClose={() => setEditor(false)}>
      <KeyboardAvoidingView onTouchStart={touch} behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: `${colors.bg}CC` }}><View style={{ backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet }}><Text variant="title/M">A note for us</Text><TextInput value={note} onChangeText={value => { setNote(value); touch(); }} multiline placeholder="Write something private…" placeholderTextColor={colors.textMuted} style={{ minHeight: spacing.s56 * 2, color: colors.textPrimary, backgroundColor: colors.bg, padding: spacing.md, borderRadius: radius.md, textAlignVertical: 'top' }} /><View style={{ flexDirection: 'row', gap: spacing.sm }}><Button title={visibility === 'both' ? 'Both of us' : 'Only me'} variant="secondary" onPress={() => setVisibility(value => value === 'both' ? 'owner' : 'both')} style={{ flex: 1 }} /><Button title="Save note" onPress={() => void saveNote()} loading={saving} disabled={!note.trim()} style={{ flex: 1 }} /></View><Button title="Cancel" variant="ghost" onPress={() => { setEditor(false); setNote(''); }} /></View></KeyboardAvoidingView>
    </Modal>
  </View></Screen>;
}
