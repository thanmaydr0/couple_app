import { z } from 'zod';
export const listSchema = z.object({ id:z.string().uuid(), couple_id:z.string().uuid(), kind:z.enum(['bucket','dates','watch','gifts','surprise','custom']), title:z.string(), emoji:z.string(), created_by:z.string().uuid(), created_at:z.string() });
export const itemSchema = z.object({ id:z.string().uuid(), list_id:z.string().uuid(), couple_id:z.string().uuid(), title:z.string(), notes:z.string().nullable(), url:z.string().nullable(), added_by:z.string().uuid(), position:z.number().int(), done_at:z.string().nullable(), done_by:z.string().uuid().nullable(), rating_a:z.number().int().nullable(), rating_b:z.number().int().nullable(), photo_path:z.string().nullable(), media_id:z.string().uuid().nullable(), revealed_at:z.string().nullable(), hidden_from:z.string().uuid().nullable(), created_at:z.string() });
export type OurList = z.infer<typeof listSchema>;
export type ListItem = z.infer<typeof itemSchema>;
export const decodeList = (row:unknown) => listSchema.parse(row);
export const decodeItem = (row:unknown) => itemSchema.parse(row);
export const claimPrefix = 'us-list-claim:';
export const moods = ['all','cheap','at home','outdoors','fancy'] as const;
export type Mood = typeof moods[number];
export function candidates(items:ListItem[], mood:Mood) { return items.filter(i=>!i.done_at && !i.url?.startsWith(claimPrefix) && (mood==='all'||i.notes?.includes(`#${mood.replaceAll(' ','-')}`))); }
