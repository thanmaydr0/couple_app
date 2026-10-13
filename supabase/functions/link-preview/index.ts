import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { parseOpenGraph, safeFetch, safeUrl } from './safe-fetch.ts';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { ...cors, 'Cache-Control': 'no-store' } });

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return json({ error: 'Sign in required' }, 401);
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'Configuration unavailable' }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(8000) }) } });
  try {
    const auth = await admin.auth.getUser(token);
    if (auth.error || !auth.data.user || auth.data.user.is_anonymous) return json({ error: 'Sign in required' }, 401);
    const uid = auth.data.user.id;
    const member = await admin.from('profiles').select('couple_id').eq('id', uid).maybeSingle();
    if (member.error || !member.data?.couple_id) return json({ error: 'Couple required' }, 403);
    const cid: string = member.data.couple_id;
    const raw = await req.text(); if (raw.length > 4096) return json({ error: 'Request too large' }, 413);
    const input: { action?: string; message_id?: string; url?: string } = JSON.parse(raw);
    // This feature-owned function also handles the private one-time-photo API.
    if (input.action === 'open-once' || input.action === 'close-once') {
      if (typeof input.message_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.message_id)) return json({ error: 'Invalid photo' }, 400);
      if (input.action === 'close-once') {
        const photo = await admin.from('messages').select('media_path,viewed_at').eq('id', input.message_id).eq('couple_id', cid).neq('sender_id', uid).eq('view_once', true).maybeSingle();
        if (photo.error) throw photo.error;
        if (photo.data?.viewed_at && photo.data.media_path?.startsWith(`${cid}/chat-once/`)) {
          const removed = await admin.storage.from('chat-once').remove([photo.data.media_path]); if (removed.error) throw removed.error;
          const cleared = await admin.from('messages').update({ media_path: null }).eq('id', input.message_id).eq('couple_id', cid); if (cleared.error) throw cleared.error;
        }
        return json({ ok: true });
      }
      const claimed = await admin.rpc('chat_claim_once', { message_id: input.message_id, viewer: uid, cid });
      if (claimed.error) throw claimed.error;
      if (typeof claimed.data !== 'string' || !claimed.data.startsWith(`${cid}/chat-once/`)) return json({ error: 'Photo already opened or unavailable' }, 409);
      const signed = await admin.storage.from('chat-once').createSignedUrl(claimed.data, 60);
      if (signed.error) throw signed.error;
      return json({ url: signed.data.signedUrl });
    }
    if (typeof input.url !== 'string') return json({ error: 'URL required' }, 400);
    const target = safeUrl(input.url).href;
    const cached = await admin.from('link_previews').select('url,title,description,image,fetched_at').eq('couple_id', cid).eq('url', target).maybeSingle();
    if (cached.error) throw cached.error;
    if (cached.data && Date.parse(cached.data.fetched_at) > Date.now() - 7 * 86400000) return json(cached.data);
    const recent = await admin.from('link_previews').select('url', { count: 'exact', head: true }).eq('couple_id', cid).gte('fetched_at', new Date(Date.now() - 3600000).toISOString());
    if (recent.error || (recent.count ?? 0) >= 40) return json({ error: 'Preview rate limit; try later' }, 429);
    const signal = AbortSignal.timeout(8000);
    const page = await safeFetch(target, false, signal);
    const og = parseOpenGraph(new TextDecoder().decode(page.bytes));
    let image: string | null = null;
    if (og.image) {
      try {
        const photo = await safeFetch(new URL(og.image, page.url).href, true, signal);
        // Proxy image bytes; rendering never asks the phone to visit untrusted
        // OG hosts (or hosts which rebind to the phone's local network).
        let binary = ''; for (const byte of photo.bytes) binary += String.fromCharCode(byte);
        image = `data:${photo.type};base64,${btoa(binary)}`;
      } catch { /* A missing/unsafe image doesn't discard the text preview. */ }
    }
    const preview = { url: target, title: og.title || new URL(target).hostname, description: og.description, image };
    const saved = await admin.from('link_previews').upsert({ ...preview, couple_id: cid, fetched_at: new Date().toISOString() }, { onConflict: 'couple_id,url' });
    if (saved.error) throw saved.error;
    await admin.from('link_previews').delete().eq('couple_id', cid).lt('fetched_at', new Date(Date.now() - 7 * 86400000).toISOString());
    return json(preview);
  } catch { return json({ error: 'Preview or photo unavailable; try again' }, 400); }
}
Deno.serve(handleRequest);
