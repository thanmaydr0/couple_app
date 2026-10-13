import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Canvas, Path, Skia, Image as SkiaImage, useCanvasRef, useImage, ImageFormat, type SkPath } from '@shopify/react-native-skia';
import { useLocalSearchParams, useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '@/theme';
import { PressableScale } from '@/motion';
import { Card, Header, Screen, Text } from '@/ui';
import { supabase } from '@/lib/supabase';
import { Viewer } from '@/features/media/Viewer';
import { mediaStore } from '@/features/media/service';
import type { MediaRow } from '@/types/db';
import { clearWidgets, identity, initialState, readState, refreshData, sendDoodle, writeState } from './service';
import { renderAll } from './widget-task-handler';
import type { PhotoMode, WidgetState } from './types';

type Stroke = { path: SkPath; color: string };
function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  return <PressableScale accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ padding: spacing.s12, borderRadius: radius.sm, backgroundColor: colors.surfaceAlt, justifyContent: 'center' }}><Text style={{ textAlign: 'center' }}>{title}</Text></PressableScale>;
}
export default function WidgetsScreen() {
  const theme = useTheme();
  const { colors, spacing, radius, geometry } = theme;
  const router = useRouter();
  const params = useLocalSearchParams<{ reply?: string; photo?: string }>();
  const [state, setState] = useState<WidgetState>(initialState);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState('');
  const [rows, setRows] = useState<MediaRow[]>([]);
  const [viewer, setViewer] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [ink, setInk] = useState(colors.primary);
  const canvas = useCanvasRef();
  const [canvasWidth, setCanvasWidth] = useState(geometry.touch * 6);
  const [reply, setReply] = useState(false);
  const replyImage = useImage(reply ? state.doodleFile : undefined);
  const [revision, setRevision] = useState(0);
  const canvasHeight = geometry.touch * 3;
  useEffect(() => {
    let alive = true;
    const network = NetInfo.addEventListener(info => { if (alive) setOffline(info.isConnected === false || info.isInternetReachable === false); });
    void (async () => {
      try {
        const who = await identity();
        const saved = await readState();
        const value = saved.owner === who.owner && saved.couple === who.couple ? saved : { ...initialState, ...who, colors };
        if (alive) { setState(value); setReply(params.reply === '1'); }
        const photos: MediaRow[] = [];
        for (let offset = 0; ; offset += 500) {
          const result = await supabase.from('media').select('*').eq('couple_id', who.couple).eq('kind', 'photo').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
          if (result.error) throw result.error;
          photos.push(...result.data);
          if (result.data.length < 500) break;
        }
        if (alive) { setRows(photos); setViewer(Boolean(params.photo && photos.some(row => row.id === params.photo))); }
      } catch { if (alive) setNotice('Could not load widgets. Check your connection and sign-in, then retry.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; network(); };
  }, [params.photo, params.reply, colors]);
  const run = async (work: () => Promise<void>) => {
    setBusy(true); setNotice('');
    try { await work(); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not complete this action. Try again online.'); }
    finally { setBusy(false); }
  };
  const save = async (patch: Partial<WidgetState>) => {
    const who = await identity();
    const value = { ...await readState(), ...who, ...patch, colors };
    await writeState(value);
    const next = await refreshData();
    setState(next); await renderAll(next);
  };
  const refresh = () => void run(async () => { await save({}); });
  const cards = [
    { title: 'Us · 4 × 2', icon: '♡', detail: 'Days together, partner status and your next countdown. Tap to open Home.' },
    { title: 'Photo · 2 × 2', icon: '▧', detail: 'A small cached Memory. Tap to open the Memories viewer.' },
    { title: 'Love Doodle · 4 × 2', icon: '〰', detail: 'The latest drawing from your partner. Tap to draw a reply.' },
    { title: 'Heartbeat · 1 × 1', icon: '♥', detail: 'Tap to send a heartbeat without opening Us. One every 10 seconds.' },
  ];
  return <Screen><Header title="Widgets" subtitle="A little closer, on your Home screen" onBack={() => router.back()} /><ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
    {offline && <Text accessibilityLiveRegion="polite">Offline · saved widget content may be out of date.</Text>}
    {loading && <ActivityIndicator color={colors.primary} accessibilityLabel="Loading widgets" />}
    <Card><Text variant="title/M">Your Home screen, your choice</Text><Text>Personal photos and doodles can be visible to anyone holding your phone. Widgets start off.</Text><Action disabled={busy || loading} title={state.enabled ? 'Widgets ON · turn off and clear content' : 'Enable personal widget content'} onPress={() => void run(async () => {
      if (state.enabled) { await clearWidgets(); const next = { ...initialState, colors }; setState(next); await renderAll(next); }
      else await save({ enabled: true });
    })} /></Card>
    <Text>Long-press an empty area on your Android Home screen → Widgets → Us. Hold a widget, drag it into place, and release. Available sizes depend on your launcher.</Text>
    {cards.map(card => <Card key={card.title} style={{ gap: spacing.sm }}><View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}><View accessibilityElementsHidden style={{ minWidth: geometry.touch, minHeight: geometry.touch, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceAlt, justifyContent: 'center', alignItems: 'center' }}><Text variant="display/M" color="primary">{card.icon}</Text></View><Text variant="title/S">{card.title}</Text></View><Text color="textSecondary">{card.detail}</Text></Card>)}
    <Card style={{ gap: spacing.sm }}><Text variant="title/M">Photo mode</Text>{(['latest', 'random', 'favorites'] as PhotoMode[]).map(mode => <Action key={mode} disabled={busy || loading} title={`${state.mode === mode ? '✓ ' : ''}${mode === 'random' ? 'Daily random' : mode === 'latest' ? 'Latest upload' : 'Daily favorite'}`} onPress={() => void run(() => save({ mode }))} />)}
      <Text variant="body/S">Widget favorites are saved on this phone. Select up to 50 photos below.</Text>
      {!rows.length && !loading && <Text color="textSecondary">No photos yet. Add a photo in Memories to start.</Text>}
      {rows.slice(0, 50).map(row => <Action key={row.id} disabled={busy} title={`${state.favorites.includes(row.id) ? '♥ ' : '♡ '}${row.caption ?? new Date(row.taken_at).toLocaleDateString()}`} onPress={() => void run(() => save({ favorites: state.favorites.includes(row.id) ? state.favorites.filter(id => id !== row.id) : [...state.favorites, row.id] }))} />)}
    </Card>
    <Card style={{ gap: spacing.sm }}><Text variant="title/M">Love Doodle</Text><Text color="textSecondary">Draw with one finger. {reply && state.doodleFile ? 'Your partner’s doodle is the reply background.' : 'Send a little love to your partner’s widget.'}</Text>
      <View onLayout={event => setCanvasWidth(event.nativeEvent.layout.width)} style={{ height: canvasHeight, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}
        onStartShouldSetResponder={() => !busy} onMoveShouldSetResponder={() => !busy}
        onResponderGrant={event => { const path = Skia.Path.Make(); const { locationX: x, locationY: y } = event.nativeEvent; path.moveTo(x, y); path.lineTo(x + geometry.hairline, y); current.current = { path, color: ink }; setRevision(value => value + 1); }}
        onResponderMove={event => { current.current?.path.lineTo(event.nativeEvent.locationX, event.nativeEvent.locationY); setRevision(value => value + 1); }}
        onResponderRelease={() => { if (current.current) { const stroke = current.current; setStrokes(value => [...value, stroke]); current.current = null; setRevision(value => value + 1); } }}
        onResponderTerminate={() => { current.current = null; setRevision(value => value + 1); }}>
        <Canvas ref={canvas} pointerEvents="none" style={{ flex: 1 }} key={`canvas-${reply}`}><Path path={Skia.Path.Make().addRect({ x: 0, y: 0, width: canvasWidth, height: canvasHeight })} color={colors.surfaceAlt} />{replyImage && <SkiaImage image={replyImage} x={0} y={0} width={canvasWidth} height={canvasHeight} fit="contain" />}{strokes.map((stroke, index) => <Path key={index} path={stroke.path} color={stroke.color} style="stroke" strokeWidth={geometry.stroke * 2} strokeCap="round" strokeJoin="round" />)}{current.current && <Path key={`live-${revision}`} path={current.current.path} color={current.current.color} style="stroke" strokeWidth={geometry.stroke * 2} strokeCap="round" strokeJoin="round" />}</Canvas>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{[colors.primary, colors.textPrimary, colors.danger, colors.success].map((color, index) => <PressableScale key={index} accessibilityRole="radio" accessibilityLabel={['Theme accent brush', 'Ink brush', 'Red brush', 'Green brush'][index]} accessibilityState={{ checked: ink === color }} onPress={() => setInk(color)} style={{ backgroundColor: color, borderRadius: radius.pill, borderWidth: ink === color ? geometry.stroke : 0, borderColor: colors.textPrimary }} />)}</View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}><Action title="Undo" disabled={busy || !strokes.length} onPress={() => setStrokes(value => value.slice(0, -1))} /><Action title="Clear" disabled={busy} onPress={() => { setStrokes([]); setReply(false); current.current = null; }} /></View>
      <Action title={busy ? 'Working…' : 'Send to partner’s widget'} disabled={busy || offline || !state.enabled || !strokes.length} onPress={() => void run(async () => { const image = await canvas.current?.makeImageSnapshotAsync(); if (!image) throw new Error('Canvas is not ready. Try again.'); try { setNotice(await sendDoodle(image.encodeToBase64(ImageFormat.PNG))); } finally { image.dispose(); } })} />
    </Card>
    <Card style={{ gap: spacing.sm }}><Text variant="title/M">Widget health</Text><Text>{state.updatedAt ? `Last data refresh: ${new Date(state.updatedAt).toLocaleString()}` : 'No successful refresh yet.'}</Text><Text color="textSecondary">{state.error ?? 'No saved refresh error. This does not confirm push delivery or launcher rendering.'}</Text><Text color="textSecondary">Background periodic updates are disabled in this build. App-open and foreground changes refresh widgets; push refresh is best effort and Android may delay it.</Text><Action title={busy ? 'Refreshing…' : 'Refresh now / retry'} disabled={busy || loading || offline} onPress={refresh} /></Card>
    {!!notice && <Text accessibilityLiveRegion="polite">{notice}</Text>}
  </ScrollView>{viewer && state.owner && state.couple && <Viewer rows={rows} initial={Math.max(0, rows.findIndex(row => row.id === params.photo))} store={mediaStore(state.owner, state.couple)} close={() => setViewer(false)} />}</Screen>;
}
