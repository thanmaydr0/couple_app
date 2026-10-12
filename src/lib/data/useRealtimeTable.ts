import { useEffect, useId, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNetInfo } from '@react-native-community/netinfo';
import { useProfile, useSession } from '../hooks';
import { featureSupabase } from './feature-client';

export type CoupleRecord = { id: string; couple_id: string };
/** decode must validate rows (e.g. feature-owned Zod schema). Use stable UUIDs
 * for optimistic inserts; a failed request is reconciled against the server.
 * List is bounded; pass a feature-specific order and limit as needed. */
export function useRealtimeTable<T extends CoupleRecord>({ table, decode, orderBy = 'created_at', limit = 200 }: {
  table: string; decode: (row: unknown) => T; orderBy?: string; limit?: number;
}) {
  const { data: profile } = useProfile(); const { data: session } = useSession();
  const uid = session?.user.id; const coupleId = profile?.id === uid ? profile?.couple_id : null;
  const subscriptionId = useId();
  const client = useQueryClient(); const network = useNetInfo();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [realtime, setRealtime] = useState('CLOSED');
  const queryKey = ['couple-table', table, coupleId, uid, orderBy, limit] as const;
  const offline = network.isConnected === false || network.isInternetReachable === false;
  useEffect(() => { const listener = AppState.addEventListener('change', state => setActive(state === 'active')); return () => listener.remove(); }, []);
  const query = useQuery({ queryKey, enabled: !!coupleId && !!uid && active,
    queryFn: async ({ signal }) => {
      if (!coupleId || !uid) throw new Error('Couple membership required');
      const { data, error } = await featureSupabase.from(table).select('*').eq('couple_id', coupleId).order(orderBy, { ascending: false }).limit(limit).abortSignal(signal);
      if (error) throw error;
      return (data ?? []).map(decode);
    },
  });
  useEffect(() => {
    if (!coupleId || !uid || !active || offline) { setRealtime('CLOSED'); return; }
    const key = ['couple-table', table, coupleId, uid, orderBy, limit];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => { if (!timer) timer = setTimeout(() => { timer = undefined; void client.invalidateQueries({ queryKey: key }); }, 250); };
    const channel = featureSupabase.channel(`table:${table}:${coupleId}:${uid}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter: `couple_id=eq.${coupleId}` }, invalidate)
      // DELETE filters are not supported by Postgres Changes. Invalidate only;
      // never consume old row data; the RLS-scoped query supplies visible rows.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, invalidate)
      .subscribe(status => { setRealtime(status); if (status === 'SUBSCRIBED') invalidate(); });
    return () => { if (timer) clearTimeout(timer); void featureSupabase.removeChannel(channel); };
  }, [table, coupleId, uid, active, offline, client, orderBy, limit, subscriptionId]);
  const mutation = useMutation({
    mutationKey: queryKey,
    scope: { id: `couple-table:${table}:${coupleId}:${uid}` },
    mutationFn: async (operation: { kind: 'insert'; row: T } | { kind: 'update'; id: string; changes: Partial<Omit<T, 'id' | 'couple_id'>> }) => {
      if (!coupleId || !uid) throw new Error('Couple membership required');
      const current = await featureSupabase.auth.getSession();
      if (current.data.session?.user.id !== uid) throw new Error('Your account changed. Reopen this feature.');
      const values: Record<string, unknown> = operation.kind === 'insert' ? { ...operation.row, couple_id: coupleId } : { ...operation.changes, couple_id: coupleId };
      if (operation.kind === 'update') { delete values.id; delete values.couple_id; }
      const request = operation.kind === 'insert'
        ? featureSupabase.from(table).insert(values)
        : featureSupabase.from(table).update(values).eq('id', operation.id).eq('couple_id', coupleId);
      const { data, error } = await request.select('*').single();
      if (error) throw error;
      return decode(data);
    },
    onMutate: async operation => {
      await client.cancelQueries({ queryKey });
      // Serialize mutation transport and reconcile on settlement; rollback only
      // the affected row so concurrent optimistic edits to other rows survive.
      const previous = client.getQueryData<T[]>(queryKey)?.find(row => row.id === (operation.kind === 'insert' ? operation.row.id : operation.id));
      if (coupleId) client.setQueryData<T[]>(queryKey, rows => operation.kind === 'insert'
        ? [{ ...operation.row, couple_id: coupleId }, ...(rows ?? []).filter(row => row.id !== operation.row.id)].slice(0, limit)
        : rows?.map(row => row.id === operation.id ? { ...row, ...operation.changes, id: row.id, couple_id: row.couple_id } : row));
      return { previous };
    },
    onError: (_error, operation, context) => { const id = operation.kind === 'insert' ? operation.row.id : operation.id; client.setQueryData<T[]>(queryKey, rows => { const others = (rows ?? []).filter(row => row.id !== id); return context?.previous ? [context.previous, ...others] : others; }); },
    onSettled: () => { if (client.isMutating({ mutationKey: queryKey, exact: true }) === 1) void client.invalidateQueries({ queryKey }); },
  });
  return { ...query, offline, realtime, mutation,
    insert: (row: T) => mutation.mutateAsync({ kind: 'insert', row }),
    update: (id: string, changes: Partial<Omit<T, 'id' | 'couple_id'>>) => mutation.mutateAsync({ kind: 'update', id, changes }),
  };
}
