import { createContext, useContext, useEffect, type PropsWithChildren } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './supabase';

const SessionContext = createContext(false);
export function SessionProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  useEffect(() => {
    let previousUser: string | undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user.id;
      if (previousUser !== user) {
        void client.cancelQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
        client.removeQueries({ predicate: (query) => query.queryKey[0] !== 'session' });
      }
      previousUser = user;
      client.setQueryData(['session'], session);
    });
    return () => subscription.unsubscribe();
  }, [client]);
  return <SessionContext.Provider value>{children}</SessionContext.Provider>;
}
export function useSession() {
  const provided = useContext(SessionContext);
  if (!provided) throw new Error('useSession requires SessionProvider');
  return useQuery<Session | null>({
    queryKey: ['session'], staleTime: Infinity, retry: false,
    queryFn: async () => {
      if (!isSupabaseConfigured) return null;
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    },
  });
}
