import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { theme } from '@/ui/theme';
import type { ChatMessage } from './model';
import { cachedPhotoUrl, savePhotoUrl } from './service';

export function ChatImage({ message, uid, onReply }: { message: ChatMessage; uid: string; onReply: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
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
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={imageFailed || !source ? 'Retry loading photo' : 'Open photo. Hold to reply'} onLongPress={onReply} delayLongPress={350}
      onPress={() => { if (imageFailed || !source) retry(); else setExpanded(true); }} style={styles.frame}>
      {source && !imageFailed ? <Image source={source} style={styles.photo} contentFit="cover" cachePolicy="memory-disk" transition={120} onError={() => setImageFailed(true)} />
        : <View style={styles.placeholder}>{signed.isPending && message.status === 'sent' ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.label}>Photo unavailable · tap to retry</Text>}</View>}
    </Pressable>
    <Modal visible={expanded} transparent animationType="fade" onRequestClose={() => setExpanded(false)}>
      <View style={styles.modal}>
        {source && <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />}
        <Pressable accessibilityRole="button" accessibilityLabel="Close photo" onPress={() => setExpanded(false)} style={styles.close}><Text style={styles.label}>Close ✕</Text></Pressable>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  frame: { width: 220, height: 240, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.colors.surfaceRaised },
  photo: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  label: { color: theme.colors.text, textAlign: 'center' },
  modal: { flex: 1, backgroundColor: '#100D12' },
  close: { position: 'absolute', top: 56, right: 20, padding: 16, borderRadius: 24, backgroundColor: theme.colors.surface },
});
