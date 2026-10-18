# Android 1.1.1 dependency lock repair — 18 October 2026

## What was fixed

The failed production build stopped in `npm ci --include=dev`, before compiling Android. The checked-in lockfile omitted TypeScript 5.9.3 required by the optional `typescript: ^5` peer of NotifyKit's nested `@expo/require-utils@55.0.8`. The application separately uses TypeScript 6.0.3.

Reproduced the exact `EUSAGE` / `Missing: typescript@5.9.3 from lock file` failure with cached npm 10.9.8 in an isolated temporary directory containing copies of the repository manifest and lockfile. Generated the missing entry there with npm 10's lockfile-only resolver, then applied only that entry to the repository. The entry includes the resolver's registry URL, integrity hash, optional/peer flags, executables and engine constraint. No declared dependency version, native configuration or application code changed.

## Verification

- A real `npm ci --include=dev --ignore-scripts --no-audit --no-fund` with npm 10.9.8 completed successfully in the isolated directory: 769 packages installed. The fixture manifest and lockfile were checked byte-for-byte against the repaired repository files. Lifecycle scripts were intentionally excluded locally; native/configuration lifecycle behavior remains the cloud build's responsibility.
- npm 11.19.0 `ci --include=dev --ignore-scripts --dry-run --no-audit --no-fund` also exited 0 against the repaired files.
- `npx tsc --noEmit` passed.
- `npx expo export --platform android` completed: 3,484 modules, one Android Hermes bundle and 87 assets. This was a JavaScript export in a temporary directory, not a native build.
- `npx expo-doctor` ran once: 19/21 checks passed. Existing findings remain: 11 SDK patch-version mismatches, and missing New Architecture validation metadata for WebRTC and InCall Manager. They were not suppressed and do not explain the reproduced lockfile failure.
- `git diff --check` passed. The lockfile change contains one additional package entry only; root manifests and all previously locked package versions remain unchanged.

## Device limits

No Android device was connected. APK installation, native lifecycle scripts/compilation and two-device behavior cannot be established from these local checks. The earlier release report records the feature test coverage and hardware gaps.

## Build and manual steps

Submit the existing production APK profile with remote signing, a cleared cloud cache and `--no-wait`. No SQL or Edge Functions changed. No user setup is required. After submission, do not monitor the build, per the user's instruction.

## Needs shared change

No additional shared change is required for this lockfile failure. Existing SDK patch alignment and hardware acceptance remain separate maintenance/verification work.

Reference: https://docs.npmjs.com/cli/v10/commands/npm-ci/ documents that `ci` rejects an inconsistent lockfile rather than updating it.
