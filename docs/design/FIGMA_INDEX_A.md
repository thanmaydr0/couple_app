# Session A — local design index

12 October 2026. Continued from the user-supplied Us — Warm Glow.png without Figma MCP. **Created 71 editable local HTML/CSS screen/state studies**, each 412×915, with eight token-based themes, motion samples, per-frame Motion notes and clickable Settings flows. No app code, native folders or dependencies were changed. The supplied PNG is unchanged.

[Open local design review](session-a/index.html) · [Portable bundle](session-a-review.zip) · [Review instructions and limitations](session-a/README.md) · [Detailed brief](FIGMA_BRIEF_A.md)

Open index.html directly; all fonts/scripts/tokens are bundled and work offline. Choose Area/Screen/State to review, including All states for specialized variants. Scroll within long frames. Local IDs below are real DOM anchors, not Figma IDs. Runtime theme variables are CSS properties derived from tokens.json; PNG exports cannot preserve Figma variable/component links.

## Verification

- JavaScript syntax passed; browser error logs were empty during tested interactions.
- Browser audited all 71 frames in Midnight, Rose and Noir: fixed 412×915 geometry, no horizontal frame overflow or checked control/heading/name overflow, theme variables present. See session-a/qa-geometry.json.
- Visual checks: Home Midnight/Rose, Login Midnight, Appearance Noir. Home quick-action spacing was corrected. Screenshots saved in session-a/qa-*.png. Exhaustive visual review of all 213 theme/state combinations remains outstanding.
- Exercised Settings → Appearance, Rose selection and Off motion selection. Implemented samples include logo reveal, hero gradient, counter heartbeat, spinner/shimmer and press feedback. Parallax, theme crossfade, spring sheet and moving-tab transitions remain documented targets; this artifact does not implement app persistence or native modal focus.
- Current `npx --no-install tsc --noEmit`: passed, exit 0. Earlier out-of-scope errors have been resolved by other work; Session A did not edit shared source.
- `npx --no-install expo-doctor`: once during continuation, 19/21 passed. Existing New Architecture metadata warnings and nine Expo patch mismatches remain; no dependency edits.

## Scope and manual review

Check long names, 1,234 days/128 badge, theme preview contrast, scrolling gallery, error copy and safe-area placement by eye. Device-only work remains for Android font scaling/keyboard/insets, TalkBack/focus, permissions, push, presence and calls. Both avatars use initials; no private photo asset was supplied. Current Home lacks unread/latest-photo/self-avatar data bindings: 128 is an explicitly annotated handoff specimen, and latest-photo content is omitted. No fictional notification toggles, registration, reset password or account deletion.

Needs shared change: later app implementation of themes/motion persistence, shared system pieces, Settings regrouping and requested Home bindings. Fonts are already installed in the concurrent repository state and were copied with licenses into this standalone artifact.

## Git and Figma status

Only this index is staged by Session A. The local artifact, ZIP and brief remain untracked to honor the index-only commit instruction. Prior scoped commit failed because the configured SSH signing key was locked; no signing settings were changed and no push occurred. Unlock the signing key, then run `git commit -m "docs(design): figma index A" -- docs/design/FIGMA_INDEX_A.md` and `git push origin main` after a successful commit.

No Figma calls were made during this PNG continuation. Earlier access was blocked by Starter MCP quota. Pre-existing Figma references remain in FIGMA_INDEX.md at https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2; Session A created no Figma nodes or Smart Animate connections.

## Every local frame

