import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AppState } from 'react-native';
import { Text } from '@/ui';
import { useTheme } from '@/theme';
import { PressableScale, useMotion } from '@/motion';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutUp } from 'react-native-reanimated';
import { useTogether } from './useTogether';
import { playerHtml, playerError } from './playerHtml';
import { reactions, timing, type Command, type YtSession } from './types';
import { YtButton } from './presentation';

export function Player({ session, user, partner, onEnded, onPresence, compact, autoStart }: { session: YtSession; user: string; partner: string; onEnded(): void; onPresence(value: boolean): void; compact: boolean; autoStart: boolean }) {
  const web = useRef<WebView>(null); const { colors, geometry, spacing } = useTheme(); const motion = useMotion();
  const [error, setError] = useState<string | null>(null); const [version, setVersion] = useState(0);
  const [position, setPosition] = useState(0); const [duration, setDuration] = useState(0); const [rates, setRates] = useState([1]); const [speed, setSpeed] = useState(1);
  const [visibleReaction, setVisibleReaction] = useState<{ emoji: string; id: number } | null>(null);
  const command = (c: Command) => web.current?.postMessage(JSON.stringify(c));
  const sync = useTogether(session, user, partner, command, onEnded, autoStart);
  const source = useMemo(() => ({ html: playerHtml(session.current_video_id), baseUrl: 'https://www.youtube.com' }), [session.current_video_id]);
  useEffect(() => { onPresence(sync.view.partnerHere); }, [sync.view.partnerHere, onPresence]);
  useEffect(() => {
    const tag = `yt:${session.id}`;
    let disposed = false; let foreground = AppState.currentState === 'active';
    const release = () => { void deactivateKeepAwake(tag).catch(() => {}); };
    const update = (state: string) => {
      foreground = state === 'active';
      if (foreground) void activateKeepAwakeAsync(tag).then(() => { if (disposed || !foreground) release(); }).catch(() => { if (!disposed) setError('Could not keep the screen awake.'); });
      else release();
    };
    update(AppState.currentState); const listener = AppState.addEventListener('change', update);
    return () => { disposed = true; listener.remove(); release(); };
  }, [session.id]);
  useEffect(() => {
    setVisibleReaction(sync.reaction);
    if (!sync.reaction) return;
    const timer = setTimeout(() => setVisibleReaction(null), timing.reaction);
    return () => clearTimeout(timer);
  }, [sync.reaction, motion.level]);
  useEffect(() => {
    const timer = setTimeout(() => { if (sync.engine.current?.snapshot.state === -1) { setError('YouTube did not become ready. Retry or skip this video.'); sync.failure('YouTube did not become ready. Retry or skip this video.'); } }, timing.prepare);
    return () => clearTimeout(timer);
  }, [version]);
  const fail = (message: string) => { setError(message); sync.failure(message); };
  function message(event: WebViewMessageEvent) {
    try {
      const value: unknown = JSON.parse(event.nativeEvent.data);
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (value.type === 'ready') sync.loaded();
      if (value.type === 'error' && 'code' in value && typeof value.code === 'number') fail(playerError(value.code));
      if (value.type === 'sample' && 'pos' in value && 'duration' in value && 'state' in value && 'rates' in value && typeof value.pos === 'number' && Number.isFinite(value.pos) && value.pos >= 0 && typeof value.duration === 'number' && Number.isFinite(value.duration) && typeof value.state === 'number' && Array.isArray(value.rates)) {
        const available = value.rates.filter((r: unknown): r is number => typeof r === 'number' && Number.isFinite(r) && r > 0 && r <= 2);
        sync.sample({ pos: value.pos, duration: value.duration, state: value.state, rates: available }); setPosition(value.pos); setDuration(value.duration); setRates(available);
      }
    } catch { fail('The YouTube player sent an invalid response. Retry playback.'); }
  }
  const format = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
  return <View style={{ flex: compact ? 1 : undefined, gap: spacing.sm }}>
    <View style={{ flex: compact ? 1 : undefined, aspectRatio: compact ? undefined : 16 / 9, minHeight: geometry.touch * 4.2, backgroundColor: colors.surface }}>
      <WebView key={`${session.current_video_id}:${version}`} ref={web} source={source} originWhitelist={['https://*']} javaScriptEnabled domStorageEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo={false} setSupportMultipleWindows={false} mixedContentMode="never" onMessage={message} onError={() => fail('YouTube is offline or failed to load. Retry when connected.')} onHttpError={() => fail('YouTube returned a loading error. Retry or skip this video.')} onContentProcessDidTerminate={() => fail('The player stopped. Retry playback.')} onShouldStartLoadWithRequest={request => {
        try { const url = new URL(request.url); return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname); } catch { return request.url === 'about:blank'; }
      }} style={{ flex: 1, backgroundColor: colors.surface }} />
    </View>
    {visibleReaction && <Animated.View key={visibleReaction.id} pointerEvents="none" entering={motion.level === 'full' ? SlideInDown.duration(motion.duration('base')) : FadeIn.duration(motion.duration('fast'))} exiting={motion.level === 'full' ? SlideOutUp.duration(motion.duration('slow')) : FadeOut.duration(motion.duration('fast'))} style={{ position: 'absolute', right: spacing.lg, bottom: geometry.touch * 2, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: geometry.touch }}><Text variant="display/M" accessibilityLiveRegion="polite">{visibleReaction.emoji}</Text></Animated.View>}
    <Text variant="body/S" accessibilityLiveRegion="polite">{sync.view.notice} · {format(position)} / {format(duration)}</Text>
    {error && <Text color="danger" accessibilityRole="alert">{error}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      <YtButton title="−10s" disabled={!sync.view.bothReady} onPress={() => sync.engine.current?.control('seek', position - 10)} />
      <YtButton title={sync.view.playing ? 'Pause' : 'Play together'} disabled={!!error || (!sync.view.bothReady && !sync.view.playing)} onPress={() => sync.engine.current?.control(sync.view.playing ? 'pause' : 'play')} />
      <YtButton title="+10s" disabled={!sync.view.bothReady} onPress={() => sync.engine.current?.control('seek', position + 10)} />
      <YtButton title={`${speed}×`} disabled={!sync.view.bothReady} onPress={() => { const next = rates[(rates.indexOf(speed) + 1) % rates.length] ?? 1; setSpeed(next); sync.engine.current?.control('rate', next); }} />
      <YtButton title="Skip" onPress={onEnded} />
      <YtButton title="Reconnect" onPress={() => { setError(null); setVersion(v => v + 1); sync.reconnect(); }} />
      {reactions.map(emoji => <PressableScale key={emoji} accessibilityRole="button" accessibilityLabel={`React ${emoji}`} disabled={!sync.view.partnerHere} onPress={() => sync.engine.current?.reaction(emoji)} style={{ minWidth: geometry.touch, minHeight: geometry.touch, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface, borderRadius: geometry.touch }}><Text>{emoji}</Text></PressableScale>)}
    </View>
  </View>;
}
