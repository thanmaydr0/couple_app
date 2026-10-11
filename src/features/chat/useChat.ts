import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type { MessageRow } from '@/types/db';
import { asSent, isMessage, mergeMessages, type ChatMessage } from './model';
import { cleanOutbox, history, loadCache, newer, PAGE_SIZE, persistCache, sendMessage } from './service';
import { unreadKey } from './useUnreadCount';

export function useChat(coupleId: string, uid: string, active: boolean) {
  const client = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const rows = useRef<ChatMessage[]>([]);
  const alive = useRef(true);
  const generation = useRef(0);
  const initialized = useRef(false);
  const reading = useRef(false);
  const refreshing = useRef(false);
  // Advance this only after an authoritative, sequential server fetch. A live
  // INSERT must not jump past messages missed while the socket was offline.
  const syncCursor = useRef<MessageRow | undefined>(undefined);
  const paging = useRef(false);
  const activeRef = useRef(active);
  const sending = useRef(new Set<string>());
  activeRef.current = active;

  const merge = useCallback((incoming: ChatMessage[]) => {
    if (!alive.current) return;
    rows.current = mergeMessages(rows.current, incoming);
    setMessages(rows.current);
    if (initialized.current) void persistCache(coupleId, uid, rows.current);
  }, [coupleId, uid]);

  const markRead = useCallback(async () => {
    if (!activeRef.current || reading.current || !initialized.current) return;
    const latest = rows.current.find((message) => message.status === 'sent');
    if (!latest) return;
    reading.current = true;
    try {
      const { data, error: readError } = await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .eq('couple_id', coupleId).neq('sender_id', uid).is('read_at', null)
        .lte('created_at', latest.created_at).select('*');
      if (!readError && data && alive.current) {
        // Don't inject old, unloaded rows into the middle of paginated history.
        const loaded = new Set(rows.current.map((message) => message.id));
        merge(data.filter((message) => loaded.has(message.id)).map(asSent));
        void client.invalidateQueries({ queryKey: unreadKey(coupleId, uid) });
      }
    } catch { /* Offline read writes are retried on reconnect/foreground. */ }
    finally { reading.current = false; }
  }, [coupleId, uid, client, merge]);

  const refresh = useCallback(async () => {
    if (!initialized.current || refreshing.current || !alive.current) return;
    refreshing.current = true;
    try {
      let cursor = syncCursor.current;
      // Catch up every missed INSERT, including an offline gap larger than 50.
      // Check lifecycle between pages; RLS and couple_id scope every request.
      while (cursor && alive.current) {
        const page = await newer(coupleId, cursor);
        if (!alive.current) return;
        merge(page.map(asSent));
        if (page.length) syncCursor.current = page[page.length - 1];
        if (page.length < PAGE_SIZE) break;
        cursor = page[page.length - 1];
      }
      const latest = await history(coupleId);
      if (!alive.current) return;
      merge(latest.map(asSent));
      if (!syncCursor.current) syncCursor.current = latest[0];
      if (latest.length < PAGE_SIZE) setHasOlder(false);
      // Refresh receipts and resolve sends accepted before a network timeout.
      const known = rows.current.filter((message) => message.status !== 'sent' || (message.sender_id === uid && !message.read_at));
      for (let index = 0; index < known.length && alive.current; index += 50) {
        const { data, error: receiptError } = await supabase.from('messages').select('*').eq('couple_id', coupleId)
          .in('client_id', known.slice(index, index + 50).map((message) => message.client_id));
        if (receiptError) throw receiptError;
        if (data) merge(data.map(asSent));
      }
      if (alive.current) setError(null);
      await markRead();
    } catch {
      if (alive.current) setError('Unable to sync. Your saved messages are available; tap to reconnect.');
    } finally { refreshing.current = false; }
  }, [coupleId, uid, merge, markRead]);

  useEffect(() => {
    alive.current = true;
    initialized.current = false;
    const currentGeneration = ++generation.current;
    void (async () => {
      const cached = await loadCache(coupleId, uid);
      if (!alive.current || generation.current !== currentGeneration) return;
      merge(cached);
      syncCursor.current = rows.current.filter((message) => message.status === 'sent').at(-1);
      initialized.current = true;
      // Run once during hydration, before the composer can enqueue new files.
      // Never delete files while a send is preparing them.
      await cleanOutbox(coupleId, uid, cached);
      if (!alive.current || generation.current !== currentGeneration) return;
      setReady(true);
      await refresh();
    })();
    return () => { alive.current = false; initialized.current = false; generation.current++; };
  }, [coupleId, uid, merge, refresh]);

  useEffect(() => {
    if (!ready) return;
    const accept = (value: unknown) => {
      if (isMessage(value) && value.couple_id === coupleId) {
        merge([asSent(value)]);
        void markRead();
      }
    };
    const channel = supabase.channel(`chat-messages:${coupleId}:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, (payload) => accept(payload.new))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `couple_id=eq.${coupleId}` }, (payload) => accept(payload.new))
      .subscribe((status) => {
        if (!alive.current) return;
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void refresh();
      });
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) void refresh();
    });
    return () => { unsubscribeNetwork(); void supabase.removeChannel(channel); };
  }, [coupleId, uid, ready, merge, markRead, refresh]);

  useEffect(() => {
    if (!active || !ready) return;
    void refresh();
    // Also repairs receipts if a read write failed or an UPDATE was missed.
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [active, ready, refresh]);

  const loadOlder = useCallback(async () => {
    if (paging.current || !hasOlder || !ready) return;
    paging.current = true;
    setLoadingOlder(true);
    try {
      const oldest = rows.current.filter((message) => message.status === 'sent').at(-1);
      const page = await history(coupleId, oldest);
      if (!alive.current) return;
      merge(page.map(asSent));
      setHasOlder(page.length === PAGE_SIZE);
      setError(null);
      await markRead();
    } catch {
      if (alive.current) setError('Couldn’t load older messages. Tap “Load earlier” to retry.');
    } finally { paging.current = false; if (alive.current) setLoadingOlder(false); }
  }, [coupleId, hasOlder, ready, merge, markRead]);

  const transmit = useCallback(async (message: ChatMessage) => {
    if (sending.current.has(message.client_id)) return;
    sending.current.add(message.client_id);
    merge([{ ...message, status: 'sending' }]);
    // Persist outbox before making a network request so a process death leaves
    // a retryable message with exactly the same client_id and durable photo.
    await persistCache(coupleId, uid, rows.current);
    try { merge([await sendMessage(message)]); }
    catch { merge([{ ...message, status: 'failed' }]); }
    finally { sending.current.delete(message.client_id); }
  }, [coupleId, uid, merge]);

  const send = useCallback((body: string, replyTo: string | null, image?: { uri: string; path: string }) => {
    if (!ready || (!image && !body.trim())) return;
    const id = randomUUID();
    const message: ChatMessage = {
      id, client_id: id, couple_id: coupleId, sender_id: uid,
      kind: image ? 'image' : 'text', body: body.trim() || null,
      media_path: image?.path ?? null, localUri: image?.uri,
      reply_to: replyTo, created_at: new Date().toISOString(), read_at: null, status: 'sending',
    };
    void transmit(message);
  }, [coupleId, uid, ready, transmit]);
  const retry = useCallback((message: ChatMessage) => {
    if (ready && message.status === 'failed') void transmit(message);
  }, [ready, transmit]);
  return { messages, ready, loadingOlder, hasOlder, error, live, loadOlder, refresh, send, retry };
}