| Frame / local DOM ID | Link |
|---|---|
| Auth/Splash/default | [Open](session-a/index.html#Auth%2FSplash%2Fdefault) |
| Auth/Splash/loading | [Open](session-a/index.html#Auth%2FSplash%2Floading) |
| Auth/Splash/empty | [Open](session-a/index.html#Auth%2FSplash%2Fempty) |
| Auth/Splash/error | [Open](session-a/index.html#Auth%2FSplash%2Ferror) |
| Auth/Splash/offline | [Open](session-a/index.html#Auth%2FSplash%2Foffline) |
| Auth/Login/default | [Open](session-a/index.html#Auth%2FLogin%2Fdefault) |
| Auth/Login/loading | [Open](session-a/index.html#Auth%2FLogin%2Floading) |
| Auth/Login/empty | [Open](session-a/index.html#Auth%2FLogin%2Fempty) |
| Auth/Login/validation | [Open](session-a/index.html#Auth%2FLogin%2Fvalidation) |
| Auth/Login/error | [Open](session-a/index.html#Auth%2FLogin%2Ferror) |
| Auth/Login/config-error | [Open](session-a/index.html#Auth%2FLogin%2Fconfig-error) |
| Auth/Login/offline | [Open](session-a/index.html#Auth%2FLogin%2Foffline) |
| Auth/Login/keyboard | [Open](session-a/index.html#Auth%2FLogin%2Fkeyboard) |
| Home/Our space/default | [Open](session-a/index.html#Home%2FOur%20space%2Fdefault) |
| Home/Our space/loading | [Open](session-a/index.html#Home%2FOur%20space%2Floading) |
| Home/Our space/empty | [Open](session-a/index.html#Home%2FOur%20space%2Fempty) |
| Home/Our space/error | [Open](session-a/index.html#Home%2FOur%20space%2Ferror) |
| Home/Our space/offline | [Open](session-a/index.html#Home%2FOur%20space%2Foffline) |
| Home/Our space/long-content | [Open](session-a/index.html#Home%2FOur%20space%2Flong-content) |
| Settings/Main/default | [Open](session-a/index.html#Settings%2FMain%2Fdefault) |
| Settings/Main/loading | [Open](session-a/index.html#Settings%2FMain%2Floading) |
| Settings/Main/empty | [Open](session-a/index.html#Settings%2FMain%2Fempty) |
| Settings/Main/error | [Open](session-a/index.html#Settings%2FMain%2Ferror) |
| Settings/Main/offline | [Open](session-a/index.html#Settings%2FMain%2Foffline) |
| Settings/Main/long-content | [Open](session-a/index.html#Settings%2FMain%2Flong-content) |
| Settings/Main/signing-out | [Open](session-a/index.html#Settings%2FMain%2Fsigning-out) |
| Settings/Main/logout-error | [Open](session-a/index.html#Settings%2FMain%2Flogout-error) |
| Settings/Appearance/default | [Open](session-a/index.html#Settings%2FAppearance%2Fdefault) |
| Settings/Appearance/long-content | [Open](session-a/index.html#Settings%2FAppearance%2Flong-content) |
| Settings/Profile/default | [Open](session-a/index.html#Settings%2FProfile%2Fdefault) |
| Settings/Profile/loading | [Open](session-a/index.html#Settings%2FProfile%2Floading) |
| Settings/Profile/empty | [Open](session-a/index.html#Settings%2FProfile%2Fempty) |
| Settings/Profile/error | [Open](session-a/index.html#Settings%2FProfile%2Ferror) |
| Settings/Profile/offline | [Open](session-a/index.html#Settings%2FProfile%2Foffline) |
| Settings/Profile/long-content | [Open](session-a/index.html#Settings%2FProfile%2Flong-content) |
| Settings/Profile/uploading | [Open](session-a/index.html#Settings%2FProfile%2Fuploading) |
| Settings/Profile/saving-name | [Open](session-a/index.html#Settings%2FProfile%2Fsaving-name) |
| Settings/Profile/saving-anniversary | [Open](session-a/index.html#Settings%2FProfile%2Fsaving-anniversary) |
| Settings/Profile/invalid-name | [Open](session-a/index.html#Settings%2FProfile%2Finvalid-name) |
| Settings/Profile/invalid-date | [Open](session-a/index.html#Settings%2FProfile%2Finvalid-date) |
| Settings/Profile/denied | [Open](session-a/index.html#Settings%2FProfile%2Fdenied) |
| Settings/Notifications/default | [Open](session-a/index.html#Settings%2FNotifications%2Fdefault) |
| Settings/Notifications/loading | [Open](session-a/index.html#Settings%2FNotifications%2Floading) |
| Settings/Notifications/error | [Open](session-a/index.html#Settings%2FNotifications%2Ferror) |
| Settings/Notifications/offline | [Open](session-a/index.html#Settings%2FNotifications%2Foffline) |
| Settings/Notifications/denied | [Open](session-a/index.html#Settings%2FNotifications%2Fdenied) |
| Settings/Notifications/success | [Open](session-a/index.html#Settings%2FNotifications%2Fsuccess) |
| System/Tab bar/default | [Open](session-a/index.html#System%2FTab%20bar%2Fdefault) |
| System/Tab bar/chat | [Open](session-a/index.html#System%2FTab%20bar%2Fchat) |
| System/Tab bar/memories | [Open](session-a/index.html#System%2FTab%20bar%2Fmemories) |
| System/Tab bar/watch | [Open](session-a/index.html#System%2FTab%20bar%2Fwatch) |
| System/Tab bar/games | [Open](session-a/index.html#System%2FTab%20bar%2Fgames) |
| System/Toast/default | [Open](session-a/index.html#System%2FToast%2Fdefault) |
| System/Toast/error | [Open](session-a/index.html#System%2FToast%2Ferror) |
| System/Toast/long-content | [Open](session-a/index.html#System%2FToast%2Flong-content) |
| System/Dialog/default | [Open](session-a/index.html#System%2FDialog%2Fdefault) |
| System/Dialog/loading | [Open](session-a/index.html#System%2FDialog%2Floading) |
| System/Dialog/error | [Open](session-a/index.html#System%2FDialog%2Ferror) |
| System/Bottom sheet/default | [Open](session-a/index.html#System%2FBottom%20sheet%2Fdefault) |
| System/Bottom sheet/long-content | [Open](session-a/index.html#System%2FBottom%20sheet%2Flong-content) |
| System/Skeleton/default | [Open](session-a/index.html#System%2FSkeleton%2Fdefault) |
| System/Offline banner/default | [Open](session-a/index.html#System%2FOffline%20banner%2Fdefault) |
| System/Permissions/camera | [Open](session-a/index.html#System%2FPermissions%2Fcamera) |
| System/Permissions/microphone | [Open](session-a/index.html#System%2FPermissions%2Fmicrophone) |
| System/Permissions/photos | [Open](session-a/index.html#System%2FPermissions%2Fphotos) |
| System/Permissions/notifications | [Open](session-a/index.html#System%2FPermissions%2Fnotifications) |
| System/Permissions/camera-denied | [Open](session-a/index.html#System%2FPermissions%2Fcamera-denied) |
| System/Permissions/microphone-denied | [Open](session-a/index.html#System%2FPermissions%2Fmicrophone-denied) |
| System/Permissions/photos-denied | [Open](session-a/index.html#System%2FPermissions%2Fphotos-denied) |
| System/Permissions/notifications-denied | [Open](session-a/index.html#System%2FPermissions%2Fnotifications-denied) |
| System/Error screen/default | [Open](session-a/index.html#System%2FError%20screen%2Fdefault) |
