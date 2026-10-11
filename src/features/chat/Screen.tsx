import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { theme } from '@/ui/theme';
import type { ChatMessage } from './model';
import { dayLabel, grouped } from './model';
import { pickChatImage } from './service';
import { useChat } from './useChat';
import { useTyping } from './useTyping';
import { ChatImage } from './ChatImage';

const colors = theme.colors;
const EMOJI = ['❤️', '🥰', '😘', '😂', '🥺', '🫂', '✨', '💕', '🙈', '👍', '🌙', '☀️'];

function ReplyPreview({ message, uid, known }: { message: ChatMessage; uid: string; known: ChatMessage | undefined }) {
  const reply = useQuery({
    queryKey: ['chat-reply', uid, message.couple_id, message.reply_to],
    enabled: !!message.reply_to && !known,
    staleTime: Infinity,
    queryFn: async () => {
      if (!message.reply_to) return null;
      const { data, error } = await supabase.from('messages').select('*').eq('couple_id', message.couple_id).eq('id', message.reply_to).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const original = known ?? reply.data;
  const mine = message.sender_id === uid;
  return <View style={[styles.quote, !mine && { borderLeftColor: colors.primary }]}><Text style={[styles.quoteName, mine && styles.mineText]}>{original?.sender_id === uid ? 'You' : 'Partner'}</Text>
    <Text style={[styles.quoteText, !mine && { color: colors.text }]} numberOfLines={2}>{original ? (original.kind === 'image' ? '📷 Photo' : original.body) : 'Earlier message'}</Text></View>;
}

export default function ChatScreen() {
  const profile = useProfile();
  const { data: session } = useSession();
  const coupleId = profile.data?.couple_id;
  const uid = session?.user.id;
  if (!coupleId || !uid) return <SafeAreaView style={styles.center}>
    {profile.isPending ? <ActivityIndicator color={colors.primary} /> : <><Text style={styles.emptyTitle}>{profile.isError ? 'Couldn’t load your chat' : 'Your space for two'}</Text><Text style={styles.emptyText}>{profile.isError ? 'Check your connection, then try again.' : 'Connect with your partner to start chatting.'}</Text>
      {profile.isError && <Pressable onPress={() => void profile.refetch()} style={styles.pill}><Text style={styles.pillText}>Try again</Text></Pressable>}</>}
  </SafeAreaView>;
  return <Conversation key={`${coupleId}:${uid}`} coupleId={coupleId} uid={uid} />;
}

function Conversation({ coupleId, uid }: { coupleId: string; uid: string }) {
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const active = focused && foreground;
  const partner = usePartner();
  const partnerName = partner.data?.display_name || 'Your partner';
  const chat = useChat(coupleId, uid, active);
  const { typing, updateTyping } = useTyping(coupleId, uid, partner.data?.id, active);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const list = useRef<FlatList<ChatMessage>>(null);
  const nearBottom = useRef(true);
  const newestId = useRef<string | undefined>(undefined);
  const photoBusy = useRef(false);
  const mounted = useRef(true);
  const draftRef = useRef(draft);
  const replyRef = useRef(reply);
  draftRef.current = draft;
  replyRef.current = reply;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const toBottom = () => {
    nearBottom.current = true;
    setNewMessages(false);
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };
  useEffect(() => {
    const newest = chat.messages[0];
    if (!newest || newest.client_id === newestId.current) return;
    const firstLoad = !newestId.current;
    newestId.current = newest.client_id;
    if (firstLoad || nearBottom.current || newest.sender_id === uid) {
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated: !firstLoad }));
      setNewMessages(false);
    } else setNewMessages(true);
  }, [chat.messages, uid]);

  const edit = (text: string) => { setDraft(text); updateTyping(text); };
  const sendText = () => {
    if (!draft.trim() || !chat.ready) return;
    chat.send(draft, reply?.id ?? null);
    edit(''); setReply(null); setEmojiOpen(false); toBottom();
  };
  const sendPhoto = async () => {
    if (photoBusy.current || !chat.ready) return;
    photoBusy.current = true;
    setPicking(true);
    updateTyping('');
    try {
      const photo = await pickChatImage(coupleId, uid);
      if (photo && mounted.current) {
        chat.send(draftRef.current, replyRef.current?.id ?? null, photo);
        edit(''); setReply(null); toBottom();
      }
    } catch (error: unknown) {
      if (mounted.current) Alert.alert('Couldn’t attach photo', error instanceof Error ? error.message : 'Please try choosing a photo again.');
    } finally { photoBusy.current = false; if (mounted.current) setPicking(false); }
  };
  const latestMine = chat.messages.find((message) => message.sender_id === uid);
  const known = new Map(chat.messages.map((message) => [message.id, message]));

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
    <KeyboardAvoidingView behavior="height" automaticOffset style={styles.flex}>
      <View style={styles.header}><View style={styles.heart}><Ionicons name="heart" size={24} color={colors.primary} /></View>
        <View style={styles.flex}><Text style={styles.title} numberOfLines={1}>{partnerName}</Text><Text style={styles.subtitle}>{typing ? 'typing…' : chat.live ? 'Just the two of you' : 'Reconnecting…'}</Text></View>
      </View>
      {chat.error && <Pressable accessibilityRole="button" onPress={() => void chat.refresh()} style={styles.error}><Text style={styles.errorText}>{chat.error}</Text></Pressable>}
      <FlatList ref={list} data={chat.messages} inverted keyExtractor={(message) => message.client_id}
        style={styles.flex} contentContainerStyle={styles.history} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScroll={(event) => { nearBottom.current = event.nativeEvent.contentOffset.y < 100; if (nearBottom.current) setNewMessages(false); }} scrollEventThrottle={32}
        onEndReached={() => { if (chat.messages.length >= 50) void chat.loadOlder(); }} onEndReachedThreshold={0.25}
        ListFooterComponent={chat.messages.length > 0 && chat.hasOlder ? <Pressable disabled={chat.loadingOlder} onPress={() => void chat.loadOlder()} style={styles.earlier} accessibilityRole="button">
          {chat.loadingOlder ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.subtitle}>Load earlier messages</Text>}</Pressable> : null}
        ListEmptyComponent={<View style={styles.empty}>{!chat.ready ? <ActivityIndicator color={colors.primary} /> : <><Text style={styles.emptyTitle}>A little closer, every message</Text><Text style={styles.emptyText}>Say hello, send a photo, share your day. ♥</Text></>}</View>}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === uid;
          const older = chat.messages[index + 1];
          const newer = chat.messages[index - 1];
          const sameOlder = grouped(item, older);
          const sameNewer = grouped(item, newer);
          const date = !older || new Date(item.created_at).toDateString() !== new Date(older.created_at).toDateString();
          return <View>
            {date && <View style={styles.date}><Text style={styles.dateText}>{dayLabel(item.created_at)}</Text></View>}
            <View style={[styles.messageRow, { alignItems: mine ? 'flex-end' : 'flex-start', marginTop: sameOlder ? 3 : 14 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={item.status === 'failed' ? 'Message failed. Tap to retry' : `${mine ? 'You' : partnerName}: ${item.body || 'Photo'}. Hold to reply`}
                onLongPress={() => { if (item.status === 'sent') setReply(item); }} delayLongPress={350}
                onPress={() => chat.retry(item)}
                style={[styles.bubble, mine ? styles.mine : styles.theirs, { borderTopRightRadius: mine && sameOlder ? 6 : 20, borderBottomRightRadius: mine && sameNewer ? 6 : 20, borderTopLeftRadius: !mine && sameOlder ? 6 : 20, borderBottomLeftRadius: !mine && sameNewer ? 6 : 20 }]}>
                {item.reply_to && <ReplyPreview message={item} uid={uid} known={known.get(item.reply_to)} />}
                {item.kind === 'image' && <ChatImage message={item} uid={uid} onReply={() => { if (item.status === 'sent') setReply(item); }} />}
                {!!item.body && <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>}
                {item.kind === 'system' && !item.body && <Text style={styles.body}>System message</Text>}
                <View style={styles.meta}><Text style={[styles.time, mine && styles.mineText]}>{new Date(item.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Text>
                  {mine && <Text style={[styles.time, mine && styles.mineText]}>{item.status === 'sending' ? '◷ Sending' : item.status === 'failed' ? '⚠ Failed' : '✓'}</Text>}</View>
              </Pressable>
              {item.status === 'failed' && <Pressable onPress={() => chat.retry(item)} accessibilityRole="button" style={styles.retry}><Text style={styles.errorText}>Couldn’t send · tap to retry</Text></Pressable>}
              {mine && latestMine?.id === item.id && item.read_at && <Text style={styles.seen}>Seen ♥</Text>}
            </View>
          </View>;
        }} />
      {newMessages && <Pressable accessibilityRole="button" onPress={toBottom} style={styles.newMessages}><Text style={styles.pillText}>New messages ↓</Text></Pressable>}
      <View style={styles.typing}><Text accessibilityLiveRegion="polite" style={styles.subtitle}>{typing ? `${partnerName} is typing…` : ' '}</Text></View>
      {reply && <View style={styles.replyBar}><View style={styles.flex}><Text style={styles.quoteName}>Replying to {reply.sender_id === uid ? 'yourself' : partnerName}</Text><Text style={styles.subtitle} numberOfLines={1}>{reply.kind === 'image' ? '📷 Photo' : reply.body}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReply(null)} style={styles.icon}><Ionicons name="close" size={22} color={colors.muted} /></Pressable></View>}
      {emojiOpen && <ScrollView horizontal keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojis} style={styles.emojiPanel}>{EMOJI.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => { if (draft.length < 3998) edit(`${draft}${emoji}`); }} style={styles.emoji}><Text style={{ fontSize: 28 }}>{emoji}</Text></Pressable>)}</ScrollView>}
      <View style={styles.composer}>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose photo" disabled={!chat.ready || picking} onPress={() => void sendPhoto()} style={styles.icon}>{picking ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="image-outline" size={25} color={colors.primary} />}</Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Show emoji" onPress={() => setEmojiOpen(!emojiOpen)} style={styles.icon}><Ionicons name="happy-outline" size={25} color={colors.muted} /></Pressable>
        <TextInput accessibilityLabel="Message" placeholder="A message for your person…" placeholderTextColor={colors.muted} value={draft} onChangeText={edit}
          editable={chat.ready && !picking} multiline maxLength={4000} style={styles.input} textAlignVertical="center" />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || !chat.ready || picking} onPress={sendText} style={[styles.send, (!draft.trim() || !chat.ready || picking) && { opacity: 0.4 }]}><Ionicons name="arrow-up" size={24} color={colors.onPrimary} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  heart: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  history: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, flexGrow: 1 },
  messageRow: { marginBottom: 1 },
  bubble: { maxWidth: '85%', paddingHorizontal: 12, paddingVertical: 9, gap: 6, borderRadius: 20 },
  mine: { backgroundColor: colors.primary },
  theirs: { backgroundColor: colors.surfaceRaised },
  body: { color: colors.text, fontSize: 16, lineHeight: 23 },
  mineText: { color: colors.onPrimary },
  meta: { flexDirection: 'row', gap: 8, alignSelf: 'flex-end' },
  time: { fontSize: 10, color: colors.muted, opacity: 0.8 },
  seen: { color: colors.primary, fontSize: 11, marginTop: 5, marginRight: 4 },
  date: { alignItems: 'center', paddingTop: 22, paddingBottom: 10 },
  dateText: { fontSize: 12, color: colors.muted, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.onPrimary, backgroundColor: '#00000012', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 6 },
  quoteName: { fontWeight: '600', fontSize: 12, color: colors.muted },
  quoteText: { color: colors.onPrimary, fontSize: 13, lineHeight: 18 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.surface, marginHorizontal: 12, paddingLeft: 12, paddingVertical: 6, borderRadius: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, minHeight: 46, maxHeight: 140, fontSize: 16, color: colors.text, backgroundColor: colors.surfaceRaised, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 11, marginHorizontal: 4 },
  icon: { width: 42, height: 46, alignItems: 'center', justifyContent: 'center' },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
  earlier: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 20, gap: 12 },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  emptyText: { color: colors.muted, textAlign: 'center', fontSize: 15, lineHeight: 23 },
  error: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: colors.surface },
  errorText: { color: colors.danger, fontSize: 12 },
  retry: { minHeight: 40, justifyContent: 'center' },
  typing: { minHeight: 24, paddingHorizontal: 20 },
  emojiPanel: { flexGrow: 0, maxHeight: 64, backgroundColor: colors.surface },
  emojis: { paddingHorizontal: 10, alignItems: 'center' },
  emoji: { padding: 10 },
  newMessages: { alignSelf: 'center', backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginVertical: 4 },
  pill: { padding: 14, backgroundColor: colors.primary, borderRadius: 20 },
  pillText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
});
