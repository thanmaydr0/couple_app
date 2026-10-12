# Standing rules

- Android only. No local native builds. Never edit native folders by hand.
- Everything lives on the single branch `main` in this one folder. Several sessions may edit it at the same time.
- Each parallel session edits ONLY its own src/features/<name>/ folder plus its own route files named in its task. Shared files (src/lib, src/ui, app/_layout.tsx, app.json, eas.json, package.json, package-lock.json) are read-only unless the task explicitly says you may edit them. If you need a shared change, write it down under "Needs shared change" in your final report.
- DO NOT run `npm install`, `npx expo install`, or add any dependency during a wave. If you need a package that isn't installed, stop, and list it under "Needs shared change".
- Git rules: never run `git add -A` or `git add .`; never run `git stash`, `git reset`, `git checkout .`, `git clean`, `git rebase`, or `git commit -a`. Commit only your own paths: `git add "<your paths>"` then `git commit -m "feat(<area>): ..." -- "<your paths>"`. If `.git/index.lock` exists, wait 5 seconds and retry up to 5 times; never delete it. If a remote named `origin` exists, run `git push origin main` after committing; if it fails, skip it and say so.
- Strict TypeScript, no `any`. Use the Supabase client from src/lib/supabase.ts. All data is scoped to the user's couple via RLS.
- Never put secret keys in the app. The Supabase anon key is fine; the service role key and the Metered key are never allowed in the app.
- Before finishing: run `npx tsc --noEmit` and look ONLY at errors inside your own folders (other sessions' folders may be mid-edit); fix yours. Run `npx expo-doctor` once. Do not run `expo export` inside a parallel session.
- Final report format: (a) what was built, (b) how I verified it, (c) what you could NOT verify without a device, (d) manual steps for the user, (e) needs shared change.

# UI RULES

presentation-only restyle (never change queries, hooks, Realtime channels, stores, types, routes or file names; if a restyle needs a logic change, stop and report it); never hard-code colors, font sizes, spacing, radii or durations (use useTheme() and src/motion); every tappable uses PressableScale; every screen uses <Screen> and the shared Header; lists animate only the first screenful; all animation respects useMotion(); new shared components needed by a feature are created inside that feature's folder with theme tokens and noted under "Needs shared change"; match the Figma frames in docs/design/FIGMA_INDEX_*.md (fetch with the Figma tools, map to our tokens/components, never copy generated code literally) or follow docs/design/SCREENS.md; handle loading/empty/error/offline states; ≥48dp touch targets; AA contrast.


# FEATURE RULES

- Each feature session owns ONLY: src/features/<id>/**, its route file(s) named in its task (app/us/<id>.tsx), its SQL migration file supabase/migrations/<reserved name>.sql, its own Edge Function folders, and its scheduler handler file. Never edit other files. Needed shared changes go under "Needs shared change" in the final report.
- SQL: idempotent (if not exists / drop policy if exists), every table has couple_id, RLS ON with policies via my_couple_id(), add live tables to the supabase_realtime publication, add indexes. Use ADD COLUMN IF NOT EXISTS only for columns your task names. Don't edit src/types/db.ts; keep your own types in src/features/<id>/types.ts and use the untyped supabase.from('table') with your own types.
- Realtime budget: the free tier allows ~2M realtime messages a month. Throttle any high-frequency broadcast (≤15 Hz), send only when the partner is present, and stop on app background.
- Privacy: anything sensitive (location, vault, keys) is opt-in, OFF by default, has a visible indicator and an easy off switch, and keeps minimal data.
- UI: follow the UI RULES section (theme tokens, motion kit, PressableScale, loading/empty/error/offline states, ≥48dp targets, animation levels via useMotion()). If src/theme or src/motion doesn't exist, use the app's existing src/ui and keep colors/spacing in constants so the theme work can adopt them later.
- Notifications: use the notify-partner Edge Function with {channel, title, body, data:{route,...}}; add client-side rate limits.
- No installs during a wave; native libraries are only added in the dedicated N0 session.
- Final report format: (a) what was built, (b) how I verified it, (c) what you could NOT verify without a device, (d) SQL to run (in order), (e) Edge Functions to deploy, (f) manual steps for the user, (g) a regression checklist for me, (h) needs shared change.
- Git rules from earlier sections still apply (commit only your paths including supabase/ files, never add -A, never stash/reset/clean/rebase, retry on index.lock, push to origin main if a remote exists).
