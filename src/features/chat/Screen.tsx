import { VoiceRecorder } from '@/features/voice';
import { persistVoice } from '@/features/voice/storage';
import { setVoiceQueue, pauseVoice } from '@/features/voice/playback';
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
import { useChatPlus } from './useChatPlus';
import { bodySummary, bodyText, decodeBody, encodeBody, expired } from './body';
import { chatDb, updateMessage } from './plusService';
import { ChatSearch } from './ChatSearch';
import { ScheduleSheet } from './ScheduleSheet';
import { validReaction } from './ReactionChips';
import { EncryptionStatus } from '@/features/e2ee/Status';

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
  const [visibleMessageIds, setVisibleMessageIds] = useState<string[]>([]);
  const plus = useChatPlus(coupleId, uid, chat.messages, active, visibleMessageIds);
  const { typing, updateTyping } = useTyping(coupleId, uid, partner.data?.id, active);
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ChatMessage | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [newMessages, setNewMessages] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [scrollDate, setScrollDate] = useState<string | null>(null);
  const [jumpCount, setJumpCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewOnce, setViewOnce] = useState(false);
  const [moreReactions, setMoreReactions] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [editBody, setEditBody] = useState('');
  const [mutationBusy, setMutationBusy] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [jumpTarget, setJumpTarget] = useState<string | null>(null);
  const [pinWidth, setPinWidth] = useState(geometry.touch * 5);
  const openedAt = useRef(Date.now());
  const entered = useRef(new Set<string>());
  const closeActions = useCallback(() => { setSelectedId(null); setShowInfo(false); }, []);
  const selectMessage = useCallback((message: ChatMessage) => { setSelectedId(message.client_id); setShowInfo(false); setMoreReactions(false); }, []);
  const replyTo = useCallback((message: ChatMessage) => { if (message.status === 'sent' && !message.deleted_at && message.kind !== 'system' && !expired(message)) setReply(message); }, []);
  const claimEntrance = useCallback((message: ChatMessage) => {
    if (entered.current.has(message.client_id)) return false;
    entered.current.add(message.client_id);
    return Date.parse(message.created_at) > openedAt.current;
  }, []);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<ChatMessage>[] }) => {
    const top = viewableItems.filter(token => token.isViewable).at(-1);
    if (top) setScrollDate(dayLabel(top.item.created_at));
    const ids=viewableItems.filter(token=>token.isViewable).map(token=>token.item.id);
    chat.setVisible(ids); setVisibleMessageIds(current=>current.join(',')===ids.join(',') ? current : ids);
  }, [chat.setVisible]);
  const list = useRef<FlatList<ChatMessage>>(null);
  const jumpAttempts = useRef(0);
  const jumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(jumpTimer.current), []);
  const jumpTo = useCallback((id: string) => {
    void (async () => {
      try {
        const message = chat.messages.find(row => row.id === id) ?? await chat.jump(id);
        if (!message || expired(message)) throw new Error('This message expired or is no longer available.');
        jumpAttempts.current = 0; nearBottom.current = false; setJumpTarget(message.client_id); setHighlightId(message.client_id);
      } catch (reason: unknown) { Alert.alert('Couldn’t jump to message', reason instanceof Error ? reason.message : 'Reconnect and try again.'); }
    })();
  }, [chat.messages, chat.jump]);
  useEffect(() => {
    if (!jumpTarget) return;
    const index = chat.messages.findIndex(message => message.client_id === jumpTarget);
    if (index < 0) return;
    const frame = requestAnimationFrame(() => { list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: motion.level === 'full' }); setJumpTarget(null); });
    return () => cancelAnimationFrame(frame);
  }, [jumpTarget, chat.messages, motion.level]);
  useEffect(() => { if (!highlightId) return; const timer = setTimeout(() => setHighlightId(null), motionTokens.slow * 4); return () => clearTimeout(timer); }, [highlightId]);
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
    setJumpTarget(null); clearTimeout(jumpTimer.current);
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
  useEffect(() => {
    setVoiceQueue([...chat.messages].reverse().map(message => ({ id: message.id, path: message.kind === 'voice' && !message.deleted_at && !message.decryptionError && message.status === 'sent' ? message.media_path : null, encrypted: !!message.enc, couple: coupleId, receiver: message.sender_id !== uid, meta: message.meta })));
    return () => { setVoiceQueue([]); };
  }, [chat.messages, coupleId, uid]);
  useEffect(() => { if (!active) pauseVoice(); return () => pauseVoice(); }, [active]);
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
        chat.send(draftRef.current, replyRef.current?.id ?? null, viewOnce ? { ...photo, path: `${coupleId}/chat-once/${uid}/${photo.path.split('/').at(-1)}`, viewOnce: true } : photo);
        setViewOnce(false);
        edit(''); setReply(null); toBottom();
      }
    } catch (error: unknown) {
      if (mounted.current) Alert.alert('Couldn’t attach photo', error instanceof Error ? error.message : 'Please try choosing a photo again.');
    } finally { photoBusy.current = false; if (mounted.current) setPicking(false); }
  };
  const known = useMemo(() => new Map(chat.messages.map(message => [message.id, message])), [chat.messages]);
  const selected = chat.messages.find(message => message.client_id === selectedId);
  const perform = async (action: () => Promise<void>) => {
    if (mutationBusy) return; setMutationBusy(true);
    try { await action(); await plus.refresh(); }
    catch (reason: unknown) { Alert.alert('Couldn’t save change', reason instanceof Error ? reason.message : 'Reconnect and try again.'); }
    finally { setMutationBusy(false); }
  };
  const reactTo = useCallback((message: ChatMessage, emoji: string, ensure = false) => {
    void plus.react(message, emoji, ensure).catch(() => Alert.alert('Reaction not saved', 'Reconnect and try again.'));
  }, [plus.react]);
  return <Screen style={styles.screen}>
    <KeyboardAvoidingView behavior="height" automaticOffset style={styles.flex}>
      <View style={[styles.header, { flexDirection: 'row', alignItems: 'center', gap: spacing.s12 }]}><Avatar name={partnerName} /><View style={styles.flex}><Header title={partnerName} subtitle={typing ? 'typing…' : chat.live ? 'Just the two of you' : 'Reconnecting…'} /></View></View>
      <EncryptionStatus />
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.bgElevated }}>
        <PressableScale accessibilityRole="button" onPress={() => setSearchOpen(true)}><Text style={styles.body}>Search</Text></PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => setScheduleOpen(true)}><Text style={styles.body}>Scheduled</Text></PressableScale>
        <PressableScale accessibilityRole="button" onPress={() => setSettingsOpen(true)}><Text style={styles.body}>Settings</Text></PressableScale>
      </View>
      {!!plus.pins.data?.length && <View onLayout={event => setPinWidth(event.nativeEvent.layout.width)}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>{plus.pins.data.filter(message => !expired(message)).map((pin, index, pins) => <PressableScale key={pin.id} accessibilityRole="button" onPress={() => jumpTo(pin.id)} style={{ width: pinWidth, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <Text style={styles.quoteName}>📌 Pinned {index + 1}/{pins.length} · tap to jump</Text><Text numberOfLines={1} style={styles.body}>{bodySummary(pin)}</Text>
        </PressableScale>)}</ScrollView>
      </View>}
      {plus.error && <PressableScale onPress={() => void plus.refresh()} style={styles.error}><Text style={styles.errorText}>Chat extras unavailable · reconnect and retry</Text></PressableScale>}
      {chat.error && <PressableScale accessibilityRole="button" onPress={() => void chat.refresh()} style={styles.error}><Text style={styles.errorText}>{chat.error}</Text></PressableScale>}
      <View style={styles.flex}>
      <LinearGradient pointerEvents="none" colors={[colors.bg, colors.bgElevated]} style={StyleSheet.absoluteFill} />
      <FlatList ref={list} data={chat.messages} inverted keyExtractor={(message) => message.client_id}
        onScrollToIndexFailed={({ index, averageItemLength }) => { if (++jumpAttempts.current > 4) { setJumpTarget(null); return; } list.current?.scrollToOffset({ offset: index * averageItemLength, animated: false }); clearTimeout(jumpTimer.current); jumpTimer.current = setTimeout(() => list.current?.scrollToIndex({ index, viewPosition: 0.5, animated: false }), motion.duration('slow')); }}
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
          return <View><MessageBubble message={item} uid={uid} partnerName={partnerName}
            animateArrival={index < geometry.firstScreenful}
            sameOlder={grouped(item, older)} sameNewer={grouped(item, chat.messages[index - 1])}
            showDate={!older || new Date(item.created_at).toDateString() !== new Date(older.created_at).toDateString()}
            knownReply={item.reply_to ? known.get(item.reply_to) : undefined}
            onReply={replyTo} onActions={selectMessage} onRetry={chat.retry} claimEntrance={claimEntrance} highlighted={selectedId === item.client_id || highlightId === item.client_id}
            reactions={plus.reactions.get(item.id)} onReact={reactTo} onJump={jumpTo} />
            {chat.gaps.some(gap=>gap.anchor.client_id===item.client_id) && <PressableScale accessibilityRole="button" disabled={chat.loadingGap!==null} onPress={()=>void chat.loadGap(item.client_id)} style={styles.earlier}><Text style={styles.subtitle}>{chat.loadingGap===item.client_id ? 'Loading the gap…' : 'Load messages between these dates'}</Text></PressableScale>}
          </View>;
        }} />
      {scrolling && scrollDate && <View pointerEvents="none" style={styles.floatingDate}><Text style={styles.dateText}>{scrollDate}</Text></View>}
      {newMessages && <ChatReveal style={styles.jump}><PressableScale accessibilityRole="button" accessibilityLabel={`${jumpCount} new messages. Scroll to bottom`} onPress={toBottom} style={styles.newMessages}><Text style={styles.pillText}>↓ {jumpCount} new</Text></PressableScale></ChatReveal>}
      </View>

      <Animated.View layout={motion.level === 'full' ? LinearTransition.duration(motion.duration('fast')) : undefined} style={styles.typing}>{typing && <View style={styles.typingBubble}><TypingDots /></View>}</Animated.View>
      {reply && <View style={styles.replyBar}><View style={styles.flex}><Text style={styles.quoteName}>Replying to {reply.sender_id === uid ? 'yourself' : partnerName}</Text><Text style={styles.subtitle} numberOfLines={1}>{bodySummary(known.get(reply.id) ?? reply)}</Text></View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Cancel reply" onPress={() => setReply(null)} style={styles.icon}><Ionicons name="close" size={geometry.icon} color={colors.textSecondary} /></PressableScale></View>}
      {emojiOpen && <ScrollView horizontal keyboardShouldPersistTaps="always" contentContainerStyle={styles.emojis} style={styles.emojiPanel}>{EMOJI.map((emoji) => <PressableScale key={emoji} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`} onPress={() => { if (draft.length < 3998) edit(`${draft}${emoji}`); }} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></PressableScale>)}</ScrollView>}
      <PressableScale accessibilityRole="switch" accessibilityState={{ checked: viewOnce }} onPress={() => setViewOnce(!viewOnce)} style={{ paddingHorizontal: spacing.lg, justifyContent: 'center' }}><Text style={styles.subtitle}>① Next photo: {viewOnce ? 'view once · On' : 'view once · Off'}</Text></PressableScale>
      <View style={styles.composer}>
        <PressableScale accessibilityRole="button" accessibilityLabel="Choose photo" disabled={!chat.ready || picking || voiceBusy} onPress={() => void sendPhoto()} style={styles.icon}>{picking ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="image-outline" size={geometry.icon} color={colors.primary} />}</PressableScale>
        <PressableScale accessibilityRole="button" accessibilityLabel="Show emoji" disabled={voiceBusy} onPress={() => setEmojiOpen(!emojiOpen)} style={styles.icon}><Ionicons name="happy-outline" size={geometry.icon} color={colors.textSecondary} /></PressableScale>
        <Animated.View style={[{ flex: 1, display: voiceBusy ? 'none' : 'flex' }, inputSize]}>
          <TextInput accessibilityLabel="Message" placeholder="A message for your person…" placeholderTextColor={colors.textSecondary} value={draft} onChangeText={edit}
            onContentSizeChange={event => {
              const height = Math.max(geometry.touch, Math.min(geometry.touch * 3, event.nativeEvent.contentSize.height));
              inputHeight.value = motion.level === 'full' ? withTiming(height, { duration: motion.duration('fast') }) : height;
            }}
            editable={chat.ready && !picking && !voiceBusy} multiline maxLength={4000} style={styles.input} textAlignVertical="center" />
        </Animated.View>
        {draft.trim() ? <ComposerSend visible disabled={!chat.ready || picking || voiceBusy} onPress={sendText} onLongPress={() => setScheduleOpen(true)} /> : <VoiceRecorder onBusyChange={busy => { setVoiceBusy(busy); if (busy) { setEmojiOpen(false); updateTyping(''); } }} disabled={!chat.ready || picking || !active} onRecorded={async recording => { const voice = await persistVoice(recording, coupleId, uid); chat.send('', replyRef.current?.id ?? null, voice); setReply(null); toBottom(); }} />}
      </View>
    </KeyboardAvoidingView>
    <BottomSheet visible={!!selected} onClose={closeActions} title={showInfo ? 'Message info' : 'Message actions'}>
      {selected && <>
        <Text style={[styles.subtitle, { backgroundColor: colors.surfaceAlt, padding: spacing.s12 }]} numberOfLines={3}>{bodyText(selected, uid, selected.sender_id) || bodySummary(selected)}</Text>
        {showInfo ? <>
          {selected.deleted_at ? <ListItem title={`Deleted ${new Date(selected.deleted_at).toLocaleString()}`} /> : <><ListItem title={selected.status === 'sent' ? `Sent ${new Date(selected.created_at).toLocaleString()}` : `Queued ${new Date(selected.created_at).toLocaleString()}`}
            subtitle={selected.status === 'sent' ? undefined : 'Not sent yet'} leading={<View style={{ backgroundColor: selected.status === 'failed' ? colors.surface : colors.bubbleMineStart, borderRadius: geometry.receipt }}><MessageStatusTicks status={selected.status} /></View>} />
          {selected.status === 'sent' && <ListItem title={`Seen ${selected.read_at ? new Date(selected.read_at).toLocaleString() : 'not yet'}`} leading={<View style={{ backgroundColor: colors.bubbleMineStart, borderRadius: geometry.receipt }}><MessageStatusTicks status={selected.read_at ? 'seen' : 'sent'} /></View>} />}</>}
          {!!selected.edited_at && !selected.deleted_at && <ListItem title={`Edited ${new Date(selected.edited_at).toLocaleString()}`} />}
          {!!selected.expires_at && <ListItem title={`Expires ${new Date(selected.expires_at).toLocaleString()}`} subtitle="Expired messages disappear from history." />}
          {selected.view_once && <ListItem title={selected.viewed_at ? `Opened ${new Date(selected.viewed_at).toLocaleString()}` : 'View-once photo · unopened'} />}
        </> : <>
          {selected.status === 'sent' && !selected.deleted_at && selected.kind !== 'system' && <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{EMOJI.slice(0,6).map(emoji => <PressableScale key={emoji} accessibilityLabel={`React ${emoji}`} onPress={() => { reactTo(selected,emoji); closeActions(); }} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></PressableScale>)}<PressableScale onPress={() => setMoreReactions(!moreReactions)} style={styles.emoji}><Text style={styles.body}>More</Text></PressableScale></View>
            {moreReactions && <><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{EMOJI.slice(6).map(emoji => <PressableScale key={emoji} onPress={() => { reactTo(selected,emoji); closeActions(); }} style={styles.emoji}><Text style={styles.emojiText}>{emoji}</Text></PressableScale>)}</View><TextInput accessibilityLabel="Choose another emoji with your keyboard" placeholder="Another emoji…" placeholderTextColor={colors.textSecondary} value={customEmoji} onChangeText={setCustomEmoji} maxLength={32} style={styles.input} /><ListItem title="Use this reaction" disabled={!validReaction(customEmoji.trim())} onPress={() => { reactTo(selected,customEmoji.trim()); setCustomEmoji(''); closeActions(); }} /></>}
            <ListItem title="Reply" onPress={() => { replyTo(selected); closeActions(); }} leading={<Ionicons name="arrow-undo-outline" size={geometry.icon} color={colors.textPrimary} />} />
            <ListItem title={selected.pinned_at ? 'Unpin' : 'Pin for both of us'} disabled={mutationBusy} onPress={() => void perform(async () => { chat.merge([await updateMessage(coupleId,selected.id,{ pinned_at: selected.pinned_at ? null : new Date().toISOString(), pinned_by: selected.pinned_at ? null : uid })]); closeActions(); })} />
            {selected.sender_id === uid && <>
              {Date.now()-Date.parse(selected.created_at) < 15*60_000 && selected.kind === 'text' && <ListItem title="Edit message" onPress={() => { setEditing(selected); setEditBody(decodeBody(selected.body)); closeActions(); }} />}
              <ListItem title="Delete for everyone" disabled={mutationBusy} onPress={() => void perform(async () => { chat.merge([await updateMessage(coupleId,selected.id,{ deleted_at: new Date().toISOString() })]); closeActions(); })} />
            </>}
          </>}
          {selected.sender_id === uid && <ListItem title="Info" onPress={() => setShowInfo(true)} leading={<Ionicons name="information-circle-outline" size={geometry.icon} color={colors.textPrimary} />} />}
          {selected.status === 'failed' && <ListItem title="Retry" onPress={() => { chat.retry(selected); closeActions(); }} leading={<MessageStatusTicks status="failed" />} />}
        </>}
      </>}
    </BottomSheet>
    <BottomSheet visible={!!editing} onClose={() => setEditing(null)} title="Edit message">
      <Text style={styles.subtitle}>Available for 15 minutes after sending.</Text><TextInput accessibilityLabel="Edited message" value={editBody} onChangeText={setEditBody} multiline maxLength={4000} style={styles.input} />
      <ListItem title="Save edit" disabled={mutationBusy || !editBody.trim()} onPress={() => void perform(async () => { if (editing) chat.merge([await updateMessage(coupleId,editing.id,{ body: encodeBody(editBody), edited_at: new Date().toISOString() })]); setEditing(null); })} />
    </BottomSheet>
    <BottomSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title="Chat settings">
      <Text style={styles.subtitle}>Disappearing messages apply to new messages. Off by default. Both of you see changes.</Text>
      {plus.settings.isPending && <ActivityIndicator color={colors.primary} />}
      {[['Off',0],['1 hour',3600],['24 hours',86400],['7 days',604800]].map(([label,seconds]) => <ListItem key={seconds} title={`${plus.settings.data?.disappearing_seconds === seconds ? '✓ ' : ''}${label}`} disabled={mutationBusy || !plus.settings.data} onPress={() => void perform(async () => { const result = await chatDb.rpc('chat_set_timer',{ seconds }); if (result.error) throw result.error; setSettingsOpen(false); })} />)}
    </BottomSheet>
    <ChatSearch visible={searchOpen} onClose={() => setSearchOpen(false)} messages={chat.messages} couple={coupleId} onJump={jumpTo} />
    <ScheduleSheet visible={scheduleOpen} onClose={() => setScheduleOpen(false)} couple={coupleId} uid={uid} draft={draft} replyTo={reply?.id ?? null} jobs={plus.scheduled.data ?? []} loading={plus.scheduled.isPending} error={plus.scheduled.isError} refresh={plus.refresh} onSaved={() => { edit(''); setReply(null); }} />
  </Screen>;
}
