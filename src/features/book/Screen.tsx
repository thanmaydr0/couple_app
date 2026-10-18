import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { PlusJakartaSans_400Regular, PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { Button, Card, EmptyState, ErrorState, Header, Screen, Skeleton, Text } from '@/ui';
import { useCouple, useProfile, useSession } from '@/lib/hooks';
import { favoriteMessages, loadBookSource } from './service';
import { generateBookHtml } from './html';
import type { BookChapter, BookOptions, BookPeriod, BookRange, BookSource } from './types';

const chapterChoices: { id: BookChapter; title: string; description: string }[] = [
  { id: 'photos', title: 'Photo chapters', description: 'Monthly pages with a little collage' },
  { id: 'messages', title: 'Favorite messages', description: 'Pinned, most-reacted, and chosen words' },
  { id: 'milestones', title: 'Milestones', description: 'Milestones, plans, and opened capsules' },
  { id: 'places', title: 'Places', description: 'Saved places and a small world map' },
  { id: 'wins', title: 'Bucket-list wins', description: 'Ideas you checked off together' },
  { id: 'stats', title: 'Our stats', description: 'Wrapped counts when available' },
];
const blankChapters = (): Record<BookChapter, boolean> => ({ photos: true, messages: true, milestones: true, places: true, wins: true, stats: true });
const dateOnly = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dateRange = (period: BookPeriod, year: number, from: string, to: string, anniversary?: string | null, created?: string) : BookRange => {
  const today = new Date(); const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (period === 'year') return { from: `${year}-01-01`, to: `${year + 1}-01-01`, label: String(year), year };
  if (period === 'since-start') { const first = anniversary ?? created?.slice(0, 10) ?? dateOnly(today); return { from: first, to: dateOnly(tomorrow), label: 'Since the beginning' }; }
  const end = new Date(`${to}T00:00:00`); end.setDate(end.getDate() + 1);
  return { from, to: dateOnly(end), label: `${from} to ${to}` };
};

async function localFont(moduleId: number): Promise<string> {
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  return base64;
}
async function fontCss() {
  try {
    const [serif, regular, semibold] = await Promise.all([localFont(Fraunces_600SemiBold), localFont(PlusJakartaSans_400Regular), localFont(PlusJakartaSans_600SemiBold)]);
    return `@font-face{font-family:BookSerif;src:url(data:font/ttf;base64,${serif}) format('truetype');font-weight:600}@font-face{font-family:BookSans;src:url(data:font/ttf;base64,${regular}) format('truetype');font-weight:400}@font-face{font-family:BookSans;src:url(data:font/ttf;base64,${semibold}) format('truetype');font-weight:600}`;
  } catch { return ''; }
}

export default function BookScreen() {
  const profile = useProfile(); const couple = useCouple(); const session = useSession();
  const { colors, spacing, radius, geometry, typography } = useTheme();
  const user = session.data?.user.id; const coupleId = profile.data?.couple_id;
  const nowYear = new Date().getFullYear();
  const [period, setPeriod] = useState<BookPeriod>('year'); const [year, setYear] = useState(nowYear);
  const [customFrom, setCustomFrom] = useState(`${nowYear}-01-01`); const [customTo, setCustomTo] = useState(dateOnly(new Date()));
  const range = useMemo(() => dateRange(period, year, customFrom, customTo, couple.data?.anniversary, couple.data?.created_at), [period, year, customFrom, customTo, couple.data?.anniversary, couple.data?.created_at]);
  const [options, setOptions] = useState<BookOptions>({ title: 'Book of Us', dedication: '', chapters: blankChapters(), selectedMessages: [], printFriendly: true, lightQuality: false });
  const [source, setSource] = useState<BookSource>(); const [sourceBusy, setSourceBusy] = useState(false); const [sourceError, setSourceError] = useState('');
  const [phase, setPhase] = useState<'setup' | 'progress' | 'preview'>('setup'); const [html, setHtml] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 1, label: 'Getting everything ready' }); const [pdfUri, setPdfUri] = useState(''); const [pdfBytes, setPdfBytes] = useState(0); const [exportBusy, setExportBusy] = useState(false); const [savedNotice, setSavedNotice] = useState('');
  const cancel = useRef(false); const generationStarted = useRef(0);

  useEffect(() => {
    if (!coupleId || !user || period === 'custom' && (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo) || customFrom >= customTo)) { setSource(undefined); setSourceBusy(false); return; }
    let live = true; setSourceBusy(true); setSourceError(''); setSource(undefined);
    void loadBookSource(coupleId, user, range).then(result => { if (live) { setSource(result); const best = favoriteMessages(result.messages, result.reactions).slice(0, 8).map(row => row.id); setOptions(current => ({ ...current, selectedMessages: current.selectedMessages.length ? current.selectedMessages.filter(id => result.messages.some(row => row.id === id)) : best })); } })
      .catch(reason => { if (live) setSourceError(reason instanceof Error ? reason.message : 'Shared memories could not be loaded.'); })
      .finally(() => { if (live) setSourceBusy(false); });
    return () => { live = false; };
  }, [coupleId, user, range.from, range.to, range.year, period, customFrom, customTo]);

  const chosenMessages = useMemo(() => source ? favoriteMessages(source.messages, source.reactions).slice(0, 30) : [], [source]);
  const selectedCount = chapterChoices.filter(chapter => options.chapters[chapter.id]).length;
  const photoCount = options.chapters.photos ? source?.photos.length ?? 0 : 0;
  const estimatedSeconds = Math.max(4, Math.ceil(photoCount * (options.lightQuality ? 0.8 : 1.6) + selectedCount * 1.2));
  const canBuild = !!source && !sourceBusy && (selectedCount > 0 || options.title.trim().length > 0);

  const build = async (lighter = options.lightQuality) => {
    if (!source) return;
    cancel.current = false; generationStarted.current = Date.now(); setPhase('progress'); setProgress({ done: 0, total: Math.max(1, selectedCount), label: 'Preparing the first chapter' });
    try {
      const fonts = await fontCss();
      const document = await generateBookHtml({ options: { ...options, lightQuality: lighter }, source, colors, fontCss: fonts, canceled: () => cancel.current, progress: (done, total, label) => setProgress({ done, total: Math.max(total, 1), label }) });
      if (cancel.current) return;
      setHtml(document); setPhase('preview'); setPdfUri(''); setPdfBytes(0);
    } catch (reason) {
      if (!cancel.current) Alert.alert('Book of Us', reason instanceof Error ? reason.message : 'Could not prepare the book. Check your connection and try again.');
      setPhase('setup');
    }
  };
  const exportPdf = async () => {
    if (!html || exportBusy) return;
    setExportBusy(true); setSavedNotice('');
    try {
      const output = await Print.printToFileAsync({ html });
      const info = await FileSystem.getInfoAsync(output.uri);
      const bytes = info.exists && 'size' in info ? info.size : 0;
      setPdfUri(output.uri); setPdfBytes(bytes); setExportBusy(false);
      if (bytes > 50 * 1024 * 1024) {
        Alert.alert('Large keepsake PDF', options.lightQuality ? 'This PDF is still over 50 MB. You can share it or save it to Files.' : 'This file is over 50 MB. Make a lighter copy to reduce its size.', options.lightQuality ? [{ text: 'OK' }] : [
          { text: 'Keep this PDF' },
          { text: 'Make lighter copy', onPress: () => { setOptions(value => ({ ...value, lightQuality: true })); void build(true); } },
        ]);
      }
    } catch (reason) { Alert.alert('Export PDF', reason instanceof Error ? reason.message : 'The PDF could not be created.'); }
    finally { setExportBusy(false); }
  };
  const sharePdf = async () => {
    if (!pdfUri) return;
    try { if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', dialogTitle: 'Share your Book of Us', UTI: 'com.adobe.pdf' }); else Alert.alert('Sharing unavailable', 'Use Save to Files to keep a copy on this phone.'); }
    catch { Alert.alert('Share PDF', 'The share sheet could not open. Save a copy to Files instead.'); }
  };
  const savePdf = async () => {
    if (!pdfUri) return;
    try {
      const access = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!access.granted) return;
      const name = `Book-of-Us-${new Date().getFullYear()}`;
      const destination = await FileSystem.StorageAccessFramework.createFileAsync(access.directoryUri, name, 'application/pdf');
      await FileSystem.StorageAccessFramework.copyAsync({ from: pdfUri, to: destination });
      setSavedNotice('Saved in the folder you chose.');
    } catch { Alert.alert('Save to Files', 'Could not save this PDF to that folder. Try choosing Downloads or Documents.'); }
  };

  if (!coupleId || !user) return <Screen><Header title="Book of Us" /><View style={{ flex: 1, justifyContent: 'center', gap: spacing.md }}>
    {profile.isPending ? <ActivityIndicator color={colors.primary} /> : <EmptyState title={profile.isError ? 'Your book is waiting' : 'A story for two'} description={profile.isError ? 'We could not load your shared space. Reconnect and try again.' : 'Sign in and link your couple to make a keepsake.'} />}
  </View></Screen>;

  if (phase === 'progress') {
    const ratio = Math.min(1, progress.done / progress.total); const seconds = Math.max(0, Math.ceil(estimatedSeconds * (1 - ratio))); const elapsed = Math.max(0, Math.floor((Date.now() - generationStarted.current) / 1000));
    return <Screen><Header title="Making your book" /><View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
      <Card style={{ gap: spacing.md, padding: spacing.lg }}><Text variant="title/M">Gathering your story</Text><Text color="textSecondary">{progress.label}</Text><View style={{ height: geometry.track, backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, overflow: 'hidden' }}><View style={{ width: `${Math.max(6, ratio * 100)}%`, height: '100%', backgroundColor: colors.primary }} /></View><Text variant="caption" color="textSecondary">{progress.done} of {progress.total} chapters · about {seconds || 1} seconds left · {elapsed}s elapsed</Text></Card>
      <Button title="Cancel book making" variant="secondary" onPress={() => { cancel.current = true; setPhase('setup'); }} />
    </View></Screen>;
  }

  if (phase === 'preview') return <Screen style={{ paddingHorizontal: 0 }}><View style={{ paddingHorizontal: spacing.lg }}><Header title="Preview your book" subtitle={pdfUri ? `${(pdfBytes / (1024 * 1024)).toFixed(1)} MB PDF` : 'A5 pages · print-ready'} onBack={() => setPhase('setup')} /></View>
    <WebView source={{ html }} originWhitelist={['*']} javaScriptEnabled={false} allowFileAccess={false} style={{ flex: 1, backgroundColor: colors.bg }} accessibilityLabel="Book of Us print preview" />
    <View style={{ padding: spacing.md, gap: spacing.sm, borderTopWidth: geometry.hairline, borderTopColor: colors.border }}>
      {pdfUri ? <View style={{ flexDirection: 'row', gap: spacing.sm }}><Button title={exportBusy ? 'Preparing…' : 'Share PDF'} loading={exportBusy} onPress={() => void sharePdf()} /><Button title="Save to Files" variant="secondary" disabled={exportBusy} onPress={() => void savePdf()} /></View> : <Button title={exportBusy ? 'Creating PDF…' : 'Export PDF'} loading={exportBusy} onPress={() => void exportPdf()} />}
      {!!savedNotice && <Text variant="caption" color="success" accessibilityLiveRegion="polite">{savedNotice}</Text>}
    </View></Screen>;

  if (sourceError) return <Screen><Header title="Book of Us" /><ErrorState title="Couldn’t gather your memories" description={sourceError} onRetry={() => { setSourceError(''); setSourceBusy(true); if (coupleId && user) void loadBookSource(coupleId, user, range).then(setSource).catch(reason => setSourceError(reason instanceof Error ? reason.message : 'Could not load shared memories.')).finally(() => setSourceBusy(false)); }} /></Screen>;
  const periodOptions: [BookPeriod, string][] = [['year', 'A year'], ['since-start', 'Since the start'], ['custom', 'Custom range']];
  return <Screen><Header title="Book of Us" subtitle="A printable keepsake of your story" />
    <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }} keyboardShouldPersistTaps="handled">
      <Card style={{ gap: spacing.md }}><Text variant="title/S">Choose a period</Text><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{periodOptions.map(([id, label]) => <PressableScale key={id} accessibilityRole="radio" accessibilityState={{ checked: period === id }} onPress={() => setPeriod(id)} style={{ minHeight: geometry.touch, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: period === id ? colors.primary : colors.surfaceAlt }}><Text color={period === id ? 'primaryContrast' : 'textPrimary'}>{label}</Text></PressableScale>)}</View>
        {period === 'year' && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><PressableScale accessibilityRole="button" accessibilityLabel="Previous year" onPress={() => setYear(value => value - 1)} style={{ minWidth: geometry.touch, minHeight: geometry.touch, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={geometry.icon} color={colors.textPrimary} /></PressableScale><Text variant="title/M">{year}</Text><PressableScale accessibilityRole="button" accessibilityLabel="Next year" disabled={year >= nowYear} onPress={() => setYear(value => Math.min(nowYear, value + 1))} style={{ minWidth: geometry.touch, minHeight: geometry.touch, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-forward" size={geometry.icon} color={colors.textPrimary} /></PressableScale></View>}
        {period === 'since-start' && <Text color="textSecondary">From {couple.data?.anniversary ? new Date(`${couple.data.anniversary}T12:00:00`).toLocaleDateString() : 'the beginning of your shared space'} through today.</Text>}
        {period === 'custom' && <View style={{ flexDirection: 'row', gap: spacing.sm }}><View style={{ flex: 1 }}><Text variant="caption" color="textSecondary">From · YYYY-MM-DD</Text><TextInput value={customFrom} onChangeText={setCustomFrom} accessibilityLabel="Custom period start date" placeholder="2025-01-01" style={{ minHeight: geometry.field, borderRadius: radius.sm, borderWidth: geometry.hairline, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: typography['body/M'].fontFamily }} /></View><View style={{ flex: 1 }}><Text variant="caption" color="textSecondary">To · YYYY-MM-DD</Text><TextInput value={customTo} onChangeText={setCustomTo} accessibilityLabel="Custom period end date" placeholder="2025-12-31" style={{ minHeight: geometry.field, borderRadius: radius.sm, borderWidth: geometry.hairline, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: typography['body/M'].fontFamily }} /></View></View>}
      </Card>
      <Card style={{ gap: spacing.sm }}><Text variant="title/S">Pick your chapters</Text>{chapterChoices.map(chapter => <PressableScale key={chapter.id} accessibilityRole="checkbox" accessibilityState={{ checked: options.chapters[chapter.id] }} onPress={() => setOptions(value => ({ ...value, chapters: { ...value.chapters, [chapter.id]: !value.chapters[chapter.id] } }))} style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}><Ionicons name={options.chapters[chapter.id] ? 'checkbox' : 'square-outline'} size={geometry.icon} color={options.chapters[chapter.id] ? colors.primary : colors.textSecondary} /><View style={{ flex: 1 }}><Text variant="body/M">{chapter.title}</Text><Text variant="caption" color="textSecondary">{chapter.description}</Text></View></PressableScale>)}</Card>
      {options.chapters.messages && <Card style={{ gap: spacing.sm }}><Text variant="title/S">Choose favorite messages</Text><Text variant="caption" color="textSecondary">Pinned and most-reacted messages appear first. Choose a few for the book.</Text>{sourceBusy ? <Skeleton /> : !chosenMessages.length ? <Text color="textSecondary">No eligible text messages in this period.</Text> : chosenMessages.map(row => {
        const active = options.selectedMessages.includes(row.id);
        return <PressableScale key={row.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} accessibilityLabel={`${active ? 'Remove' : 'Add'} message from ${new Date(row.created_at).toLocaleDateString()}`} onPress={() => setOptions(value => ({ ...value, selectedMessages: active ? value.selectedMessages.filter(id => id !== row.id) : value.selectedMessages.length < 30 ? [...value.selectedMessages, row.id] : value.selectedMessages }))} style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs }}><Ionicons name={active ? 'checkbox' : 'square-outline'} size={geometry.icon} color={active ? colors.primary : colors.textSecondary} /><View style={{ flex: 1 }}><Text numberOfLines={2}>{row.enc ? '🔒 Encrypted message · opens locally when included' : row.body}</Text><Text variant="caption" color="textSecondary">{row.pinned_at ? 'Pinned' : ''}{row.pinned_at && source?.reactions[row.id] ? ' · ' : ''}{source?.reactions[row.id] ? `${source.reactions[row.id]} reactions` : ''} · {new Date(row.created_at).toLocaleDateString()}</Text></View></PressableScale>;
      })}</Card>}
      <Card style={{ gap: spacing.md }}><Text variant="title/S">Make the cover yours</Text><TextInput value={options.title} onChangeText={title => setOptions(value => ({ ...value, title }))} maxLength={80} placeholder="Book of Us" accessibilityLabel="Cover title" style={{ minHeight: geometry.field, borderRadius: radius.sm, borderWidth: geometry.hairline, borderColor: colors.border, paddingHorizontal: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: typography['body/M'].fontFamily }} /><TextInput value={options.dedication} onChangeText={dedication => setOptions(value => ({ ...value, dedication }))} maxLength={240} placeholder="Write a little dedication" accessibilityLabel="Cover dedication" multiline style={{ minHeight: geometry.field * 1.5, borderRadius: radius.sm, borderWidth: geometry.hairline, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.md, color: colors.textPrimary, backgroundColor: colors.surface, fontFamily: typography['body/M'].fontFamily, textAlignVertical: 'top' }} />
        <PressableScale accessibilityRole="switch" accessibilityState={{ checked: options.printFriendly }} onPress={() => setOptions(value => ({ ...value, printFriendly: !value.printFriendly }))} style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Ionicons name={options.printFriendly ? 'sunny' : 'color-palette-outline'} color={colors.primary} size={geometry.icon} /><Text style={{ flex: 1 }}>{options.printFriendly ? 'Light paper · print-friendly' : 'Use the active theme colors'}</Text><Text color="primary">{options.printFriendly ? 'ON' : 'OFF'}</Text></PressableScale>
        <PressableScale accessibilityRole="switch" accessibilityState={{ checked: options.lightQuality }} onPress={() => setOptions(value => ({ ...value, lightQuality: !value.lightQuality }))} style={{ minHeight: geometry.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><Ionicons name="leaf-outline" color={colors.primary} size={geometry.icon} /><Text style={{ flex: 1 }}>Lighter photo quality</Text><Text color="primary">{options.lightQuality ? 'ON' : 'OFF'}</Text></PressableScale>
      </Card>
      {!!source?.warnings.length && <Text variant="caption" color="textSecondary">A few sources could not be refreshed: {source.warnings.join(' ')}</Text>}
      {sourceBusy && <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}><ActivityIndicator color={colors.primary} /><Text color="textSecondary">Gathering your memories…</Text></View>}
      {!!source && <Text variant="caption" color="textSecondary">{photoCount} photos · {options.chapters.messages ? options.selectedMessages.length : 0} messages · estimated {estimatedSeconds}s</Text>}
      <Button title="Preview your book" disabled={!canBuild || !selectedCount} loading={sourceBusy} onPress={() => void build()} />
      <Text variant="caption" color="textSecondary">Your message text and photos stay on this phone while the book is made. Encrypted messages are decrypted locally.</Text>
    </ScrollView>
  </Screen>;
}
