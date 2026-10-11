import { useQuery } from '@tanstack/react-query';
import type { CoupleRow, ProfileRow } from '@/types/db';
import { supabase } from './supabase';
import { useSession } from './session';
export { useSession } from './session';

export function useProfile() {
  const { data: session } = useSession();
  const uid = session?.user.id;
  return useQuery<ProfileRow | null>({
    queryKey: ['profile', uid], enabled: !!uid,
    queryFn: async ({ signal }) => {
      if (!uid) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
export function useCouple() {
  const { data: profile } = useProfile();
  const id = profile?.couple_id;
  return useQuery<CoupleRow | null>({
    queryKey: ['couple', id], enabled: !!id,
    queryFn: async ({ signal }) => {
      if (!id) return null;
      const { data, error } = await supabase.from('couples').select('*').eq('id', id).abortSignal(signal).single();
      if (error) throw error;
      return data;
    },
  });
}
export function usePartner() {
  const { data: profile } = useProfile();
  return useQuery<ProfileRow | null>({
    queryKey: ['partner', profile?.couple_id, profile?.id], enabled: !!profile?.couple_id,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      if (!profile?.couple_id) return null;
      const { data, error } = await supabase.from('profiles').select('*').eq('couple_id', profile.couple_id).neq('id', profile.id).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
export function useAvatar(path: string | null | undefined) {
  const { data: session } = useSession();
  return useQuery({
    queryKey: ['avatar', session?.user.id, path], enabled: !!path && !!session,
    staleTime: 40 * 60_000, refetchInterval: 40 * 60_000,
    queryFn: async () => {
      if (!path) return undefined;
      const { data, error } = await supabase.storage.from('media').createSignedUrl(path, 3600);
      if (error) throw error;
      return `${data.signedUrl}&v=${Date.now()}`;
    },
  });
}
