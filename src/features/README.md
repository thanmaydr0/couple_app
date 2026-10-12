# Adding a feature during a wave

Read the root AGENTS.md first. Every reserved route already exists. Only edit
your own feature folder, named route, reserved SQL migration, own function
folders, and allocated scheduler handler. The registry and other shared files
remain read-only during a wave.

1. Implement your `Screen.tsx`. It is re-exported by `app/us/<id>.tsx`.
2. Keep database row/domain types and validation in your own `types.ts`.
   Use the existing authenticated client. `featureSupabase` from
   `src/lib/data/feature-client.ts` is an open-schema view of that SAME client,
   for tables not in the legacy generated schema. It never creates another
   auth session. Validate its unknown network rows (e.g. with Zod).
3. Implement optional `HomeCard` and `SettingsSection` in your folder and
   attach them to your `config.ts` export. Flip **enabled: true in config.ts**
   when ready. No registry edit is needed. Local Features settings can hide
   your entry, HomeCard and SettingsSection on a particular phone/account.
   Hidden means declutter only, not a security gate or consent revocation.
4. Use `useRealtimeTable` for bounded couple-scoped lists where suitable;
   pass a stable row decoder, immutable ID, order column and limit. It stops
   subscriptions in background, resyncs after connection, coalesces changes,
   and exposes errors/offline/subscription state. Its optimistic helpers
   require a complete row for insert. Retry inserts with the same ID and
   reconcile with the server after ambiguous transport failures. High-frequency
   presence/broadcast interactions need their own throttled implementation.
5. Use `notifyPartner` from notifications/notify.ts for new notifications;
   it accepts `{channel,title,body,data:{route,...},priority?,dataOnly?}` and
   rate limits client sends. Legacy messages/calls retain their existing API.
   Route taps accept registered enabled feature routes and explicit app routes;
   calls always go through the call engine validation. Data-only delivery is
   subject to Android background restrictions and is never a wake guarantee.
6. Scheduler payloads are not trusted authorization. Use your allocated handler
   file, validate payload, resolve recipients using membership, and scope admin
   queries by `job.couple_id`. Deduplicate side effects by `job.id`.
   Stubs currently throw and retry to failed. Do not enqueue until implemented.

| Feature | Reserved migration | Scheduler handler |
|---|---|---|
| pulse | 110_pulse.sql | daily_digest |
| touch | none | none |
| capsule | 130_capsule.sql | capsule_unlock |
| lists | 140_lists.sql | none |
| plans | 150_plans.sql | plan_reminder, countdown |
| gamenight | 160_gamenight.sql | none |
| wallet | 170_wallet.sql | recurring_expense |
| focus | 180_focus.sql | none |
| story | 190_story.sql | none |
| chatplus | 200_chatplus.sql | scheduled_message, disappearing_purge |
| places | 210_places.sql | none |
| voice | 300_voice.sql | none |
| location | 310_location.sql | none |
| yt | 320_yt.sql | none |
| applock | 330_applock.sql | none |
| e2ee | 340_e2ee.sql | none |
| vault | 350_vault.sql | none |
| ringing | 360_ringing.sql | none |
| widgets | 370_widgets.sql | none |
| book | none | none |

`needsNative` is conservative N0 planning metadata for the 300-series features;
it does not enforce app availability or grant consent. Sensitive features must
implement separate OFF-by-default opt-in, a visible indicator and easy off.
Feature discovery never enables location, microphone, vault, encryption keys,
notifications or other private data collection on its own.

Shared setup is documented in supabase/README_SCHEDULER.md. The infrastructure
session installed fuse.js and reused the existing zod; asset scripts can use
world-atlas, topojson-client and d3-geo. No native dependencies were added.
