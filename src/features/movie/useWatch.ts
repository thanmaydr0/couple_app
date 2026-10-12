import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useVideoPlayer } from 'expo-video';
import { useKeepAwake } from 'expo-keep-awake';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { WatchSessionRow } from '@/types/db';
import { loadPosition, savePosition } from './local';
import type { MovieFile, EventName } from './model';
import { WatchSync, type SyncState } from './sync';

const initial: SyncState = { connected: false, partnerHere: false, bothReady: false, latency: 0, drift: 0, ended: false, notice: 'Loading your local file…' };
export function useWatch(session: WatchSessionRow, file: MovieFile, user: string, partner: string) {
  useKeepAwake(`watch:${session.id}`);
  const player = useVideoPlayer(null, p => {
    p.timeUpdateEventInterval = 0.25; p.preservesPitch = true;
    p.showNowPlayingNotification = false; p.staysActiveInBackground = false;
  });
  const engine = useRef<WatchSync | null>(null);
  const lastPosition = useRef(0);
  const [state, setState] = useState(initial);
  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [reaction, setReaction] = useState<{ emoji: string; id: number } | null>(null);

  // Expo releases the native player in its passive effect cleanup. Leave while
  // it is still alive; passive cleanup uses the cached position only.
  useLayoutEffect(() => () => { engine.current?.leave(); engine.current = null; }, [player, session.id]);

  useEffect(() => {
    let disposed = false;
    let subscribed = false;
    let loaded = false;
    let ready = false;
    let lastSaved = 0;
    let cancelPreparation = () => {};
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const sync = new WatchSync({ user, partner, host: session.host_id, client: randomUUID(), player,
      change: value => { if (!disposed) setState({ ...value }); },
      reaction: emoji => { if (!disposed) setReaction({ emoji, id: Date.now() }); },
      send: (event, payload) => {
        if (!channel || !subscribed || disposed) return;
        void channel.send({ type: 'broadcast', event, payload }).then(result => {
          if (result !== 'ok' && !disposed) { sync.connect(false); setError('Could not deliver a sync message. Reconnect before playing.'); }
        }).catch(() => { if (!disposed) { sync.connect(false); setError('Sync connection failed. Please reconnect.'); } });
      },
    });
    engine.current = sync;
    const subscriptions = [
      player.addListener('statusChange', ({ status, error: failure }) => {
        ready = status === 'readyToPlay';
        sync.setReady(loaded && ready);
        if (status === 'error') setError(failure?.message ?? 'Could not play this local video. Choose the file again.');
      }),
      player.addListener('timeUpdate', ({ currentTime }) => { lastPosition.current = currentTime; setPosition(currentTime); }),
      player.addListener('playingChange', ({ isPlaying }) => {
        setPlaying(isPlaying);
        if (!isPlaying && player.status === 'readyToPlay' && player.currentTime < player.duration - 0.5) sync.unexpectedPause();
      }),
      player.addListener('playToEnd', () => { sync.control('pause', player.duration); }),
    ];
    const appState = AppState.addEventListener('change', value => sync.setForeground(value === 'active'));
    const save = () => { void savePosition(user, session.id, lastPosition.current).catch(() => { if (!disposed) setError('Could not save your resume position on this phone.'); }); };
    const interval = setInterval(() => {
      sync.tick();
      if (Date.now() - lastSaved >= 4000) { lastSaved = Date.now(); save(); }
    }, 250);
    async function start() {
      try {
        const pos = await loadPosition(user, session.id);
        if (disposed) return;
        let cancelWait = () => {};
        const prepared = new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Video preparation timed out. Pick the file again or retry playback.')), 20000);
          const listener = player.addListener('sourceLoad', () => resolve());
          const status = player.addListener('statusChange', ({ status, error: failure }) => { if (status === 'error') reject(new Error(failure?.message ?? 'Video preparation failed.')); });
          cancelWait = () => { clearTimeout(timer); listener.remove(); status.remove(); };
          cancelPreparation = () => { cancelWait(); resolve(); };
        });
        try { await Promise.all([prepared, player.replaceAsync({ uri: file.uri })]); }
        finally { cancelWait(); }
        if (disposed) return;
        player.currentTime = Math.min(pos, Math.max(0, player.duration - 0.1));
        lastPosition.current = player.currentTime;
        loaded = true; ready = player.status === 'readyToPlay'; sync.setReady(ready);
        await supabase.realtime.setAuth();
        if (disposed) return;
        channel = supabase.channel(`watch:${session.id}`, { config: { private: true, broadcast: { self: false, ack: true } } });
        channel.on('broadcast', { event: '*' }, ({ event, payload }: { event: string; payload: unknown }) => {
          const events: EventName[] = ['play', 'pause', 'seek', 'ready', 'heartbeat', 'end', 'ping', 'pong', 'reaction', 'leave'];
          if (events.includes(event as EventName)) sync.receive(event as EventName, payload);
        }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'watch_sessions', filter: `id=eq.${session.id}` }, ({ new: row }) => {
          if (row.status === 'ended') sync.end(false);
        }).subscribe(status => {
          if (disposed) return;
          subscribed = status === 'SUBSCRIBED'; sync.connect(subscribed);
          if (subscribed) {
            setError(null);
            // Catch an end missed during a disconnect or route transition.
            void supabase.from('watch_sessions').select('status').eq('id', session.id).eq('couple_id', session.couple_id).single().then(({ data, error: failure }) => {
              if (disposed) return;
              if (failure) { sync.connect(false); setError(failure.message); }
              else if (data.status === 'ended') sync.end(false);
            });
          }
        });
      } catch (failure) { if (!disposed) setError(failure instanceof Error ? failure.message : 'Could not open the movie. Pick the file again.'); }
    }
    void start();
    return () => {
      save();
      if (engine.current === sync) { sync.leave(); engine.current = null; }
      disposed = true;
      cancelPreparation(); clearInterval(interval); appState.remove(); subscriptions.forEach(s => s.remove());
      if (channel) void supabase.removeChannel(channel);
    };
  }, [session.id, session.couple_id, session.host_id, file.uri, user, partner, player, retry]);

  async function end() {
    const { error: failure } = await supabase.from('watch_sessions').update({ status: 'ended' }).eq('id', session.id).eq('couple_id', session.couple_id);
    if (failure) { setError(failure.message); return; }
    engine.current?.end();
  }
  return { player, state, position, playing, error, reaction, end,
    control: (event: 'play' | 'pause' | 'seek', pos?: number) => engine.current?.control(event, pos),
    react: (emoji: string) => engine.current?.reaction(emoji),
    reconnect: () => { setError(null); setRetry(value => value + 1); },
  };
}
