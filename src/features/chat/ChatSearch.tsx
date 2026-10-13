import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Text, TextInput, View } from 'react-native';
import Fuse from 'fuse.js';
import { Screen, Header } from '@/ui';
import { PressableScale, useMotion } from '@/motion';
import { useTheme } from '@/theme';
import { bodySummary, expired, firstLink, matchParts, matchRanges, searchBody } from './body';
import { findMessages } from './plusService';
import { mergeMessages, type ChatMessage } from './model';
import { useChatStyles } from './styles';

export function ChatSearch({ visible, onClose, messages, couple, onJump }: { visible: boolean; onClose: () => void; messages: ChatMessage[]; couple: string; onJump: (id: string) => void }) {
  const styles = useChatStyles(); const { colors, spacing, typography } = useTheme(); const motion = useMotion();
  const [query, setQuery] = useState(''); const [filter, setFilter] = useState('all');
  const [remote, setRemote] = useState<ChatMessage[]>([]); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const searchable = useMemo(() => messages.filter(m => !m.deleted_at && !expired(m)).map(message => ({ message, text: searchBody(message) })), [messages]);
  const fuse = useMemo(() => new Fuse(searchable, { keys: ['text'], threshold: 0.35, ignoreLocation: true, includeMatches: true }), [searchable]);
  const fuzzy = useMemo(() => query.trim() ? fuse.search(query.trim()) : [], [fuse, query]);
  const local = useMemo(() => query.trim() ? fuzzy.map(result => result.item.message) : searchable.map(result => result.message), [fuzzy, query, searchable]);
  const matches = useMemo(() => new Map(fuzzy.map(result=>[result.item.message.client_id,result.matches?.flatMap(match=>[...match.indices]) ?? []])), [fuzzy]);
  useEffect(() => {
    if (!visible) return;
    setRemote([]); setError(false);
    if (!query.trim() && filter === 'all') { setBusy(false); return; }
    const controller = new AbortController(); setBusy(true);
    const timer = setTimeout(() => {
      void findMessages(couple, query, filter, controller.signal).then(setRemote).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [couple, query, filter, visible, retry]);
  const results = useMemo(() => mergeMessages(local, remote).filter(message => !message.deleted_at && !expired(message)
    && (filter !== 'photos' || message.kind === 'image') && (filter !== 'links' || !!firstLink(message.body)) && (filter !== 'pinned' || !!message.pinned_at)), [local, remote, filter]);
  return <Modal visible={visible} onRequestClose={onClose} animationType={motion.level === 'off' ? 'none' : 'fade'}>
    <Screen><Header title="Search your chat" subtitle="Instant saved messages · older matches while online" onBack={onClose} />
      <TextInput accessibilityLabel="Search messages" value={query} onChangeText={setQuery} placeholder="Search words or a phrase…" placeholderTextColor={colors.textSecondary} style={styles.input} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{['all','photos','links','pinned'].map(value => <PressableScale key={value} accessibilityRole="button" accessibilityState={{ selected: value === filter }} onPress={() => setFilter(value)} style={styles.icon}><Text style={{ ...typography.label, color: value === filter ? colors.primary : colors.textPrimary }}>{value}</Text></PressableScale>)}</View>
      {busy && <ActivityIndicator accessibilityLabel="Searching older messages" color={colors.primary} />}
      {error && <PressableScale onPress={() => setRetry(value => value + 1)}><Text style={styles.errorText}>Older messages unavailable. Saved matches remain · retry</Text></PressableScale>}
      <FlatList data={results} keyExtractor={message => message.client_id} keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.subtitle}>{busy ? 'Searching…' : 'No matching messages'}</Text>}
        renderItem={({ item }) => <PressableScale accessibilityRole="button" accessibilityLabel="Jump to matching message" onPress={() => { onJump(item.id); onClose(); }} style={{ paddingVertical: spacing.s12, gap: spacing.sm }}>
          <Text style={styles.body}>{(matches.has(item.client_id) ? matchRanges(bodySummary(item),matches.get(item.client_id) ?? []) : matchParts(bodySummary(item), query)).map((part, index) => <Text key={index} style={part.match ? { backgroundColor: colors.primary, color: colors.primaryContrast } : undefined}>{part.text}</Text>)}</Text>
          <Text style={styles.subtitle}>{new Date(item.created_at).toLocaleString()}</Text>
        </PressableScale>} />
    </Screen>
  </Modal>;
}
