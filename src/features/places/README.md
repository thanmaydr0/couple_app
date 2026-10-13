# Our Places

Owns `src/features/places/**`, `app/us/places.tsx`, `scripts/build-world-map.mjs`, and `supabase/migrations/210_places.sql`. Shared theme, navigation, native configuration, package files, and other features are unchanged. This is a new feature, using the shared Warm Glow Screen/Header/cards/controls and `docs/design/SCREENS.md` conventions.

## Built

- Equal Earth world map generated from public-domain Natural Earth/world-atlas. 177 shapes, ISO alpha-2 and original numeric IDs, two levels of detail, 200,201 bytes including newline. Regenerate with `node scripts/build-world-map.mjs`; no network or extra dependencies required.
- Skia SVG paths cached for this JS runtime, merged background paths, Reanimated transforms, bounded pan/pinch, focal double-tap zoom, full-motion momentum. Accessible zoom/reset controls and a virtualized equivalent place list. Visited/home/special reveal accent gradients; wishlist outlines are dotted. Tiny countries without atlas shapes still count and have pins.
- Add/edit/delete places, explicit Open-Meteo city search, calendar or ISO date entry, notes, visit kinds, linking up to 30 shared photo IDs. Pins preview the first linked Memory with expiring signed storage URLs. Newest 48 pins rendered; all locations remain in the list and country shading/stats.
- User-selected photo GPS inspection with EXIF plus MediaLibrary fallback; clusters within 20 km. Nearby known places/search results supply names; otherwise coordinates are shown honestly. No reverse-geocoding service, photo upload, continuous location tracking, or automatic place creation. Names/country can be selected with search before saving. Suggestions are local, initially off, and discarded when disabled or editor closes.
- Home cities are read from opt-in profile coordinates. Map distance is off by default, visibly switchable; Settings has the existing persistent city-sharing off control. Home extension shows haversine distance when both partners have saved shared cities. Great-circle path splits at the antimeridian; decorative dash animation stops offscreen/background and in Reduced/Off. Plans is read-only: next confirmed meet event or a meet/reunion/together countdown, if available.
- Country stats count the 193 UN members plus Holy See/Palestine (territories still render); cities deduplicate name/country. Travel estimate sums dated visited/home/special entries chronologically, without pretending to record a journey.
- Best-effort Skia PNG snapshot and Android share sheet, temporary file removed after sharing. The current viewport is shared, including displayed home cities/photo pins; this is disclosed before sharing. Uses the same installed Skia/file-system/sharing capabilities as Story's Wrapped.
- Loading, empty, inline retry/error, offline draft retention and loaded-query data retention. Realtime is couple-filtered Postgres changes only, removed on blur/background. No high-frequency broadcasts or notifications.

## Verified

- `npx tsc --noEmit`: zero Places/route errors; unrelated in-flight feature errors are outside this session.
- `npx expo-doctor` once: 19/21 checks pass. Existing patch mismatches in Expo, @expo/ui, expo-dev-client, expo-router, expo-screen-orientation, expo-splash-screen, expo-updates; existing New Architecture metadata warnings for react-native-incall-manager/react-native-webrtc. No dependencies installed or changed.
- `node src/features/places/verify.cjs`: all 354 paths accepted by Skia's CanvasKit backend, raster render, asset size/codes, exact d3 projection parity, distances, invalid dates/leap years, GPS clustering, territory/wishlist stat exclusions, and dateline/antipodal paths pass. Optional `--render` writes a synthetic raster QA image; it is not a screenshot of the app or user data.
- Migration applied to the configured `Couple_app` project (`tlqedvktbgaipzhdgsuy`) through the connected Supabase plugin. Verified RLS enabled, four policies, no anonymous reads, Realtime publication, and profile city/lat/lon availability.
- `verification.sql` executed against that project inside a rolled-back transaction: own CRUD, foreign couple select/update/delete and insert denial, unpaired and anonymous isolation, latitude/kind constraints, invalid media references, and immutable couple_id. No test rows remain.
- Supabase security advisor reported no Places findings; existing shared-project findings were left outside scope.

## SQL / deployment / manual setup

Order on a fresh environment: existing `001_init.sql`, `002_storage.sql`, `100_infra.sql`; optional existing `150_plans.sql`; then `210_places.sql`. Places migration is idempotent. All prerequisites already exist on the connected project and Places was applied in this session. No Edge Functions to deploy. Feature registry extension is enabled within owned `config.ts`; existing route needs no change. No user manual setup is requested.

## Needs shared change

- Android GPS EXIF support: shared `app.json`'s existing `expo-media-library` plugin needs `isAccessMediaLocationEnabled: true` in the dedicated native/config session, followed by a cloud Android development build. It is currently omitted. The opt-in inspection code requests photo access only on explicit inspection; without the manifest permission Android can redact GPS and the feature correctly reports no GPS. We cannot edit this shared file in this session. Never edit native folders or perform a local native build.
- Existing dependency/version doctor findings belong to the dedicated dependency session. No new package is required by Places.
- No new shared component required; calendar/editor/map remain inside Places.

## Device regression checklist / unverified

Android hardware is needed to verify sustained mid-range FPS, pinch/pan gesture arbitration with vertical scrolling, momentum bounds and screen rotation, actual thumbnail decoding/signing failures, keyboard/date editing at large font scales, TalkBack focus, permission-denial/limited library/GPS behavior, native snapshot/share sheet, and two-partner foreground/background Realtime delivery. These were not claimed as tested by the WASM raster or SQL tests.

Check Full/Reduced/Off and Android reduce motion; empty/loading/error/offline states and retries; visit versus wishlist shading; repeated edit/remove; switching accounts/couples; photo deletion followed by unlinking unavailable photos; both homes unset/one set/both set/cleared in Settings; optional missing Plans tables; date sorting/filtering; screenshot privacy indicators; and photo scan off/on/off before the picker returns. SQL constraints and RLS tests are automated in the files above.
