import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useTyping(coupleId: string, uid: string, partnerId: string | undefined, active: boolean) {
  const [typing, setTyping] = useState(false);
  const channel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ready = useRef(false);
  const lastSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const send = useCallback((value: boolean) => {
    if (channel.current && ready.current) void channel.current.send({ type: 'broadcast', event: 'typing', payload: { user_id: uid, typing: value } }).catch(() => undefined);
  }, [uid]);

  useEffect(() => {
    if (!active) return;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const current = supabase.channel(`chat-typing:${coupleId}`, { config: { private: true, broadcast: { self: false } } });
    channel.current = current;
    current.on('broadcast', { event: 'typing' }, ({ payload }: { payload: unknown }) => {
      if (!payload || typeof payload !== 'object') return;
      const value = payload as Record<string, unknown>;
      if (!partnerId || value.user_id !== partnerId || typeof value.typing !== 'boolean') return;
      clearTimeout(expiry);
      setTyping(value.typing);
      if (value.typing) expiry = setTimeout(() => setTyping(false), 4500);
    }).subscribe((status) => { ready.current = status === 'SUBSCRIBED'; });
    return () => {
      send(false);
      clearTimeout(expiry);
      clearTimeout(stopTimer.current);
      ready.current = false;
      lastSent.current = 0;
      channel.current = null;
      setTyping(false);
      void supabase.removeChannel(current);
    };
  }, [coupleId, uid, partnerId, active, send]);

  const updateTyping = useCallback((text: string) => {
    clearTimeout(stopTimer.current);
    if (!text.trim()) { send(false); lastSent.current = 0; return; }
    // Throttle active bursts; debounce the stop event so continuous typing
    // refreshes the partner's expiry without a broadcast per keystroke.
    if (Date.now() - lastSent.current > 1000) { send(true); lastSent.current = Date.now(); }
    stopTimer.current = setTimeout(() => { send(false); lastSent.current = 0; }, 1800);
  }, [send]);
  return { typing, updateTyping };
}
