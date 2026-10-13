import { z } from 'zod';
export const pointSchema = z.object({
  user_id: z.string().uuid(), couple_id: z.string().uuid(), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable(), speed: z.number().nonnegative().nullable(), heading: z.number().nullable(),
  battery_pct: z.number().int().min(0).max(100).nullable(), charging: z.boolean().nullable(), updated_at: z.string(), sharing_until: z.string(),
});
export type LocationPoint = z.infer<typeof pointSchema>;
export const journeySchema = z.object({
  id: z.string().uuid(), couple_id: z.string().uuid(), user_id: z.string().uuid(), dest_name: z.string(), dest_lat: z.number(), dest_lon: z.number(),
  started_at: z.string(), arrived_at: z.string().nullable(), status: z.enum(['active', 'arrived', 'cancelled']),
});
export type Journey = z.infer<typeof journeySchema>;
export const placeSchema = z.object({
  id: z.string().uuid(), couple_id: z.string().uuid(), user_id: z.string().uuid(), name: z.string(), lat: z.number(), lon: z.number(), radius_m: z.number(), notify_partner: z.boolean(),
});
export type SavedPlace = z.infer<typeof placeSchema>;
export type Destination = { name: string; lat: number; lon: number };
export type ShareMode = 'hour' | 'eight' | 'until-stop';
export type Lease = { uid: string; coupleId: string; until: string; id: string };
