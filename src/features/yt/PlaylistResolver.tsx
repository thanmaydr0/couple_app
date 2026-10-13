import { useEffect, useMemo, useRef } from 'react';
import WebView from 'react-native-webview';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from '@/ui';
import { playerHtml, playerError } from './playerHtml';
import { validVideoId } from './links';
import { timing } from './types';
import { YtButton } from './presentation';
export function PlaylistResolver({ id, onResolve, onError, onCancel }: { id: string; onResolve(ids: string[]): void; onError(message: string): void; onCancel(): void }) {
  const { geometry } = useTheme(); const done = useRef(false); const callbacks = useRef({ onResolve, onError }); callbacks.current = { onResolve, onError };
  const source = useMemo(() => ({ html: playerHtml(null, id), baseUrl: 'https://www.youtube.com' }), [id]);
  useEffect(() => { const timer = setTimeout(() => { if (!done.current) { done.current = true; callbacks.current.onError('This playlist could not be opened. It may be private or unavailable. Try a video link.'); } }, timing.prepare); return () => clearTimeout(timer); }, [id]);
  return <View><Text>Reading public playlist… Up to 50 videos. Unavailable previews are skipped.</Text><WebView source={source} originWhitelist={['https://*']} javaScriptEnabled mediaPlaybackRequiresUserAction allowsInlineMediaPlayback setSupportMultipleWindows={false} style={{ height: geometry.touch * 4.2 }} onError={() => { if (!done.current) { done.current = true; onError('Could not open this playlist. Check your connection.'); } }} onMessage={event => {
    if (done.current) return;
    try {
      const value: unknown = JSON.parse(event.nativeEvent.data);
      if (!value || typeof value !== 'object' || !('type' in value)) return;
      if (value.type === 'playlist' && 'ids' in value && Array.isArray(value.ids)) { const ids = [...new Set(value.ids.filter(validVideoId))].slice(0, 50); if (ids.length) { done.current = true; onResolve(ids); } }
      if (value.type === 'error' && 'code' in value && typeof value.code === 'number') { done.current = true; onError(playerError(value.code)); }
    } catch { done.current = true; onError('YouTube returned an invalid playlist.'); }
  }} /><YtButton title="Cancel playlist" onPress={onCancel} /></View>;
}
