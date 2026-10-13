import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { featureSupabase as db } from '@/lib/data/feature-client';
import { useProfile } from '@/lib/hooks';
import { geoSchema, placeSchema, type Home, type PlaceInput } from './types';

export function usePlaces() {
  const profile = useProfile(); const couple = profile.data?.couple_id; const user = profile.data?.id;
  const client = useQueryClient(); const [active, setActive] = useState(false);
  useFocusEffect(useCallback(() => {
    setActive(AppState.currentState === 'active');
    const sub = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => { setActive(false); sub.remove(); };
  }, []));
  const query = useQuery({ queryKey: ['places', user, couple], enabled: !!couple && active,
    queryFn: async ({ signal }) => {
      const { data, error } = await db.from('places').select('*').eq('couple_id', couple!).order('created_at', { ascending: false }).abortSignal(signal);
      if (error) throw error; return z.array(placeSchema).parse(data);
    } });
  const [liveError, setLiveError] = useState(false);
  useEffect(() => {
    if (!couple || !active) return;
    const channel = supabase.channel(`places:${user}:${couple}`).on('postgres_changes', { event: '*', schema: 'public', table: 'places', filter: `couple_id=eq.${couple}` }, () => { void query.refetch(); })
      .subscribe(status => { setLiveError(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT'); if (status === 'SUBSCRIBED') void query.refetch(); });
    return () => { void supabase.removeChannel(channel); };
  }, [couple, user, active, query.refetch]);
  async function save(input: PlaceInput, id?: string) {
    if (!couple || !user) throw new Error('Sign in and link your couple first.');
    const request = id ? db.from('places').update(input).eq('id', id).eq('couple_id', couple) : db.from('places').insert({ ...input, couple_id: couple, created_by: user });
    const { data, error } = await request.select('*').single();
    if (error) throw error; placeSchema.parse(data);
    await client.invalidateQueries({ queryKey: ['places', user, couple] });
  }
  async function remove(id: string) {
    if (!couple) throw new Error('Link your couple first.');
    const { data, error } = await db.from('places').delete().eq('id', id).eq('couple_id', couple).select('id').single();
    if (error || !data) throw error ?? new Error('Place unavailable.');
    await client.invalidateQueries({ queryKey: ['places', user, couple] });
  }
  return { ...query, profile, couple, user, save, remove, liveError, active };
}
const homeSchema = z.object({ id: z.string(), city: z.string().nullable(), lat: z.number().min(-90).max(90).nullable(), lon: z.number().min(-180).max(180).nullable() });
export function useHomes(couple: string | null | undefined, enabled: boolean) {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  useEffect(() => { const sub = AppState.addEventListener('change', state => setForeground(state === 'active')); return () => sub.remove(); }, []);
  return useQuery({ queryKey: ['places-homes', couple], enabled: !!couple && enabled && foreground,
    refetchInterval: enabled && foreground ? 60_000 : false,
    queryFn: async ({ signal }): Promise<Home[]> => {
      const { data, error } = await db.from('profiles').select('id,city,lat,lon').eq('couple_id', couple!).abortSignal(signal);
      if (error) throw error;
      return z.array(homeSchema).parse(data).flatMap(p => p.lat !== null && p.lon !== null ? [{ id: p.id, city: p.city ?? 'Home', lat: p.lat, lon: p.lon }] : []);
    } });
}
export function useMeeting(couple: string | null | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['places-meeting', couple], enabled: !!couple && enabled, retry: false,
    queryFn: async ({ signal }) => {
      const { data, error } = await db.from('events').select('starts_at').eq('couple_id', couple!).eq('kind', 'meet').eq('status', 'confirmed').gte('starts_at', new Date().toISOString()).order('starts_at').limit(1).abortSignal(signal);
      // Plans is optional. A missing table is different from a transient failure.
      if (error) { if (['PGRST205', '42P01'].includes(error.code)) return null; throw error; }
      const event = z.array(z.object({ starts_at: z.string() })).parse(data)[0];
      if (event) return event.starts_at;
      const countdown = await db.from('countdowns').select('title,target_at').eq('couple_id', couple!).gte('target_at', new Date().toISOString()).order('target_at').abortSignal(signal);
      if (countdown.error) { if (['PGRST205','42P01'].includes(countdown.error.code)) return null; throw countdown.error; }
      return z.array(z.object({ title: z.string(), target_at: z.string() })).parse(countdown.data).find(c => /meet|reunion|together/i.test(c.title))?.target_at ?? null;
    } });
}
const photoSchema = z.object({ id: z.string().uuid(), thumb_path: z.string().nullable(), storage_path: z.string(), caption: z.string().nullable(), taken_at: z.string() });
export function usePhotos(couple: string | null | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['places-photos', couple], enabled: !!couple && enabled,
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.from('media').select('id,thumb_path,storage_path,caption,taken_at').eq('couple_id', couple!).eq('kind', 'photo').order('taken_at', { ascending: false }).abortSignal(signal);
      if (error) throw error; return z.array(photoSchema).parse(data);
    } });
}
export function usePhotoUrl(id: string | undefined, path: string | undefined, couple: string | null | undefined) {
  return useQuery({ queryKey: ['places-photo-url', couple, id, path], enabled: !!path && !!couple, staleTime: 40 * 60_000,
    queryFn: async () => { const { data, error } = await supabase.storage.from('media').createSignedUrl(path!, 3600); if (error) throw error; return data.signedUrl; } });
}
export async function searchPlaces(name: string, signal?: AbortSignal) {
  if (name.trim().length < 2) return [];
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=8&language=en&format=json`, { signal });
  if (!response.ok) throw new Error('Place search is unavailable. Try again.');
  return z.object({ results: z.array(geoSchema).optional() }).parse(await response.json()).results ?? [];
}
