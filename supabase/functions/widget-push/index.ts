import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const authorization = req.headers.get('Authorization');
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json({ error: 'Sign in required' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json({ error: 'Server configuration missing' }, 500);
  try {
    const caller = createClient(url, anon, { global: { headers: { Authorization: authorization! } }, auth: { persistSession: false, autoRefreshToken: false } });
    const user = await caller.auth.getUser(token);
    if (user.error || !user.data.user || user.data.user.is_anonymous) return json({ error: 'Invalid session' }, 401);
    const raw = await req.text();
    if (raw.length > 256) return json({ error: 'Payload too large' }, 413);
    let doodleId: unknown;
    try { doodleId = (JSON.parse(raw) as { doodleId?: unknown }).doodleId; } catch { return json({ error: 'Invalid JSON' }, 400); }
    if (typeof doodleId !== 'string' || !/^[0-9a-f-]{36}$/i.test(doodleId)) return json({ error: 'Doodle ID required' }, 400);
    const { data: doodle, error } = await caller.from('doodles').select('id,couple_id,author_id,created_at').eq('id', doodleId).single();
    if (error || !doodle || doodle.author_id !== user.data.user.id) return json({ error: 'Doodle not available' }, 403);
    if (Date.now() - new Date(doodle.created_at).getTime() > 5 * 60_000) return json({ error: 'Doodle push expired' }, 409);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const claim = await admin.rpc('claim_widget_push', { target: doodle.id });
    if (claim.error) return json({ error: 'Push limiter unavailable' }, 503);
    if (!claim.data) return json({ error: 'Doodle push already claimed or rate limited' }, 429);
    // Shared notifier resolves partner/token from the verified caller. No target IDs or image URLs accepted.
    const result = await caller.functions.invoke('notify-partner', { body: { channel: 'pulse', title: 'Love Doodle', body: 'A doodle from your partner', priority: 'high', dataOnly: true, data: { route: '/us/widgets', widgetRefresh: true, doodleId: doodle.id } } });
    if (result.error) {
      await admin.from('widget_push_claims').delete().eq('doodle_id', doodle.id);
      return json({ error: 'Push dispatch failed; doodle remains saved' }, 502);
    }
    return json({ ok: true });
  } catch { return json({ error: 'Widget push unavailable' }, 503); }
}
Deno.serve(handleRequest);
