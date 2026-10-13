import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import type { Privacy } from './types';

type PrivacyDatabase = { public: {
  Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }>;
  Views: Record<never, never>;
  Functions: { set_applock_privacy: { Args: { setting: keyof Privacy; enabled: boolean }; Returns: unknown } };
} };
const client = supabase as unknown as SupabaseClient<PrivacyDatabase>;
const schema = z.object({ hide_message_previews: z.boolean().catch(false).default(false), block_screenshots: z.boolean().catch(false).default(false) });
const parse = (value: unknown): Privacy => schema.parse(value ?? {});
export function usePrivacy() {
  const { data: session } = useSession(); const uid = session?.user.id; const queryClient = useQueryClient();
  const key = ['applock-privacy', uid]; const cacheKey = `us.privacy.v1.${uid}`;
  const query = useQuery({ queryKey: key, enabled: !!uid, retry: false, queryFn: async () => {
    const { data, error } = await client.from('profiles').select('privacy').eq('id', uid!).single();
    if (error) {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return { privacy: parse(JSON.parse(cached) as unknown), offline: true };
      throw error;
    }
    const privacy = parse(data.privacy);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(privacy)).catch(() => {});
    return { privacy, offline: false };
  } });
  const save = useMutation({ mutationFn: async ({ setting, enabled }: { setting: keyof Privacy; enabled: boolean }) => {
    if (!uid) throw new Error('Sign in to change privacy settings.');
    const { data, error } = await client.rpc('set_applock_privacy', { setting, enabled });
    if (error) throw error;
    const privacy = parse(data);
    await AsyncStorage.setItem(cacheKey, JSON.stringify(privacy)).catch(() => {});
    queryClient.setQueryData(key, { privacy, offline: false });
    void queryClient.invalidateQueries({ queryKey: ['profile', uid] });
  } });
  return { ...query, save };
}
