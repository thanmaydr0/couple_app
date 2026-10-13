# Location feature report — 13 October 2026 IST

## (a) What was built

Optional per-person location sharing, default OFF, one/eight-hour or until-Stop
modes, a plain-language consent and Android permission guide, a persistent global
banner, foreground-service Stop action, adaptive background updates, local expiry,
and durable offline revocation retry. The already mounted LocationProvider is
implemented without editing the root layout.

MapLibre map with both avatar markers, Full-motion pulsing and interpolation,
accuracy polygons, distance line, follow/fit controls, explicit straight-line ETA,
update age and batteries, attribution, setup/loading/error/offline/empty states.
Destination search and saved-place journeys, departure/arrival pushes, opt-in
geofencing with a 20-region budget, and low-battery alerts use notify-partner.
Developer simulation is entirely local and excludes real-sharing actions.

Three couple-scoped RLS tables, restricted grants, indexes, owner-only writes,
server-side partner-read expiry, private saved places, concurrency-safe place
budget, Realtime registration and minute-based deletion cron are in the reserved
310 migration. There is no application location-history table.

## (b) How I verified it

- `npx tsc --noEmit` passed after location changes.
- `node --test src/features/location/privacy.test.cjs`: 11 tests passed, including
  default OFF, Stop and stale callbacks, offline retry, permission denial, expiry
  without a fix, Postgres timestamp normalization, Stop racing the first fix,
  adaptive updates/no coordinate storage, low-battery deduplication, and blocking
  real sharing until cold-headless entry integration is present.
- Applied location SQL through the authenticated browser dashboard for project
  `tlqedvktbgaipzhdgsuy`; reran the core migration to verify idempotence and applied
  the final grants/region-budget hardening from the same migration.
- Hosted rolled-back RLS assertions passed: live partner reads, owner-only writes,
  ownership reassignment rejection, outsider denial, private saved coordinates,
  expiry denial, and Stop removing both point and journey.
- Hosted region assertions accepted 20 enabled regions and rejected the 21st.
  Authenticated TRUNCATE privileges are absent. Cleanup's latest cron execution
  reported `succeeded`. All three tables contained zero rows after the fixtures.
- `pwsh -NoProfile -File src/features/location/live-check.ps1` passed: both existing
  accounts can access the three tables; anonymous reads denied; Open-Meteo works.
  Credentials were never printed and no partner notification was sent.
- `npx --no-install expo-doctor` ran once: 19/21 checks passed. Existing React
  Native Directory warnings for InCallManager/WebRTC and seven Expo patch-version
  mismatches remain. No dependency was changed.
- `git diff --check` passed for owned files.
- Hosted Security Advisor: zero errors; current warnings concern other features
  and existing infrastructure, with no location-specific finding.

## (c) What I could not verify without a device

`adb devices` lists none. Native MapLibre rendering, Android permission screens,
foreground-service Stop delivery, actual background intervals/expiry, vendor kill
behavior, reboot recovery, battery readings, and partner push delivery remain
device checks. Update frequency and task restart are subject to Android scheduling.

## (d) SQL to run, in order

Already applied: `supabase/migrations/310_location.sql` after the existing base
schema/my_couple_id helper and infrastructure. It installs its own named cron;
no scheduler handler or cron secret is needed. For another environment, run this
single migration, then the rolled-back `src/features/location/privacy.sql` fixture.

## (e) Edge Functions to deploy

None added. The existing deployed `notify-partner` function accepts channel
`location` and route `/us/location`; source and existing deployed function presence
were checked. Real delivery needs the existing registered partner push token.

## (f) Manual steps for the user

No database or Edge Function deployment work remains for this project. I performed
the available hosted setup and checks. I did not turn on anyone's real sharing.
Each person's consent remains an app action by design. Hardware-only verification
could not be performed because no Android device is connected.

## (g) Regression and privacy checklist

See `docs/LOCATION.md` for the completed privacy checks and explicitly unchecked
hardware checks. Online Stop deletes active database rows; physical expiry cleanup
runs within one minute, with SQL read denial at expiry. Offline revocation cannot
instantly delete remote data, especially in until-Stop mode; the UI explains this
and keeps a persistent pending-deletion banner. Provider-managed WAL/backups have
their own retention; no promise of instant backup erasure is made.

## (h) Needs shared change

- **Required before enabling real sharing:** import
  `./src/features/location/headless` from shared `index.js` before
  `require('expo-router/entry')`. Router layouts are not a reliable cold-headless
  registration point. Because index.js is outside this session's owned paths, it
  was left unchanged. Sharing deliberately stays disabled with a setup message
  until this import is present. The headless module, tasks and notification Stop
  handler are implemented and tested. This is an integration gap, not a claim
  that cold background Stop has been verified on a phone.
- Configure the currently absent `EXPO_PUBLIC_MAP_STYLE_URL` in the shared bundle
  environment/EAS build profile. Source intentionally shows the required setup
  message until an actual provider style is supplied; no key was invented.
- Shared sign-out/unpair flows should await `stopSharing()` **before** revoking the
  authenticated session or changing couple membership. This feature stops locally
  on sign-out and persists revocation, but after a token is revoked it cannot
  authenticate the server deletion until that same account signs in again.
- Release/build coordination and existing Expo Doctor dependency findings belong
  to the shared/native session. No local native build, install, native edit, shared
  file edit, or new shared component was needed here.
