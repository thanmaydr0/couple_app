import type { FocusLog, FocusSession } from './types';
export const limits = { tickMs: 250, refreshMs: 30000, cheerMs: 3000, pushMs: 60000 };
export function phaseAt(s: FocusSession, now: number) {
    const elapsed = Math.max(0, (now - Date.parse(s.started_at)) / 1000);
    const total = s.cycles * s.work_sec + (s.cycles - 1) * s.break_sec;
    const index = Math.min(s.cycles - 1, Math.floor(elapsed / (s.work_sec + s.break_sec)));
    const within = elapsed - index * (s.work_sec + s.break_sec);
    const done = elapsed >= total || s.status !== 'active';
    const work = within < s.work_sec;
    const duration = work ? s.work_sec : s.break_sec;
    const remaining = done ? 0 : Math.max(0, duration - (work ? within : within - s.work_sec));
    return { phase: done ? 'Finished' : work ? 'Focus' : 'Rest', cycle: index + 1, remaining, progress: done ? 1 : 1 - remaining / duration, key: `${s.id}:${index}:${work}:${done}` };
}
export function utcDay(now: number) { return new Date(now).toISOString().slice(0, 10); }
export function statistics(logs: FocusLog[], userId: string | undefined, now: number) {
    const days = Array.from({ length: 7 }, (_, i) => utcDay(now - (6 - i) * 86400000));
    const totals = new Map<string, number>();
    for (const log of logs)
        if (log.minutes > 0)
            totals.set(log.day, (totals.get(log.day) ?? 0) + log.minutes);
    let streak = 0;
    let cursor = Date.parse(`${utcDay(now)}T00:00:00Z`);
    if (!totals.has(utcDay(cursor)))
        cursor -= 86400000;
    while (totals.has(utcDay(cursor))) {
        streak++;
        cursor -= 86400000;
    }
    const personal = new Map<string, number>();
    logs.filter(l => l.user_id === userId).forEach(l => personal.set(l.day, (personal.get(l.day) ?? 0) + l.minutes));
    return { days, streak, best: Math.max(0, ...personal.values()), bars: days.map(day => ({ day, you: logs.filter(l => l.day === day && l.user_id === userId).reduce((a, l) => a + l.minutes, 0), partner: logs.filter(l => l.day === day && l.user_id !== userId).reduce((a, l) => a + l.minutes, 0) })) };
}
