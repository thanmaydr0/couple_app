import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { YouTubeSync, initialSync } from './sync';
import type { Command, PlayerSnapshot, YtSession } from './types';
import { timing } from './types';
export function useTogether(session: YtSession, user: string, partner: string, command: (c: Command) => void, ended: () => void, autoStart: boolean) {
  const engine = useRef<YouTubeSync | null>(null);
  const callbacks = useRef({ command, ended }); callbacks.current = { command, ended };
  const ready = useRef(false);
  const [view, setView] = useState(initialSync);
  const [reaction, setReaction] = useState<{ emoji: string; id: number } | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!session.current_video_id) return;
    let disposed = false, subscribed = false, active = AppState.currentState === 'active', online = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const client = randomUUID();
    const sync = new YouTubeSync({ user, partner, host: session.host_id, client, videoId: session.current_video_id, autoStart,
      command: c => callbacks.current.command(c), ended: () => callbacks.current.ended(),
      change: state => { if (!disposed) setView(state); }, reaction: emoji => { if (!disposed) setReaction({ emoji, id: Date.now() }); },
      send: (event, payload) => {
        if (!channel || !subscribed || !active || !online || disposed) return;
        void channel.send({ type: 'broadcast', event, payload }).then(result => { if (!disposed && result !== 'ok') sync.connect(false); }).catch(() => { if (!disposed) sync.connect(false); });
      },
    });
    engine.current = sync;
    if (ready.current) sync.loaded();
    const presence = () => {
      if (!channel) return;
      const members = Object.values(channel.presenceState<{ user: string; active: boolean }>()).flat();
      sync.presence(active && online && members.some(m => m.user === partner && m.active));
    };
    const track = () => { if (channel && subscribed && active && online) void channel.track({ user, active: true }).then(result => { if (!disposed && result !== 'ok') sync.connect(false); }); };
    async function join() {
      const { data, error } = await supabase.auth.getSession();
      if (disposed) return;
      if (error || !data.session) { sync.failure('Sign in again before joining YouTube.'); return; }
      await supabase.realtime.setAuth(data.session.access_token);
      if (disposed) return;
      channel = supabase.channel(`yt:${session.id}`, { config: { private: true, broadcast: { self: false, ack: true }, presence: { key: client } } });
      channel.on('broadcast', { event: '*' }, ({ event, payload }) => sync.receive(event, payload));
      channel.on('presence', { event: 'sync' }, presence);
      channel.subscribe(status => {
        if (disposed) return;
        subscribed = status === 'SUBSCRIBED'; sync.connect(subscribed && active && online);
        if (subscribed) { track(); presence(); }
      });
    }
    void join().catch(() => { if (!disposed) sync.connect(false); });
    const stateListener = AppState.addEventListener('change', state => {
      const next = state === 'active';
      // Publish the final pause/leave while sends are still allowed.
      sync.foregroundState(next); active = next;
      if (!active) { if (subscribed && channel) void channel.untrack(); sync.connect(false); }
      else { sync.connect(subscribed && online); track(); presence(); }
    });
    const network = NetInfo.addEventListener(state => {
      online = state.isConnected !== false && state.isInternetReachable !== false;
      sync.connect(subscribed && active && online);
      if (online) { track(); presence(); }
    });
    const timer = setInterval(() => sync.tick(), timing.sample);
    return () => {
      sync.foregroundState(false); disposed = true; clearInterval(timer); network(); stateListener.remove(); engine.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [session.id, session.current_video_id, session.host_id, user, partner, retry]);
  return { view, reaction, engine,
    loaded: () => { ready.current = true; engine.current?.loaded(); },
    sample: (value: PlayerSnapshot) => engine.current?.sample(value),
    failure: (message: string) => { ready.current = false; engine.current?.failure(message); },
    reconnect: () => { ready.current = false; setRetry(v => v + 1); },
  };
}
