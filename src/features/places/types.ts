import { z } from 'zod';
export const placeSchema = z.object({
  id: z.string().uuid(), couple_id: z.string().uuid(), name: z.string(), country_code: z.string().nullable(),
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180),
  kind: z.enum(['visited', 'wishlist', 'home', 'special']), visited_on: z.string().nullable(), notes: z.string().nullable(),
  media_ids: z.array(z.string().uuid()), created_by: z.string().uuid(), created_at: z.string(),
});
export type Place = z.infer<typeof placeSchema>;
export type PlaceInput = Pick<Place, 'name' | 'country_code' | 'lat' | 'lon' | 'kind' | 'visited_on' | 'notes' | 'media_ids'>;
export const geoSchema = z.object({ id: z.number(), name: z.string(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), country_code: z.string().optional(), country: z.string().optional(), admin1: z.string().optional() });
export type GeoResult = z.infer<typeof geoSchema>;
export type Home = { id: string; city: string; lat: number; lon: number };
export type Suggestion = { lat: number; lon: number; count: number; date: string | null };
