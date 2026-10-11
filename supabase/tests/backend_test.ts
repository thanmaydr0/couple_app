// No Docker, Supabase stack, remote project or credentials required.
// Run from repository root: npx deno test --config supabase/deno.json --allow-env --allow-read --allow-net supabase/tests/backend_test.ts
import { PGlite } from "npm:@electric-sql/pglite@0.5.8";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

Deno.test("migrations rerun; RLS and column grants isolate couples and tokens", async () => {
  const db = new PGlite();
  const a = "00000000-0000-0000-0000-000000000001";
  const b = "00000000-0000-0000-0000-000000000002";
  const outsider = "00000000-0000-0000-0000-000000000003";
  const unpaired = "00000000-0000-0000-0000-000000000004";
  const otherCouple = "10000000-0000-0000-0000-000000000002";
  const read = (path: string) => Deno.readTextFile(new URL(path, import.meta.url));
  const count = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n;
  const denied = async (sql: string) => {
    await db.exec("savepoint denied");
    let failed = false;
    try { await db.exec(sql); } catch { failed = true; }
    await db.exec("rollback to savepoint denied; release savepoint denied");
    assert(failed, `Expected denial: ${sql}`);
  };
  try {
    // Minimal hosted-platform stand-ins. Actual migrations run unmodified.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, email text);
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth, storage to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to authenticated;
      create function storage.foldername(name text) returns text[] language sql immutable as
        $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
      create publication supabase_realtime;
      insert into auth.users values ('${a}', 'one@test.invalid');
    `);
    const init = await read("../migrations/001_init.sql");
    const storage = await read("../migrations/002_storage.sql");
    await db.exec(init); await db.exec(storage);
    await db.exec(init); await db.exec(storage);
    assert(await count("select count(*)::int n from public.profiles") === 1, "Backfill duplicates");
    await db.exec(`insert into auth.users values ('${b}', 'two@test.invalid'), ('${outsider}', 'other@test.invalid'), ('${unpaired}', 'unpaired@test.invalid')`);
    assert(await count("select count(*)::int n from public.profiles") === 4, "Signup trigger failed");
    const seed = (await read("../seed_couple.sql")).replace("you@example.com", "one@test.invalid").replace("partner@example.com", "two@test.invalid");
    await db.exec(seed); await db.exec(seed);
    assert(await count("select count(*)::int n from public.couples") === 1, "Seed not idempotent");
    const couple = (await db.query<{ couple_id: string }>(`select couple_id from public.profiles where id = '${a}'`)).rows[0].couple_id;
    const otherPartner = "00000000-0000-0000-0000-000000000005";
    const sharedFixtures = [
      { table: "media", columns: "uploader_id, kind, storage_path, taken_at", own: `'${a}', 'photo', '${couple}/photos/x.jpg', now()`, other: `'${outsider}', 'photo', '${otherCouple}/photos/x.jpg', now()` },
      { table: "chess_games", columns: "white_id, black_id", own: `'${a}', '${b}'`, other: `'${outsider}', '${otherPartner}'` },
      { table: "scribble_matches", columns: "created_by", own: `'${a}'`, other: `'${outsider}'` },
      { table: "calls", columns: "caller_id, kind", own: `'${a}', 'audio'`, other: `'${outsider}', 'audio'` },
      { table: "watch_sessions", columns: "host_id", own: `'${a}'`, other: `'${outsider}'` },
    ];
    await db.exec(`
      insert into public.couples(id) values ('${otherCouple}');
      insert into auth.users values ('${otherPartner}', 'other-partner@test.invalid');
      update public.profiles set couple_id = '${otherCouple}' where id in ('${outsider}', '${otherPartner}');
      insert into public.push_tokens(user_id, token) values ('${a}', 'a-secret'), ('${b}', 'b-secret');
      insert into public.messages(couple_id, sender_id, kind, client_id) values
        ('${couple}', '${b}', 'text', 'partner'), ('${couple}', '${a}', 'text', 'own'),
        ('${otherCouple}', '${outsider}', 'text', 'outside');
      insert into storage.objects(bucket_id, name) values
        ('media', '${couple}/photos/a.jpg'), ('media', '${otherCouple}/photos/b.jpg');
    `);
    for (const f of sharedFixtures) {
      await db.exec(`insert into public.${f.table}(couple_id, ${f.columns}) values ('${couple}', ${f.own}), ('${otherCouple}', ${f.other})`);
    }
    const outsideMessageId = (await db.query<{ id: string }>("select id from public.messages where client_id = 'outside'")).rows[0].id;
    await db.exec(`begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${a}', true)`);
    assert(await count("select count(*)::int n from public.profiles") === 2, "Profiles escaped couple");
    assert(await count("select count(*)::int n from public.couples") === 1, "Couples escaped membership");
    assert(await count("select count(*)::int n from public.push_tokens") === 1, "Partner token exposed");
    assert(await count("select count(*)::int n from public.messages") === 2, "Messages escaped couple");
    assert(await count("select count(*)::int n from storage.objects") === 1, "Storage escaped couple");
    await denied(`update public.profiles set couple_id = '${otherCouple}' where id = '${a}'`);
    await denied(`insert into public.couples default values`);
    await denied(`update public.messages set body = 'forged' where client_id = 'partner'`);
    await denied(`insert into public.messages(couple_id, sender_id, kind, client_id) values ('${couple}', '${b}', 'text', 'spoof')`);
    await denied(`insert into public.messages(couple_id, sender_id, kind, client_id) values ('${otherCouple}', '${a}', 'text', 'cross')`);
    await denied(`insert into public.messages(couple_id, sender_id, kind, client_id, reply_to) values ('${couple}', '${a}', 'text', 'cross-reply', '${outsideMessageId}')`);
    await denied(`insert into public.push_tokens(user_id, token) values ('${b}', 'stolen') on conflict(user_id) do update set token = excluded.token`);
    await denied(`update storage.objects set name = '${otherCouple}/photos/stolen.jpg' where name = '${couple}/photos/a.jpg'`);
    await denied(`insert into storage.objects(bucket_id, name) values ('media', '${otherCouple}/chat/x.jpg')`);
    for (const f of sharedFixtures) {
      assert(await count(`select count(*)::int n from public.${f.table}`) === 1, `${f.table} cross-couple read`);
      await denied(`insert into public.${f.table}(couple_id, ${f.columns}) values ('${otherCouple}', ${f.other})`);
      await denied(`update public.${f.table} set couple_id = '${otherCouple}' where couple_id = '${couple}'`);
      const deleted = await db.query(`delete from public.${f.table} where couple_id = '${otherCouple}' returning id`);
      assert(deleted.rows.length === 0, `${f.table} cross-couple deletion`);
      await db.exec(`insert into public.${f.table}(couple_id, ${f.columns}) values ('${couple}', ${f.own})`);
      assert(await count(`select count(*)::int n from public.${f.table}`) === 2, `${f.table} own insert failed`);
    }
    await db.exec("update public.messages set read_at = now() where client_id = 'partner'; update public.messages set read_at = now() where client_id = 'own'");
    assert(await count("select count(*)::int n from public.messages where read_at is not null") === 1, "Sender can mark own messages read");
    await db.exec(`update public.profiles set display_name = 'Mine' where id = '${b}'`);
    assert(await count("select count(*)::int n from public.profiles where display_name = 'Mine'") === 0, "Partner profile writable");
    await db.exec(`select set_config('request.jwt.claim.sub', '${unpaired}', true)`);
    assert(await count("select count(*)::int n from public.messages") === 0, "Unpaired access");
    assert(await count("select count(*)::int n from storage.objects") === 0, "Unpaired storage access");
    assert(await count("select count(*)::int n from public.profiles") === 1, "Unpaired own profile hidden");
    await db.exec("rollback");
    for (const f of sharedFixtures) {
      assert(await count(`select count(*)::int n from public.${f.table} where couple_id = '${otherCouple}'`) === 1, `${f.table} cross-couple deletion`);
    }
  } finally { await db.close(); }
});

