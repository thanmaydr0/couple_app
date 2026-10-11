# Two-person Supabase backend

## Current deployment — 2026-10-12

The backend is deployed to `Couple_app` (`tlqedvktbgaipzhdgsuy`). Both migrations
and both JWT-protected Edge Functions are live. The two requested accounts were
created and paired without invitation emails; public registration is disabled.
Local sign-in credentials are in `supabase/.private/account-credentials.json`,
excluded from Git and protected by Windows folder permissions. Never copy that
file into the app or commit it.

Metered TURN is configured using the `neha_thanmay` workspace and its free
500 MB trial. Its credential-specific API key is stored only in Supabase secrets.
Live checks confirmed both accounts can sign in, see exactly the two paired
profiles, obtain four TURN relay entries, and call notify-partner successfully
with no device token registered. Both functions reject missing JWTs. Sanitized
results are saved in `supabase/deployment/verification.json`.

Expo uses the deployed Supabase project and existing Firebase Android app
`com.thanmay.teser` in `teser-278d0`. Firebase Cloud Messaging V1 is enabled.
The Expo FCM service account credential is pending approval and configuration.
Actual push display and WebRTC connectivity still require the installed app on
two physical devices. No SQL, account invitations, or TURN secret entry is
required from the user for this deployment.

The instructions below are a reference for recreating or maintaining the setup.
They do not require Docker or a local Supabase stack.

## 1. Create a project and run the SQL

