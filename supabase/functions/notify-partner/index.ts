import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { ...cors, "Cache-Control": "no-store" } });
const ok = () => json({ ok: true });

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const match = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return json({ error: "A user access token is required" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "Server configuration missing" }, 500);

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await client.auth.getUser(match[1]);
    if (authError || !auth.user || auth.user.is_anonymous) return json({ error: "Invalid user access token" }, 401);

    let payload;
    try {
      // Expo limits the whole notification to 4096 bytes; leave room for routing.
      const raw = await req.text();
      if (new TextEncoder().encode(raw).length > 3000) return json({ error: "Payload too large" }, 413);
      payload = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!payload || !["message", "call"].includes(payload.type) ||
      typeof payload.title !== "string" || typeof payload.body !== "string" ||
      !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)) {
      return json({ error: "Expected {type: 'message'|'call', title, body, data: object}" }, 400);
    }

    // A separate admin client never inherits the caller's Authorization header.
    // Every privileged query is scoped using the VERIFIED caller's membership.
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: caller, error: callerError } = await admin.from("profiles")
      .select("couple_id").eq("id", auth.user.id).maybeSingle();
    if (callerError) return json({ error: "Membership lookup failed" }, 500);
    if (!caller?.couple_id) return json({ error: "Couple membership required" }, 403);
    const { data: partners, error: partnerError } = await admin.from("profiles")
      .select("id").eq("couple_id", caller.couple_id).neq("id", auth.user.id).limit(2);
    if (partnerError) return json({ error: "Partner lookup failed" }, 500);
    if (!partners?.length) return ok();
    if (partners.length !== 1) return json({ error: "Invalid couple configuration" }, 409);
    const { data: push, error: pushError } = await admin.from("push_tokens")
      .select("token").eq("user_id", partners[0].id).maybeSingle();
    if (pushError) return json({ error: "Notification lookup failed" }, 500);
    // The response is identical whether a token exists or not. Never return it.
    if (!push?.token || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(push.token)) return ok();
    const expoHeaders: Record<string, string> = { "Content-Type": "application/json", "Accept": "application/json" };
    // Optional if enhanced push security is enabled in Expo.
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");
    if (expoAccessToken) expoHeaders.Authorization = `Bearer ${expoAccessToken}`;
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: expoHeaders,
      body: JSON.stringify({
        to: push.token, title: payload.title, body: payload.body, data: payload.data,
        sound: "default", priority: "high",
        channelId: payload.type === "call" ? "calls" : "messages",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return json({ error: "Push service unavailable" }, 502);
    const ticket = await response.json();
    if (ticket.errors?.length || ticket.data?.status !== "ok") {
      // Expo responses may contain tokens: never forward or log their contents.
      return json({ error: "Push service rejected notification" }, 502);
    }
    return ok();
  } catch {
    return json({ error: "Notification service unavailable" }, 503);
  }
}

Deno.serve(handleRequest);
