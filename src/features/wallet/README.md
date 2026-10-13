# Us Wallet

Shared expenses, per-currency balances, settlements, savings jars, receipt photos, monthly repeats, SVG spending charts, month/category/search filters, and month CSV sharing. This feature owns only its folder, the existing wallet route, migration `170_wallet.sql`, and the recurring scheduler handler.

Money is stored as integer minor units. Pure calculations are in `math.ts`; multiplication and division for percentages/conversion use BigInt. Equal splits assign the odd paise to the payer. A positive viewer balance means the partner owes the viewer. Settlements reduce that balance; savings contributions never change it. Editing an expense after a settlement can correctly produce a new balance. Two-decimal currencies (including INR, USD, EUR and GBP) are supported; manual conversion is a preview and never merges or settles ledgers.

## Verification performed

- `npx tsc --noEmit`: passed after fixing Wallet errors.
- `node src/features/wallet/test.cjs`: 30 pure math assertions and six scheduler scenarios using only installed TypeScript and Node; compilation goes into a temporary directory and is removed afterwards.
- `security-tests.sql`: passed on the connected project inside a rolled-back transaction. Checks couple RLS, cross-couple rejection, immutable goal totals, odd-paise settlements, duplicate settlement rejection, scheduler enqueue, atomic recurrence, retry deduplication and cancellation. Requires a fresh ledger; it intentionally refuses to run against real expenses.
- `node src/features/wallet/verify-live.mjs`: passed API reads for both existing paired test accounts, anonymous ledger denial, receipt upload/partner signing, anonymous signing denial and cross-couple upload rejection. Uses existing ignored credentials, prints no secrets, removes its photo, and signs out only its own sessions.
- `npx expo-doctor`: 19/21 passed. Existing New Architecture warnings for incall-manager/webrtc and seven Expo patch mismatches remain. No dependencies or native folders changed.
- Security advisor: the Wallet settlement RPC is intentionally authenticated SECURITY DEFINER, with explicit membership checks, a fixed empty search path, current-ledger validation, serialized writes and no anon/PUBLIC execution. Trigger-only definer functions are not exposed as RPCs. Other advisor findings concern existing shared infrastructure.

## SQL and deployment

Prerequisites already existed: `001_init.sql`, `002_storage.sql`, `100_infra.sql`. Applied `170_wallet.sql` to the configured project, then reapplied its hardened validation idempotently. All five tables have RLS, couple indexes and Realtime publication membership. The private `wallet-receipts` bucket and couple-folder policies are included.

Deployed the existing `scheduler` Edge Function with only `handlers/recurring_expense.ts` replaced, preserving its other remote files and its existing secret-header authentication. Confirmed the scheduler cron job is active. Monthly creation is transactional: an occurrence and the following job are written together, a `(recurring_id, spent_on)` unique index prevents duplicates, and the original day-of-month is restored after short months. Stop cancels pending jobs. Calendar dates currently run at midnight UTC.

## Device limits and regression checklist

No native build or Android device was used. Still unverified on Android: sheet/keyboard layout and accessibility at large text scales, photo permission and compression UX, actual push delivery, background/resume Realtime cleanup, physical swipes, chart/liquid motion in Full/Reduced/Off, confetti and the Share chooser.

- Add/edit/delete each split type, including odd paise and a percentage; check both partners see opposite balances.
- Record a real payment, attempt a stale second settlement, and verify no over-settlement.
- Filter/search a month and export CSV; ensure another currency never enters the displayed currency's charts.
- Attach/replace/remove a receipt, deny photo permission, and retry after a lost connection.
- Contribute from both people concurrently; cross the savings target and confirm the jar/celebration.
- Start and stop a monthly repeat; retry its handler and verify one expense/one next job, including January 31 → February → March 31.
- Go offline, background, resume, and switch accounts; confirm no false saved confirmation or previous-couple data.

## Manual steps and needs shared change

No backend setup or deployment steps are left for the user. A physical Android interaction check remains unperformed; no user action is requested by this handoff.

**Shared blocker:** `notify-partner` only accepts user JWTs. Add a verified service-caller + `scheduler_job_id` contract that loads the job and occurrence, rechecks membership, derives recipients and deduplicates delivery by job ID. The recurring handler records the expense successfully, then fails explicitly on the rejected push, allowing scheduler retries without duplicate expenses. After the shared contract lands, jobs whose three retries were exhausted need server-side requeueing. User-initiated expense pushes already use the current contract and a 60-second client cooldown. The same limitation affects existing other scheduler handlers; Wallet did not edit their shared code.

**Shared maintenance:** resolve the Expo Doctor patch mismatches and New Architecture warnings in the dedicated dependency session. Feature-local Choice/Row/jar/chart components use theme tokens and require no shared extraction for this feature.
