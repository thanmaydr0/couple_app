export type EventKind = 'date' | 'meet' | 'anniversary' | 'birthday' | 'reminder' | 'custom';
export type Repeat = 'none' | 'weekly' | 'monthly' | 'yearly';
export type PlanEvent = { id: string; couple_id: string; title: string; starts_at: string; ends_at: string; all_day: boolean; location: string | null; notes: string | null; kind: EventKind; status: 'confirmed' | 'proposed' | 'declined'; proposed_by: string | null; repeat: Repeat; remind_minutes: number[]; created_by: string; created_at: string };
export type Occurrence = PlanEvent & { occurrence: string; readonly?: boolean };
export type Countdown = { id: string; couple_id: string; title: string; target_at: string; emoji: string; pinned: boolean; created_by: string };
export type Availability = { user_id: string; couple_id: string; weekday: number; start_minute: number; end_minute: number; tz: string };
export type Person = { id: string; display_name: string | null; timezone?: string | null; birthday?: string | null };
export type Window = { start: number; end: number };
