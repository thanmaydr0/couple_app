import { useEffect, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { useTheme } from '@/theme';
import { useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { clearWidgets, initialState, readState, refreshData, writeState } from './service';
import { renderAll } from './widget-task-handler';
import { registerWidgetPush } from './background';

export function WidgetSync({ children }: PropsWithChildren) {
  const { colors } = useTheme();
  const { data: session, isLoading } = useSession();
  const { data: profile } = useProfile();
  const owner = session?.user.id;
  const couple = profile?.couple_id;
  useEffect(() => {
    if (Platform.OS !== 'android' || isLoading) return;
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = async () => {
      const old = await readState();
      if (disposed) return;
      if (!owner) { await clearWidgets(); await renderAll(initialState); return; }
      if (!couple) return;
      if (old.owner !== owner || old.couple !== couple) {
        await clearWidgets();
        await writeState({ ...initialState, owner, couple, colors });
      } else await writeState({ ...old, colors });
      if (!disposed) await renderAll(await refreshData());
    };
    const schedule = () => {
      if (timer || disposed || AppState.currentState !== 'active') return;
      timer = setTimeout(() => { timer = undefined; void sync().catch(() => {}); }, 1000);
    };
    const start = () => {
      if (!owner || !couple || channel) return;
      channel = supabase.channel(`widgets:${owner}:${couple}`);
      for (const table of ['media', 'doodles', 'pulse_status', 'countdowns']) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `couple_id=eq.${couple}` }, schedule);
      channel.subscribe();
    };
    const stop = () => { if (channel) { void supabase.removeChannel(channel); channel = undefined; } if (timer) { clearTimeout(timer); timer = undefined; } };
    void registerWidgetPush();
    if (AppState.currentState === 'active') { start(); void sync().catch(() => {}); }
    const app = AppState.addEventListener('change', value => { if (value === 'active') { start(); void sync().catch(() => {}); } else stop(); });
    // Foreground calendar rollover only; Android controls background scheduling.
    let calendarDay = new Date().toDateString();
    const daily = setInterval(() => {
      const next = new Date().toDateString();
      if (next !== calendarDay) { calendarDay = next; schedule(); }
    }, 60_000);
    return () => { disposed = true; stop(); app.remove(); clearInterval(daily); };
  }, [owner, couple, colors, isLoading]);
  return children;
}
