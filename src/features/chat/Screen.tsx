import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, ScrollView, StyleSheet, Text, TextInput, View, type ViewToken } from 'react-native';
import { useIsFocused } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, { LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme';
import { useMotion, PressableScale, motionTokens } from '@/motion';
import { Screen, Header, TypingDots, Skeleton, BottomSheet, ListItem, MessageStatusTicks, Avatar } from '@/ui';
import { useChatStyles } from './styles';
import { MessageBubble } from './MessageBubble';
import { ComposerSend } from './ComposerSend';
import { ChatReveal } from './ChatReveal';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePartner, useProfile, useSession } from '@/lib/hooks';
import type { ChatMessage } from './model';
import { dayLabel, grouped } from './model';
import { pickChatImage } from './service';
import { useChat } from './useChat';
import { useTyping } from './useTyping';

const EMOJI = ['❤️', '🥰', '😘', '😂', '🥺', '🫂', '✨', '💕', '🙈', '👍', '🌙', '☀️'];

export default function ChatScreen() {
  const styles = useChatStyles();
  const { colors } = useTheme();
  const profile = useProfile();
  const { data: session } = useSession();
  const coupleId = profile.data?.couple_id;
  const uid = session?.user.id;
  if (!coupleId || !uid) return <Screen centered><Header title="Your space for two" /><View style={styles.center}>
    {profile.isPending ? <ActivityIndicator color={colors.primary} /> : <><Text style={styles.emptyTitle}>{profile.isError ? 'Couldn’t load your chat' : 'Your space for two'}</Text><Text style={styles.emptyText}>{profile.isError ? 'Check your connection, then try again.' : 'Connect with your partner to start chatting.'}</Text>
      {profile.isError && <PressableScale onPress={() => void profile.refetch()} style={styles.pill}><Text style={styles.pillText}>Try again</Text></PressableScale>}</>}
  </View></Screen>;
  return <Conversation key={`${coupleId}:${uid}`} coupleId={coupleId} uid={uid} />;
}

