import { type QueryClient } from '@tanstack/react-query';
import type { Entry, Milestone, RecapCard, Summary } from './types';
import { wallTime } from './timezone';

export function longestStreak(days: { key: string; count: number }[]) {
  let best = 0; let run = 0; let previous = -Infinity; let end: string | undefined;
  for (const { key } of [...days].sort((a, b) => a.key.localeCompare(b.key))) {
    const day = Date.parse(`${key}T00:00:00Z`) / 86400000;
    run = day === previous + 1 ? run + 1 : 1;
    if (run > best) { best = run; end = key; } previous = day;
  }
  return { days: best, end };
}
export function milestones(summary: Summary, anniversary: string | null | undefined, now = new Date(), timezone = 'UTC'): Milestone[] {
  const items: Milestone[] = [];
  const add = (id: string, title: string, at: string | null | undefined, detail: string) => {
    if (at && Date.parse(at) <= now.getTime()) items.push({ id: `milestone:${id}`, kind: 'milestone', at, title, detail, path: null });
  };
  if (anniversary) {
    const start = Date.parse(`${anniversary}T00:00:00Z`);
    for (const day of [100, 200, 365, 500, 1000]) add(`day-${day}`, `${day.toLocaleString()} days of us`, wallTime(new Date(start + day * 86400000).toISOString().slice(0,10), timezone, 0).toISOString(), 'From our anniversary');
    add('hours-together', '1,000 hours of us', new Date(wallTime(anniversary,timezone,0).getTime() + 1000 * 3600000).toISOString(), '1,000 hours since our anniversary');
    const first = new Date(start);
    for (let year = first.getUTCFullYear() + 1; year <= now.getFullYear(); year++) {
      const date = new Date(Date.UTC(year, first.getUTCMonth(), first.getUTCDate()));
      if (date.getUTCMonth() !== first.getUTCMonth()) date.setUTCDate(0);
      add(`anniversary-${year}`, `${year - first.getUTCFullYear()} years together`, wallTime(date.toISOString().slice(0,10),timezone,0).toISOString(), 'Our anniversary');
    }
  }
  add('photo', 'Our first photo', summary.media?.photo_at, 'The beginning of our memory collection');
  add('message-1000', '1,000 little hellos', summary.messages?.nth_at, 'Our 1,000th message');
  add('call-100', '100 hours on calls', summary.calls?.threshold_at, 'Time spent in answered, finished calls');
  add('movie-10', 'Our 10th movie night', summary.watch_sessions?.nth_at, 'Ten finished watch sessions');
  add('chess', 'Our first chess win', summary.chess_games?.win_at, 'A little friendly competition');
  if (summary.list_items?.total) add('bucket', 'Our first bucket-list dream', summary.list_items.first_at, `${summary.list_items.total} bucket-list dreams completed so far`);
  const streak = longestStreak(summary.messages?.by_day ?? []);
  if (streak.days > 1) add('streak', `${streak.days} days of saying hello`, `${streak.end}T12:00:00Z`, 'Our longest chat streak');
  return items.sort((a, b) => Date.parse(b.at)-Date.parse(a.at));
}
// Read only the current user's in-memory React Query cache; no extra message
// downloads or persistent copies are made for emoji analysis.
export function cachedEmoji(client: QueryClient, couple: string, year: number, timezone: string) {
  const seen = new Set<string>(); const counts = new Map<string, number>(); let sampled = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    const row = value as Record<string, unknown>;
    if (row.deleted_at || typeof row.expires_at === 'string' && Date.parse(row.expires_at) <= Date.now() || typeof row.status === 'string' && row.status !== 'sent') return;
    if (row.couple_id === couple && typeof row.body === 'string' && typeof row.id === 'string' && typeof row.created_at === 'string' && !seen.has(row.id)) {
      if (new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: timezone }).format(new Date(row.created_at)) !== String(year)) return;
      seen.add(row.id); sampled++;
      const matches = row.body.match(/(?:\p{Regional_Indicator}{2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*)/gu) ?? [];
      matches.forEach(emoji => counts.set(emoji, (counts.get(emoji) ?? 0) + 1)); return;
    }
    Object.values(row).forEach(visit);
  };
  client.getQueryCache().getAll().filter(q => q.queryKey.some(k => typeof k === 'string' && /message|chat/i.test(k))).forEach(q => visit(q.state.data));
  return { emoji: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0], sampled };
}
export function recapCards(s: Summary, names: Record<string, string>, emoji: ReturnType<typeof cachedEmoji>, topMemory?: Entry): RecapCard[] {
  const cards: RecapCard[] = [];
  const add = (id: string, title: string, value: string | number, detail: string) => cards.push({ id, title, value: typeof value === 'number' ? value.toLocaleString() : value, detail });
  if (s.messages) {
    const people = [...s.messages.by_person].sort((a,b) => b.count-a.count);
    const leader = people[0];
    add('messages', 'Every little hello', s.messages.total, leader ? people[1]?.count === leader.count ? 'You both sent the same number of messages' : `${names[leader.key] ?? 'Your partner'} sent more · ${leader.count.toLocaleString()} messages` : 'Your conversation starts here');
    const hour = [...s.messages.by_hour].sort((a,b) => b.count-a.count)[0];
    cards.push({ id: 'clock', title: 'Your favorite hour', value: hour ? `${hour.key}:00` : 'A quiet year', detail: 'Messages by hour · your couple timezone', clock: s.messages.by_hour });
    add('streak', 'You kept showing up', `${longestStreak(s.messages.by_day).days} days`, 'Your longest consecutive chat streak');
  }
  const days = new Map<string, number>();
  Object.values(s).forEach(source => source.by_day.forEach(g => days.set(g.key,(days.get(g.key)??0)+g.count)));
  const active = [...days].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0];
  add('active','Your most active day',active?.[0]??'Still to come',active?`${active[1].toLocaleString()} recorded activities across your shared features`:'Your next moment is waiting');
  if (s.calls) { add('calls','A familiar voice',Math.round(s.calls.seconds/60),'Minutes in answered, finished calls'); add('longest','Just one more minute',`${Math.round(s.calls.longest/60)} min`,'Your longest finished call'); }
  if (s.watch_sessions) add('movies','Movie nights',s.watch_sessions.total,'Finished watch sessions together');
  for (const [key, title] of [['chess_games','Chess'],['scribble_matches','Scribble'],['game_rounds','Game Night']] as const) {
    if (s[key]) add(key,`${title} victories`,s[key].wins.reduce((n,g)=>n+g.count,0),s[key].wins.map(g=>`${names[g.key] ?? 'Partner'}: ${g.count}`).join(' · ') || 'No decisive wins yet');
  }
  if (s.media) add('media','A year worth keeping',s.media.total,s.media.by_kind.map(g=>`${g.count} ${g.key === 'photo' ? 'photos' : 'videos'}`).join(' · ') || 'Your next memory is waiting');
  add('emoji','Your little signature',emoji.emoji ?? '♡',emoji.sampled ? `Most-used emoji in ${emoji.sampled} cached messages` : 'Open your chats to include cached emoji');
  if (topMemory) cards.push({ id:'memory', title:'A memory to keep',value:topMemory.title,detail:'Your earliest photo memory from this year',memory:topMemory });
  return cards;
}
