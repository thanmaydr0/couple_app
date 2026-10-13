import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { Header, Screen } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale, useMotion } from '@/motion';
import type { ChatMessage } from './model';
import { useBubbleTap } from './useBubbleTap';

/** PRIVACY SESSION INTEGRATION HOOK: install Android screenshot prevention
 * here while the one-time viewer is visible. This currently blocks nothing. */
export function useViewOnceScreenshotProtection(_visible: boolean): void {}

export function ViewOncePhoto({ message, uid, onActions, onHeart }: { message: ChatMessage; uid: string; onActions: () => void; onHeart: () => void }) {
  const { colors, spacing, radius, typography, geometry } = useTheme();
  const motion = useMotion();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consumed, setConsumed] = useState(false);
  const opened = useRef(false);
  const opening = useRef(false);
  const alive = useRef(true);
  const mine = message.sender_id === uid;
  useViewOnceScreenshotProtection(!!url);
  const close = useCallback(() => {
    setUrl(null);
    if (opened.current) {
      opened.current = false;
      void supabase.functions.invoke('link-preview', { body: { action: 'close-once', message_id: message.id } });
    }
  }, [message.id]);
  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') close(); });
    return () => { alive.current = false; subscription.remove(); close(); };
  }, [close]);
  useEffect(() => { if (!url) return; const timer = setTimeout(close, 60_000); return () => clearTimeout(timer); }, [url, close]);
  const open = async () => {
    if (opening.current || mine || consumed || message.viewed_at || message.status !== 'sent') return;
    opening.current = true;
    setBusy(true); setError(null);
    try {
      const response = await supabase.functions.invoke<{ url: string }>('link-preview', { body: { action: 'open-once', message_id: message.id } });
      if (response.error || !response.data?.url) throw new Error('Photo could not open. It may have already been viewed.');
      opened.current = true;
      if (alive.current && AppState.currentState === 'active') { setUrl(response.data.url); setConsumed(true); }
      else close();
    } catch (reason: unknown) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Try again when online.'); }
    finally { opening.current = false; if (alive.current) setBusy(false); }
  };
  const taps=useBubbleTap(()=>void open(),onHeart);
  return <>
    <PressableScale accessibilityRole="button" accessibilityLabel={message.viewed_at || consumed ? 'View-once photo opened' : 'Open view-once photo'} onLongPress={() => { taps.cancel();onActions(); }} onPress={taps.tap}
      style={{ minWidth: geometry.touch * 3, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md }}>
      <Text style={{ ...typography.label, color: colors.textPrimary }}>{message.viewed_at || consumed ? 'Opened' : mine ? '① View-once photo sent' : '🔒 View once · tap to open'}</Text>
      {busy && <ActivityIndicator color={colors.primary} />}
      {!!error && <Text style={{ ...typography['body/S'], color: colors.danger }}>{error}</Text>}
    </PressableScale>
    <Modal visible={!!url} animationType={motion.level === 'off' ? 'none' : 'fade'} onRequestClose={close}>
      <Screen bottomInset><Header title="View once" subtitle="Closes after 60 seconds. Screenshots are not blocked yet." onBack={close} />
        <View style={{ flex: 1, padding: spacing.md }}>{url && <Image source={{ uri: url }} contentFit="contain" cachePolicy="none" style={{ flex: 1 }} onError={() => setError('Photo unavailable')} />}
          {!!error && <Text style={{ ...typography['body/S'], color: colors.danger }}>{error}</Text>}
        </View>
      </Screen>
    </Modal>
  </>;
}