Deno.test("functions authenticate before fallback or privileged reads; tokens stay private", async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const names = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "METERED_APP", "METERED_API_KEY", "EXPO_ACCESS_TOKEN"];
  const previous = names.map((key) => Deno.env.get(key));
  // Import handlers without opening listening sockets.
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  try {
    Deno.env.set("SUPABASE_URL", "https://test.supabase.co");
    Deno.env.set("SUPABASE_ANON_KEY", "test-anon");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service");
    Deno.env.set("METERED_APP", "test"); Deno.env.set("METERED_API_KEY", "secret");
    Deno.env.delete("EXPO_ACCESS_TOKEN");
    const turn = (await import("../functions/turn-credentials/index.ts")).handleRequest;
    const notify = (await import("../functions/notify-partner/index.ts")).handleRequest;
    let valid = false, hasToken = false, pushCount = 0, partnerLookups = 0;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/auth/v1/user") return Response.json(valid ? { id: "caller", is_anonymous: false } : { message: "bad jwt" }, { status: valid ? 200 : 401 });
      if (url.pathname === "/rest/v1/profiles") {
        const headers = new Headers(init?.headers);
        if (url.searchParams.has("couple_id")) {
          partnerLookups++;
          assert(url.searchParams.get("couple_id") === "eq.couple", "Partner scope missing");
          assert(url.searchParams.get("id") === "neq.caller", "Caller not excluded");
          assert(headers.get("apikey") === "test-service", "Admin key missing");
          return Response.json([{ id: "partner" }]);
        }
        assert(url.searchParams.get("id") === "eq.caller", "Unverified membership scope");
        return Response.json([{ couple_id: "couple" }]);
      }
      if (url.pathname === "/rest/v1/push_tokens") {
        assert(url.searchParams.get("user_id") === "eq.partner", "Token scope missing");
        return Response.json(hasToken ? [{ token: "ExpoPushToken[private-token]" }] : []);
      }
      if (url.hostname.endsWith("metered.live")) return new Response("unavailable", { status: 503 });
      if (url.hostname === "exp.host") {
        pushCount++;
        const push = JSON.parse(String(init?.body));
        assert(push.to === "ExpoPushToken[private-token]" && push.priority === "high" && push.channelId === "calls", "Push routing wrong");
        return Response.json({ data: { status: "ok", id: "ticket" } });
      }
      throw new Error(`Unexpected request ${url.hostname}${url.pathname}`);
    }) as typeof fetch;
    const request = (auth = true) => new Request("https://function.test", {
      method: "POST", headers: auth ? { Authorization: "Bearer user-jwt" } : {},
      body: JSON.stringify({ type: "call", title: "Call", body: "Incoming", data: {} }),
    });
    for (const handler of [turn, notify]) {
      assert((await handler(request(false))).status === 401, "Missing JWT accepted");
      assert((await handler(request())).status === 401, "Invalid JWT accepted");
      assert((await handler(new Request("https://function.test", { method: "OPTIONS" }))).status === 204, "CORS failed");
    }
    assert(partnerLookups === 0, "Privileged query before authentication");
    valid = true;
    const fallback = await turn(request());
    assert(fallback.status === 200 && (await fallback.json())[0].urls === "stun:stun.l.google.com:19302", "STUN fallback failed");
    const noToken = await notify(request());
    assert(noToken.status === 200 && pushCount === 0, "Missing-token noop failed");
    hasToken = true;
    const sent = await notify(request());
    assert(sent.status === 200 && Number(pushCount) === 1, "Push not sent");
    assert(JSON.stringify(await sent.json()) === JSON.stringify(await noToken.json()), "Token state exposed");
  } finally {
    Deno.serve = originalServe; globalThis.fetch = originalFetch;
    names.forEach((key, index) => previous[index] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[index]!));
  }
});
