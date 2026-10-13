import { useEffect, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useProfile, useSession } from '@/lib/hooks';
import { supabase } from '@/lib/supabase';
import { clearCrypto, refreshCrypto, startCrypto } from './runtime';
import { clearFiles, purgeDecryptedFiles } from './files';
import { useQueryClient } from '@tanstack/react-query';
export function CryptoProvider({ children }: PropsWithChildren) {
  const queries = useQueryClient();
  const { data: session } = useSession(); const profile = useProfile();
  const user = session?.user.id; const couple = profile.data?.couple_id;
  useEffect(() => {
    if (!user || !couple) { clearCrypto(); return; }
    startCrypto(user, couple);
    const refresh = () => { if (AppState.currentState === 'active') void refreshCrypto().catch(() => {}); };
    refresh();
    void purgeDecryptedFiles();
    const app = AppState.addEventListener('change', next => {
      if (next !== 'active') {
        void purgeDecryptedFiles();
        queries.removeQueries({ predicate: query => ['chat-image', 'chat-reply', 'chat-link', 'chat-plus'].includes(String(query.queryKey[0])) });
      } else refresh();
    });
    const channel = supabase.channel(`e2ee:${couple}:${user}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_keys', filter: `couple_id=eq.${couple}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'couples', filter: `id=eq.${couple}` }, refresh).subscribe();
    return () => { app.remove(); void supabase.removeChannel(channel); clearFiles(); void purgeDecryptedFiles(); clearCrypto(); };
  }, [user, couple]);
  return children;
}
