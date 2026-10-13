import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import { PressableScale, useMotion, motionTokens } from '@/motion';
import { Header, Screen, Skeleton } from '@/ui';
import type { ChatMessage } from './model';
import { cachedPhotoUrl, savePhotoUrl } from './service';
import { ViewOncePhoto } from './ViewOncePhoto';
import { useBubbleTap } from './useBubbleTap';

export function ChatImage({ message, uid, onReply, onHeart }: { message: ChatMessage; uid: string; onReply: () => void; onHeart: () => void }) {
  return message.view_once ? <ViewOncePhoto message={message} uid={uid} onActions={onReply} onHeart={onHeart} /> : <RegularChatImage message={message} uid={uid} onReply={onReply} onHeart={onHeart} />;
}
function RegularChatImage({ message, uid, onReply, onHeart }: { message: ChatMessage; uid: string; onReply: () => void; onHeart: () => void }) {
  const { colors, spacing, radius, geometry, typography } = useTheme();
  const motion = useMotion();
  const styles = StyleSheet.create({
    frame: { width: geometry.touch * 4 + spacing.lg, maxWidth: '100%', height: geometry.touch * 5, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
    photo: { width: '100%', height: '100%' },
    placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, gap: spacing.sm },
    label: { ...typography['body/S'], color: colors.textPrimary, textAlign: 'center' },
    modal: { flex: 1, backgroundColor: colors.bg },
    progress: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, right: spacing.sm, borderRadius: radius.md, padding: spacing.sm, backgroundColor: colors.surface, flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  });
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [loadedUri, setLoadedUri] = useState<string | undefined>();
  const [offlineUrl, setOfflineUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (message.media_path) void cachedPhotoUrl(message.couple_id, uid, message.media_path).then((url) => { if (alive) setOfflineUrl(url); });
    return () => { alive = false; };
  }, [message.couple_id, message.media_path, uid]);
  const signed = useQuery({
    queryKey: ['chat-image', uid, message.couple_id, message.media_path],
    enabled: !!message.media_path && message.status === 'sent',
    staleTime: 40 * 60_000, refetchInterval: 40 * 60_000,
    queryFn: async () => {
      if (!message.media_path?.startsWith(`${message.couple_id}/chat/`)) throw new Error('Invalid photo path');
      const { data, error } = await supabase.storage.from('media').createSignedUrl(message.media_path, 3600);
      if (error) throw error;
      void savePhotoUrl(message.couple_id, uid, message.media_path, data.signedUrl);
      return data.signedUrl;
    },
  });
  const cacheKey = `chat:${uid}:${message.couple_id}:${message.media_path}`;
  const url = signed.data ?? offlineUrl;
  const source = message.localUri ? { uri: message.localUri } : url ? { uri: url, cacheKey } : null;
  const retry = () => { setImageFailed(false); void signed.refetch(); };
  const taps = useBubbleTap(() => { if (imageFailed || !source) retry(); else setExpanded(true); },onHeart);
  return <>
    <PressableScale accessibilityRole="button" accessibilityLabel={imageFailed || !source ? 'Retry loading photo' : 'Open photo. Double tap to react. Hold for message actions'} onLongPress={() => { taps.cancel();onReply(); }} delayLongPress={motionTokens.slow}
      onPress={taps.tap} style={styles.frame}>
      {source && !imageFailed ? <Image source={source} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" transition={motion.duration('fast')} onLoad={() => setLoadedUri(source.uri)} onError={() => setImageFailed(true)} />
        : <View style={styles.placeholder}>{signed.isPending && message.status === 'sent' ? <View style={styles.placeholder}><Skeleton width={geometry.touch} height={geometry.touch} /><Text style={styles.label}>Loading photo…</Text></View> : <Text style={styles.label}>Photo unavailable · tap to retry</Text>}</View>}
      {source && !imageFailed && loadedUri !== source.uri && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Skeleton height={geometry.touch * 5} /></View>}
      {message.status === 'sending' && <View pointerEvents="none" style={styles.progress}>
        {motion.level === 'full' ? <ActivityIndicator color={colors.primary} /> : <Svg width={geometry.icon} height={geometry.icon} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="8" fill="none" stroke={colors.primary} strokeWidth={geometry.stroke} strokeDasharray={`${geometry.receiptLength} ${geometry.receiptLength}`} /></Svg>}
        <Text style={styles.label}>Sending photo…</Text></View>}
    </PressableScale>
    <Modal visible={expanded} animationType={motion.level === 'off' ? 'none' : 'fade'} onRequestClose={() => setExpanded(false)}>
      <Screen bottomInset style={styles.modal}>
        <Header title="Photo" onBack={() => setExpanded(false)} />
        <View style={{ flex: 1 }}>
          {source && !imageFailed ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" onLoad={() => setLoadedUri(source.uri)} onError={() => setImageFailed(true)} /> : <View style={styles.placeholder}><Text style={styles.label}>Photo couldn’t load</Text><PressableScale accessibilityRole="button" onPress={retry}><Text style={styles.label}>Try again</Text></PressableScale></View>}
          {source && !imageFailed && loadedUri !== source.uri && <View style={styles.placeholder}><Skeleton height={geometry.touch * 5} /><Text style={styles.label}>Loading photo…</Text></View>}
        </View>
      </Screen>
    </Modal>
  </>;
}
