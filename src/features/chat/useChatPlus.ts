import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatDb } from './plusService';
import { asSent, isMessage, type ChatMessage } from './model';
import type { ChatSettings, Reaction, ScheduledMessage } from './types';
export function useChatPlus(couple: string, uid: string, messages: ChatMessage[], active: boolean, visibleIds: string[]) {
  const client = useQueryClient();
  const ids = useMemo(() => messages.filter((message,index) => message.status === 'sent' && (index<200 || visibleIds.includes(message.id))).map(message => message.id).sort().join(','), [messages,visibleIds]);
  const key = ['chat-plus', couple, uid];
  const reactions = useQuery({ queryKey: [...key, 'reactions', ids], enabled: !!ids && active, queryFn: async () => {
    const all: Reaction[] = []; const values = ids.split(',');
    for (let index = 0; index < values.length; index += 100) {
      const result = await chatDb.from('message_reactions').select('*').eq('couple_id', couple).in('message_id', values.slice(index, index + 100));
      if (result.error) throw result.error;
      all.push(...result.data as Reaction[]);
    }
    return all;
  } });
  const settings = useQuery({ queryKey: [...key, 'settings'], enabled: active, queryFn: async () => {
    const result = await chatDb.from('chat_settings').select('*').eq('couple_id', couple).maybeSingle();
    if (result.error) throw result.error;
    return (result.data as ChatSettings | null) ?? { couple_id: couple, disappearing_seconds: 0 };
  } });
  const pins = useQuery({ queryKey: [...key, 'pins'], enabled: active, queryFn: async () => {
    const result = await chatDb.from('messages').select('*').eq('couple_id', couple).not('pinned_at', 'is', null).is('deleted_at', null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('pinned_at', { ascending: false }).limit(100);
    if (result.error) throw result.error;
    return (result.data as unknown[]).filter(isMessage).map(asSent);
  } });
  const scheduled = useQuery({ queryKey: [...key, 'scheduled'], enabled: active, queryFn: async () => {
    const result = await chatDb.from('scheduled_jobs').select('*').eq('couple_id', couple).eq('created_by', uid).eq('kind', 'scheduled_message')
      .in('status', ['pending','failed']).order('run_at').limit(100);
    if (result.error) throw result.error;
    const jobs = result.data as ScheduledMessage[];
    if (!jobs.length) return jobs;
    const sent = await chatDb.from('messages').select('client_id,created_at').eq('couple_id',couple).in('client_id',jobs.map(job=>`scheduled:${job.id}`));
    if (sent.error) throw sent.error;
    const delivered = new Map((sent.data as { client_id: string; created_at: string }[]).map(message=>[message.client_id,message.created_at]));
    return jobs.map(job=>({...job,sent_at:delivered.get(`scheduled:${job.id}`)}));
  } });
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['chat-plus', couple, uid] }), [client, couple, uid]);
  useEffect(() => {
    if (!active) return;
    const changed = () => { void refresh(); };
    const channel = chatDb.channel(`chat-plus:${couple}:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `couple_id=eq.${couple}` }, changed)
      // DELETE cannot be filtered by couple_id. Only invalidate and re-fetch
      // under RLS; never apply unscoped old payloads as trusted state.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_settings', filter: `couple_id=eq.${couple}` }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_jobs', filter: `couple_id=eq.${couple}` }, changed)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${couple}` }, () => { void client.invalidateQueries({ queryKey: ['chat-plus', couple, uid, 'pins'] }); })
      .subscribe(status => { if (status === 'SUBSCRIBED') changed(); });
    return () => { void chatDb.removeChannel(channel); };
  }, [active, couple, uid, client, refresh]);
  const reactionBusy = useRef(new Set<string>());
  useEffect(() => {
    const due = (pins.data ?? []).reduce((soonest,pin)=>pin.expires_at ? Math.min(soonest,Date.parse(pin.expires_at)) : soonest,Infinity);
    if (!Number.isFinite(due) || !active) return;
    const timer = setTimeout(() => { void refresh(); }, Math.max(0,Math.min(2_147_483_647,due-Date.now())));
    return () => clearTimeout(timer);
  }, [pins.data, active, refresh]);
  const react = useCallback(async (message: ChatMessage, emoji: string, ensure = false) => {
    if (reactionBusy.current.has(message.id) || message.status !== 'sent' || message.deleted_at) return;
    reactionBusy.current.add(message.id);
    try {
      const current = await chatDb.from('message_reactions').select('emoji').eq('couple_id', couple).eq('message_id', message.id).eq('user_id', uid).maybeSingle();
      if (current.error) throw current.error;
      if (ensure && current.data?.emoji === emoji) return;
      const result = current.data?.emoji === emoji
        ? await chatDb.from('message_reactions').delete().eq('couple_id', couple).eq('message_id', message.id).eq('user_id', uid)
        : await chatDb.from('message_reactions').upsert({ couple_id: couple, message_id: message.id, user_id: uid, emoji }, { onConflict: 'message_id,user_id' });
      if (result.error) throw result.error;
      await refresh();
    } finally { reactionBusy.current.delete(message.id); }
  }, [couple, uid, refresh]);
  const grouped = useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const reaction of reactions.data ?? []) map.set(reaction.message_id, [...(map.get(reaction.message_id) ?? []), reaction]);
    return map;
  }, [reactions.data]);
  return { reactions: grouped, settings, pins, scheduled, react, refresh, error: reactions.isError || settings.isError || pins.isError || scheduled.isError };
}
