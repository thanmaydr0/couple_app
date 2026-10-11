import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { ...cors, "Cache-Control": "no-store" } });

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  const match = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return json({ error: "A user access token is required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return json({ error: "Server configuration missing" }, 500);

  try {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${match[1]}` } },
    });
    // getUser verifies the supplied JWT with Auth; decoding a JWT is not enough.
    const { data, error } = await client.auth.getUser(match[1]);
    if (error || !data.user || data.user.is_anonymous) return json({ error: "Invalid user access token" }, 401);
    const { data: profile, error: profileError } = await client
      .from("profiles").select("couple_id").eq("id", data.user.id).maybeSingle();
    if (profileError) return json({ error: "Membership lookup failed" }, 500);
    if (!profile?.couple_id) return json({ error: "Couple membership required" }, 403);
  } catch {
    return json({ error: "Authentication unavailable" }, 503);
  }

  // A fallback is returned only AFTER authentication and membership checks.
  const fallback = [{ urls: "stun:stun.l.google.com:19302" }];
  const app = Deno.env.get("METERED_APP");
  const apiKey = Deno.env.get("METERED_API_KEY");
  if (!app || !apiKey || !/^[a-zA-Z0-9_-]+$/.test(app)) return json(fallback);
  try {
    const endpoint = new URL(`https://${app}.metered.live/api/v1/turn/credentials`);
    endpoint.searchParams.set("apiKey", apiKey);
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Metered unavailable");
    const servers: unknown = await response.json();
    if (!Array.isArray(servers) || servers.length === 0 || !servers.every((s) =>
      s && typeof s === "object" &&
      (typeof s.urls === "string" || (Array.isArray(s.urls) && s.urls.length > 0 && s.urls.every((u: unknown) => typeof u === "string")))
    )) throw new Error("Invalid ICE servers");
    return json(servers);
  } catch {
    // Do not log the URL: it contains the Metered API key.
    return json(fallback);
  }
}

Deno.serve(handleRequest);