function Conversation({ coupleId, uid }: { coupleId: string; uid: string }) {
  const styles = useChatStyles();
  const { colors, spacing, geometry } = useTheme();
  const motion = useMotion();
  const inputHeight = useSharedValue<number>(geometry.touch);
  const inputSize = useAnimatedStyle(() => ({ height: inputHeight.value }));
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [scrollDate, setScrollDate] = useState<string | null>(null);
  const [jumpCount, setJumpCount] = useState(0);
  const openedAt = useRef(Date.now());
  const entered = useRef(new Set<string>());
  const closeActions = useCallback(() => { setSelectedId(null); setShowInfo(false); }, []);
  const selectMessage = useCallback((message: ChatMessage) => { setSelectedId(message.client_id); setShowInfo(false); }, []);
  const replyTo = useCallback((message: ChatMessage) => { if (message.status === 'sent') setReply(message); }, []);
  const claimEntrance = useCallback((message: ChatMessage) => {
    if (entered.current.has(message.client_id)) return false;
    entered.current.add(message.client_id);
    return Date.parse(message.created_at) > openedAt.current;
  }, []);
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
    const top = viewableItems.filter(token => token.isViewable).at(-1);
    if (top) setScrollDate(dayLabel(top.item.created_at));
  }).current;
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
    setJumpCount(0);
    list.current?.scrollToOffset({ offset: 0, animated: motion.level === 'full' });
  };
  useEffect(() => {
    const newest = chat.messages[0];
    if (!newest || newest.client_id === newestId.current) return;
    const firstLoad = !newestId.current;
    const previousIndex = chat.messages.findIndex(message => message.client_id === newestId.current);
    const arrivals = chat.messages.slice(0, previousIndex < 0 ? 1 : previousIndex).filter(message => message.sender_id !== uid).length;
    newestId.current = newest.client_id;
    if (firstLoad || nearBottom.current || newest.sender_id === uid) {
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: 0, animated: !firstLoad && motion.level === 'full' }));
      setNewMessages(false);
      setJumpCount(0);
    } else { setNewMessages(true); setJumpCount(count => count + arrivals); }
  }, [chat.messages, uid, motion.level]);

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
  const known = useMemo(() => new Map(chat.messages.map(message => [message.id, message])), [chat.messages]);
  const selected = chat.messages.find(message => message.client_id === selectedId);
  return <Screen style={styles.screen}>
    <KeyboardAvoidingView behavior="height" automaticOffset style={styles.flex}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }]}><Avatar name={partnerName} /><View style={styles.flex}><Header title={partnerName} subtitle={typing ? 'typing…' : chat.live ? 'Just the two of you' : 'Reconnecting…'} /></View></View>
      {chat.error && <PressableScale accessibilityRole="button" onPress={() => void chat.refresh()} style={styles.error}><Text style={styles.errorText}>{chat.error}</Text></PressableScale>}
      <View style={styles.flex}>
      <LinearGradient pointerEvents="none" colors={[colors.bg, colors.bgElevated]} style={StyleSheet.absoluteFill} />
      <FlatList ref={list} data={chat.messages} inverted keyExtractor={(message) => message.client_id}
        style={styles.flex} contentContainerStyle={styles.history} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }} onViewableItemsChanged={onViewableItemsChanged}
        onScrollBeginDrag={() => setScrolling(true)} onMomentumScrollBegin={() => setScrolling(true)} onMomentumScrollEnd={() => setScrolling(false)} onScrollEndDrag={() => setScrolling(false)}
        onScroll={(event) => { nearBottom.current = event.nativeEvent.contentOffset.y < geometry.touch * 2; if (nearBottom.current) { setNewMessages(false); setJumpCount(0); setScrollDate(null); } }} scrollEventThrottle={motionTokens.stagger}
        onEndReached={() => { if (chat.messages.length >= 50) void chat.loadOlder(); }} onEndReachedThreshold={0.25}
        ListFooterComponent={chat.messages.length > 0 && chat.hasOlder ? <PressableScale disabled={chat.loadingOlder} onPress={() => void chat.loadOlder()} style={styles.earlier} accessibilityRole="button">
          {chat.loadingOlder ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.subtitle}>Load earlier messages</Text>}</PressableScale> : null}
        ListEmptyComponent={<View style={styles.empty}>{!chat.ready ? <View accessibilityLabel="Loading messages" style={{ gap: spacing.md, width: '100%' }}>{Array.from({ length: geometry.firstScreenful }, (_, index) => <Skeleton key={index} width={index % 2 ? '85%' : '65%'} height={geometry.touch} style={{ alignSelf: index % 2 ? 'flex-end' : 'flex-start' }} />)}</View> : <><Text style={styles.emptyTitle}>Your everyday, together.</Text><Text style={styles.emptyText}>Start with a little hello.</Text></>}</View>}
        renderItem={({ item, index }) => {
          const older = chat.messages[index + 1];
          return <MessageBubble message={item} uid={uid} partnerName={partnerName}
            animateArrival={index < geometry.firstScreenful}
            sameOlder={grouped(item, older)} sameNewer={grouped(item, chat.messages[index - 1])}
            showDate={!older || new Date(item.created_at).toDateString() !== new Date(older.created_at).toDateString()}
            knownReply={item.reply_to ? known.get(item.reply_to) : undefined}
            onReply={replyTo} onActions={selectMessage} onRetry={chat.retry} claimEntrance={claimEntrance} highlighted={selectedId === item.client_id} />;
        }} />
      {scrolling && scrollDate && <View pointerEvents="none" style={styles.floatingDate}><Text style={styles.dateText}>{scrollDate}</Text></View>}
      {newMessages && <ChatReveal style={styles.jump}><PressableScale accessibilityRole="button" accessibilityLabel={`${jumpCount} new messages. Scroll to bottom`} onPress={toBottom} style={styles.newMessages}><Text style={styles.pillText}>↓ {jumpCount} new</Text></PressableScale></ChatReveal>}
      </View>

      <Animated.View layout={motion.level === 'full' ? LinearTransition.duration(motion.duration('fast')) : undefined} style={styles.typing}>{typing && <View style={styles.typingBubble}><TypingDots /></View>}</Animated.View>
      {reply && <View style={styles.replyBar}><View style={styles.flex}><Text style={styles.quoteName}>Replying to {reply.sender_id === uid ? 'yourself' : partnerName}</Text><Text style={styles.subtitle} numberOfLines={1}>{reply.kind === 'image' ? '📷 Photo' : reply.body}</Text></View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReply(null)} style={styles.icon}><Ionicons name="close" size={geometry.icon} color={colors.textSecondary} /></PressableScale></View>}
      {emojiOpen && <ScrollView horizontal keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojis} style={styles.emojiPanel}>{EMOJI.map((emoji) => <PressableScale key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => { if (draft.length < 3998) edit(`${draft}${emoji}`); }} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></PressableScale>)}</ScrollView>}
      <View style={styles.composer}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Choose photo" disabled={!chat.ready || picking} onPress={() => void sendPhoto()} style={styles.icon}>{picking ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="image-outline" size={geometry.icon} color={colors.primary} />}</PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Show emoji" onPress={() => setEmojiOpen(!emojiOpen)} style={styles.icon}><Ionicons name="happy-outline" size={geometry.icon} color={colors.textSecondary} /></PressableScale>
        <Animated.View style={[{ flex: 1 }, inputSize]}>
          <TextInput accessibilityLabel="Message" placeholder="A message for your person…" placeholderTextColor={colors.textSecondary} value={draft} onChangeText={edit}
            onContentSizeChange={event => {
              const height = Math.max(geometry.touch, Math.min(geometry.touch * 3, event.nativeEvent.contentSize.height));
              inputHeight.value = motion.level === 'full' ? withTiming(height, { duration: motion.duration('fast') }) : height;
            }}
            editable={chat.ready && !picking} multiline maxLength={4000} style={styles.input} textAlignVertical="center" />
        </Animated.View>
        <ComposerSend visible={!!draft.trim()} disabled={!chat.ready || picking} onPress={sendText} />
      </View>
    </KeyboardAvoidingView>
    <BottomSheet visible={!!selected} onClose={closeActions} title={showInfo ? 'Message info' : 'Message actions'}>
      {selected && <>
        <Text style={[styles.subtitle, { backgroundColor: colors.surfaceAlt, padding: spacing.s12 }]} numberOfLines={3}>{selected.body || 'Photo'}</Text>
        {showInfo ? <>
          <ListItem title={selected.status === 'sent' ? `Sent ${new Date(selected.created_at).toLocaleString()}` : `Queued ${new Date(selected.created_at).toLocaleString()}`}
            subtitle={selected.status === 'sent' ? undefined : 'Not sent yet'} leading={<View style={{ backgroundColor: selected.status === 'failed' ? colors.surface : colors.bubbleMineStart, borderRadius: geometry.receipt }}><MessageStatusTicks status={selected.status} /></View>} />
          <ListItem title={`Seen ${selected.read_at ? new Date(selected.read_at).toLocaleString() : 'not yet'}`} leading={<View style={{ backgroundColor: colors.bubbleMineStart, borderRadius: geometry.receipt }}><MessageStatusTicks status={selected.read_at ? 'seen' : 'sent'} /></View>} />
        </> : <>
          {selected.status === 'sent' && <ListItem title="Reply" onPress={() => { replyTo(selected); closeActions(); }} leading={<Ionicons name="arrow-undo-outline" size={geometry.icon} color={colors.textPrimary} />} />}
          {selected.sender_id === uid && <ListItem title="Info" onPress={() => setShowInfo(true)} leading={<Ionicons name="information-circle-outline" size={geometry.icon} color={colors.textPrimary} />} />}
          {selected.status === 'failed' && <ListItem title="Retry" onPress={() => { chat.retry(selected); closeActions(); }} leading={<MessageStatusTicks status="failed" />} />}
        </>}
      </>}
    </BottomSheet>
  </Screen>;
}