1. Sign in at [Supabase Dashboard](https://supabase.com/dashboard), create a
   project, and wait for it to finish provisioning. Save its database password.
2. Open your project → **SQL Editor** → **New query**. Copy the entire contents of
   `supabase/migrations/001_init.sql`, paste, and click **Run** using the default
   `postgres` role. It creates the tables, Auth signup trigger, profile backfill,
   RLS, grants, and Realtime publication membership in one transaction.
3. In another new query, paste and run `supabase/migrations/002_storage.sql`.
   Open **Storage** and confirm the `media` bucket is **private**, has a 50 MiB
   (52,428,800 bytes) limit, and permits `image/*` and `video/*` MIME types.
   The project-wide Storage upload limit must also permit this size.
4. These scripts can be rerun on the schema they create. `IF NOT EXISTS` does
   not upgrade an unrelated existing table definition. Use a fresh project or
   review existing tables and policies first: Postgres permissive policies are
   combined with OR, so an older broad policy could defeat these restrictions.
   Do not run `supabase db push` for this manual workflow or rename these files.

## 2. Create your two users and pair them

1. Open **Authentication → Users → Add user → Create new user**. Enter the first
   email and a strong password. Enable **Auto Confirm User** if shown. Repeat for
   the second person. Keep both passwords private.
2. The signup trigger creates each profile automatically. The migration and
   seed also backfill profiles if the users existed before the trigger.
3. Open `supabase/seed_couple.sql` and replace `you@example.com` and
   `partner@example.com` in its two declarations at the top with your actual
   emails. Paste the **entire** edited script into a new SQL Editor query and run.
4. The final result must show exactly two profiles with the same non-null
   `couple_id`. Save that UUID. Rerunning the seed reuses the couple. It aborts
   rather than move users between couples or add a third person.
5. Optional anniversary: run this yourself in SQL Editor, replacing the UUID
   and date: `update public.couples set anniversary = date '2024-02-14' where id = 'YOUR_COUPLE_UUID';`.

## 3. Close registration

1. Open **Authentication → Sign In / Providers** (the **User Signups** section
   in some dashboard versions).
2. Turn **Allow new users to sign up** off and save. Keep Email sign-in enabled
   for your existing users. Disable anonymous sign-ins and providers you do not
   use. This prevents new registration; it does not remove existing users.
3. Check **Authentication → Users** contains only the two intended accounts.
   Extra pre-existing accounts must be reviewed manually; an unpaired account
   can only see its own profile and push token, and cannot use these functions.

## 4. Add function secrets

1. In [Metered](https://www.metered.ca/), enable its TURN service and get your
   app subdomain and API key for the TURN credentials endpoint.
2. Open your Supabase project → **Edge Functions → Secrets** and add:
   - `METERED_APP`: just the subdomain, for example `my-couple`, without
     `https://`, `.metered.live`, or slashes.
   - `METERED_API_KEY`: the Metered API key. Never put it in Expo or Git.
3. Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` into deployed functions automatically. Do not
   copy the service role key into the app or manually expose it to clients.
4. If you enabled **enhanced push security** in Expo, also set
   `EXPO_ACCESS_TOKEN` to your Expo access token. It is optional otherwise.

## 5. Deploy functions without Docker

Install Node.js if `npx` is unavailable. Open PowerShell in the repository root
(`C:\5thsem\Projects\couple_app`, the folder containing `supabase/`). This repo
already includes `supabase/config.toml`; you do not need `supabase init`.

Find your project reference under **Project Settings → General** or in the
dashboard URL `/project/<ref>`. Replace `<ref>` below; do not type the brackets.

```powershell
npx supabase login
npx supabase link --project-ref <ref>
npx supabase functions deploy --help
npx supabase functions deploy turn-credentials --use-api
npx supabase functions deploy notify-partner --use-api
```

Login opens a browser. Linking may ask for your database password. Deployment
uploads the source; it does not run these SQL files. The `--use-api` flag bundles
on Supabase's server and needs no Docker. Confirmed with CLI **2.120.0** on
**2026-10-11**; the help command above lets you confirm your installed CLI.
Keep JWT verification enabled as specified in `config.toml`. Both functions also
validate the supplied user JWT using `auth.getUser` inside the handler.

You can set the Metered secrets through the CLI instead of the dashboard:

```powershell
npx supabase secrets set METERED_APP="your-subdomain" METERED_API_KEY="your-key"
```

Prefer the dashboard if you do not want secrets in shell history.

**Dashboard fallback:** open **Edge Functions → Deploy a new function → Via
Editor**. Name it `turn-credentials`, replace `index.ts` with the full matching
file from this repo, and deploy. Repeat with `notify-partner`. Each `index.ts`
is self-contained and imports a pinned supabase-js version. Keep the function's
JWT verification option on. There are no shared source files to copy.

## 6. Test each function

Use your project URL and public **legacy anon** API key from **Project Settings
→ API Keys** for these tests. This is the public anon key, never the service role
key. A user's session `access_token` is a different value: use the sign-in request
below to get one. It expires; sign in again if you get 401.

PowerShell example (`curl.exe` avoids the old PowerShell `curl` alias):

```powershell
$projectUrl = "https://YOUR_REF.supabase.co"
$anonKey = "YOUR_PUBLIC_ANON_KEY"
$loginBody = @{ email = "YOUR_EMAIL"; password = "YOUR_PASSWORD" } | ConvertTo-Json
$session = Invoke-RestMethod -Method Post -Uri "$projectUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $anonKey } -ContentType "application/json" -Body $loginBody
$accessToken = $session.access_token

curl.exe -i -X POST "$projectUrl/functions/v1/turn-credentials" -H "apikey: $anonKey" -H "Authorization: Bearer $accessToken" -H "Content-Type: application/json" --data '{}'

$pushBody = '{"type":"message","title":"Hello","body":"Testing partner push","data":{"screen":"chat"}}'
# Pipe JSON through stdin so Windows PowerShell preserves its quotes.
$pushBody | curl.exe -i -X POST "$projectUrl/functions/v1/notify-partner" -H "apikey: $anonKey" -H "Authorization: Bearer $accessToken" -H "Content-Type: application/json" --data-binary '@-'
```

TURN returns a JSON array for `RTCPeerConnection({ iceServers: result })`.
Metered failures or missing secrets return a Google STUN-only array; STUN alone
cannot connect every network pair. Missing/invalid JWTs return 401 before any
fallback, and valid users without a couple return 403.

Notify returns `{"ok":true}` both on successful Expo acceptance and when there
is no partner token. It never returns the partner's token or the Expo response.
Change `type` to `call` to test the `calls` Android channel. On malformed input it
returns 400; lookup errors and Expo failures use generic 5xx errors.

For a real notification, the app must request notification permissions, obtain
each person's **Expo push token**, and upsert their own `{ user_id, token }` into
`push_tokens` with `onConflict: 'user_id'`. On Android it must create notification
channels named exactly `messages` and `calls` with suitable importance. Test on
physical devices with an Expo development/production build that supports push.
HTTP success means Expo accepted the push, not that the device displayed it;
delivery receipts and automatic token cleanup are future app/server work.

## App contract and security review

- Use the public project URL and public publishable/anon key in Expo, with the
  signed-in session. Use `createClient<Database>` with `src/types/db.ts`.
- Each shared row requires `couple_id`; all nine tables enable RLS. No anonymous
  table access is granted. Couples are readable only by members and writable
  only through your privileged SQL. Pairing is SQL-only.
- Profiles expose self and partner, but users can only update their own
  `display_name`, `avatar_path`, and `last_seen`. They cannot set `couple_id`,
  insert profiles, or delete profiles. The helper reads only `auth.uid()`'s
  membership; its execution is revoked from PUBLIC and anon.
- Push tokens allow owner-only SELECT/INSERT/UPDATE/DELETE. A partner cannot
  read, overwrite, or move another person's token. Only the Edge Function's
  separate service role client can read the verified caller's partner token.
- Messages allow couple SELECT/DELETE, self-sender INSERT with null `read_at`,
  and recipient-only UPDATE of the **`read_at` column**. Users cannot edit
  message body, sender, IDs, or couple through UPDATE. Supply a unique
  `client_id` (use a random UUID string). Deduplicate retries with INSERT and a
  lookup; avoid an upsert that tries to UPDATE immutable columns.
- Media, chess, scribble, calls, and watch sessions permit both partners to
  SELECT/INSERT/UPDATE/DELETE within their couple. UPDATE checks both old and
  new membership, preventing moves to another couple. Composite foreign keys
  keep referenced participants/replies inside the same couple. These shared
  records trust both partners: chess legality and game/call transitions are
  app responsibilities, not validated game servers.
- All files use `<couple_id>/photos/...`, `videos/...`, `thumbs/...`,
  `avatars/...`, or `chat/...` in the private `media` bucket. Save **object
  paths**, not public URLs. Download authenticated or create short-lived signed
  URLs; anyone holding a signed URL can use it until expiry. Storage policies
  authorize the first folder for reads, writes, deletes and both sides of a
  rename/upsert. Other folders under your own couple prefix are also allowed.
- Realtime includes exactly the seven requested tables, excluding push tokens.
  Subscribe with the user session and a `couple_id` filter (profiles use their
  corresponding filter). SELECT RLS controls visible changes. Do not treat
  Realtime DELETE payloads as protected row content; keep client-side filtering
  and avoid publishing full old rows with `REPLICA IDENTITY FULL`.
- `updated_at` is maintained on push tokens, chess and scribble updates.
  Actor/profile foreign keys can block Auth user deletion when history still
  references that profile. Review/delete that history via SQL before removing
  a user. Token deletion itself cascades with Auth user deletion.
- Disable signups and keep secrets server-side. SQL Editor and service role
  intentionally bypass RLS; do not distribute those credentials.

## Checks you can rerun

From the repository root:

```powershell
npx deno check --config supabase/deno.json supabase/functions/turn-credentials/index.ts supabase/functions/notify-partner/index.ts src/types/db.ts
npx deno test --config supabase/deno.json --allow-env --allow-read --allow-net supabase/tests/backend_test.ts
# Live account/function checks, using the private local credential file:
pwsh -File supabase/tests/live_check.ps1
```

Tests use in-memory Postgres (PGlite) with small Auth/Storage stand-ins and mocked
HTTP calls. They run the real migrations twice, verify backfill/seed/trigger
behavior, and attempt cross-couple access, token theft, profile reassignment,
message forgery and storage moves. They need package downloads on first use but
no credentials, Docker, live database, or local Supabase stack. They do not prove
the hosted project's existing policies, actual TURN connectivity, or device push
delivery; run the dashboard and device checks above after deploying.

Official references: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[verified getUser](https://supabase.com/docs/reference/javascript/auth-getuser),
[Storage buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
[function deployment](https://supabase.com/docs/guides/functions/deploy),
[Expo Push API](https://docs.expo.dev/push-notifications/sending-notifications/).
