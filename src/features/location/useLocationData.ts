import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useProfile } from '@/lib/hooks';
import { featureSupabase as db } from '@/lib/data/feature-client';
import { pointSchema, journeySchema, placeSchema } from './types';

export function useLocationData() {
  const { data: profile } = useProfile();
  const coupleId = profile?.couple_id;
  const uid = profile?.id;
  const client = useQueryClient();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [focused, setFocused] = useState(false);
  const [offline, setOffline] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const app = AppState.addEventListener('change', state => setActive(state === 'active'));
    const network = NetInfo.addEventListener(state => setOffline(state.isConnected === false || state.isInternetReachable === false));
    return () => { app.remove(); network(); };
  }, []);
  const key = ['location', uid, coupleId];
  const query = useQuery({
    queryKey: key, enabled: !!uid && !!coupleId && active && focused && !offline,
    gcTime: 0, staleTime: 0, refetchInterval: active && focused ? 10_000 : false,
    queryFn: async ({ signal }) => {
      if (!uid || !coupleId) return { points: [], journeys: [], places: [] };
      const [points, journeys, places] = await Promise.all([
        db.from('locations').select('*').eq('couple_id', coupleId).abortSignal(signal),
        db.from('journeys').select('*').eq('couple_id', coupleId).abortSignal(signal),
        db.from('saved_places').select('*').eq('couple_id', coupleId).eq('user_id', uid).order('name').abortSignal(signal),
      ]);
      if (points.error || journeys.error || places.error) throw new Error('Location data could not load. Check your connection or database setup.');
      return { points: pointSchema.array().parse(points.data ?? []), journeys: journeySchema.array().parse(journeys.data ?? []), places: placeSchema.array().parse(places.data ?? []) };
    },
  });
  useEffect(() => {
    if (!uid || !coupleId || !active || !focused || offline) return;
    const channel = db.channel(`location-view:${coupleId}:${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'locations', filter: `couple_id=eq.${coupleId}` }, () => { void client.invalidateQueries({ queryKey: ['location', uid, coupleId] }); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journeys', filter: `couple_id=eq.${coupleId}` }, () => { void client.invalidateQueries({ queryKey: ['location', uid, coupleId] }); })
      .subscribe();
    return () => { void db.removeChannel(channel); };
  }, [uid, coupleId, active, focused, offline, client]);
  return { ...query, offline, uid, coupleId, visible: active && focused, refresh: () => client.invalidateQueries({ queryKey: key }) };
}
