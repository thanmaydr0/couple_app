import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { featureSupabase } from '@/lib/data/feature-client';
import { mediaStore } from '@/features/media/service';
import { isMessage } from '@/features/chat/model';
import type { ChatRow, Reaction } from '@/features/chat/types';
import { projectCapsule } from '@/features/capsule/encryption';
import { summary as loadSummary } from '@/features/story/api';
import { milestones as buildMilestones } from '@/features/story/model';
import { storyTimezone } from '@/features/story/timezone';
import { wallTime } from '@/features/story/timezone';
import type { BookRange, BookSource, BookEvent, BookListItem, BookPlace } from './types';

const bookDb = supabase as unknown as SupabaseClient;
const optionalMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Some shared memories could not be loaded.';
const inRange = (value: string | null | undefined, range: BookRange, timezone: string) => {
  if (!value) return false;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
  return day >= range.from && day < range.to;
};

export async function loadBookSource(couple: string, user: string, range: BookRange): Promise<BookSource> {
  const warnings: string[] = [];
  const store = mediaStore(user, couple);
  const coupleResult = await bookDb.from('couples').select('timezone,anniversary').eq('id', couple).single();
  if (coupleResult.error) warnings.push(optionalMessage(coupleResult.error));
  const coupleRow = coupleResult.data as { timezone?: string | null; anniversary?: string | null } | null;
  const timezone = storyTimezone(coupleRow);
  const startsAt = wallTime(range.from, timezone, 0).toISOString();
  const endsAt = wallTime(range.to, timezone, 0).toISOString();
  const tasks = await Promise.allSettled([
    store.refresh(),
    bookDb.from('messages').select('*').eq('couple_id', couple).gte('created_at', startsAt).lt('created_at', endsAt)
      .is('deleted_at', null).or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false }).limit(500),
    featureSupabase.from('places').select('*').eq('couple_id', couple).order('visited_on', { ascending: false }),
    featureSupabase.from('list_items').select('id,couple_id,list_id,title,notes,done_at,hidden_from,revealed_at').eq('couple_id', couple).not('done_at', 'is', null).gte('done_at', range.from).lt('done_at', range.to),
    featureSupabase.from('lists').select('id,kind').eq('couple_id', couple),
    featureSupabase.from('events').select('id,title,starts_at,location,kind').eq('couple_id', couple).eq('status', 'confirmed').gte('starts_at', startsAt).lt('starts_at', endsAt).order('starts_at'),
    bookDb.from('capsules').select('*').eq('couple_id', couple).not('opened_at', 'is', null).gte('opened_at', startsAt).lt('opened_at', endsAt).order('opened_at'),
  ]);

  const value = <T,>(index: number): T | null => {
    const task = tasks[index];
    if (!task || task.status !== 'fulfilled') { if (task?.status === 'rejected') warnings.push(optionalMessage(task.reason)); return null; }
    const result = task.value;
    if (result && typeof result === 'object' && 'error' in result && result.error) { warnings.push(optionalMessage(result.error)); return null; }
    return (result && typeof result === 'object' && 'data' in result ? result.data : result) as T;
  };

  const rawMessages = (value<unknown[]>(1) ?? []).filter(isMessage);
  const messages = rawMessages.filter(row => row.kind === 'text' && (!row.enc ? typeof row.body === 'string' : true) && !row.deleted_at && inRange(row.created_at, range, timezone));
  const rawPlaces = value<unknown[]>(2) ?? [];
  const places = rawPlaces.filter((row): row is BookPlace => !!row && typeof row === 'object' && 'id' in row && typeof row.id === 'string' && 'name' in row && typeof row.name === 'string' && 'lat' in row && typeof row.lat === 'number' && 'lon' in row && typeof row.lon === 'number')
    .filter(place => place.kind === 'visited' || place.kind === 'home' || place.kind === 'special')
    .filter(place => place.kind === 'home' || inRange(place.visited_on ?? undefined, range, timezone));

  const rawLists = value<{ id: string; kind: string }[]>(4) ?? [];
  const bucketIds = new Set(rawLists.filter(list => list.kind === 'bucket').map(list => list.id));
  const rawWins = value<unknown[]>(3) ?? [];
  const wins = rawWins.filter((row): row is BookListItem & { list_id: string; hidden_from: string | null; revealed_at: string | null } => !!row && typeof row === 'object' && 'id' in row && typeof row.id === 'string' && 'title' in row && typeof row.title === 'string' && 'list_id' in row && typeof row.list_id === 'string' && 'done_at' in row && typeof row.done_at === 'string')
    .filter(item => bucketIds.has(item.list_id) && (!item.hidden_from || item.revealed_at))
    .map(({ id, title, done_at, notes }) => ({ id, title, done_at, notes }));

  const events = (value<BookEvent[]>(5) ?? []).filter(event => inRange(event.starts_at, range, timezone));
  const capsuleRows = (value<unknown[]>(6) ?? []).filter((row): row is import('@/features/capsule/types').Capsule => !!row && typeof row === 'object' && 'opened_at' in row && typeof row.opened_at === 'string')
    .map(projectCapsule).filter(capsule => inRange(capsule.opened_at, range, timezone));
  let stats: import('@/features/story/types').Summary | null = null;
  if (range.year || range.label === 'Since the beginning') {
    try { stats = await loadSummary(timezone, range.year); }
    catch (reason) { warnings.push(optionalMessage(reason)); }
  } else warnings.push('Wrapped counts are not available for a custom date range.');
  const milestones = stats ? buildMilestones(stats, coupleRow?.anniversary, new Date(), timezone).filter(item => inRange(item.at, range, timezone)) : [];

  let reactions: Record<string, number> = {};
  if (rawMessages.length) {
    try {
      const ids = rawMessages.map(row => row.id);
      const all: Reaction[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const { data, error } = await bookDb.from('message_reactions').select('*').eq('couple_id', couple).in('message_id', ids.slice(offset, offset + 100));
        if (error) throw error;
        all.push(...(data as Reaction[]));
      }
      reactions = all.reduce<Record<string, number>>((result, reaction) => { result[reaction.message_id] = (result[reaction.message_id] ?? 0) + 1; return result; }, {});
    } catch (reason) { warnings.push(optionalMessage(reason)); }
  }
  const photos = store.snapshot().rows.filter(row => row.kind === 'photo' && inRange(row.taken_at, range, timezone));
  if (store.snapshot().error) warnings.push(store.snapshot().error);
  return { photos, messages, reactions, places, wins, events, capsules: capsuleRows, milestones, stats, timezone, userId: user, mediaStore: store, warnings: [...new Set(warnings)] };
}

export function favoriteMessages(messages: ChatRow[], reactions: Record<string, number>) {
  return [...messages].sort((a, b) => {
    const scoreA = (a.pinned_at ? 1000 : 0) + (reactions[a.id] ?? 0);
    const scoreB = (b.pinned_at ? 1000 : 0) + (reactions[b.id] ?? 0);
    return scoreB - scoreA || b.created_at.localeCompare(a.created_at);
  });
}

export function monthLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric', timeZone: timezone }).format(new Date(iso));
}
