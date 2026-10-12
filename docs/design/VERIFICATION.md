# Verification and remaining work

## Completed

- Read AGENTS.md and audited route implementations, feature views and supporting state derivation. All authored local paths are under docs/design; app code/native folders/dependencies are untouched by this session.
- `python docs/design/build_tokens.py`: 8 themes, 296 text/bubble/tick contrast pairs, zero failures at 4.5:1. Each outgoing gradient checked at 1,001 sRGB samples. Auto day is Rose; Auto night is separately covered by Midnight. This verifies numeric token pairs, not Android rendering or arbitrary accent overrides.
- `npx tsc --noEmit`: exit 0, no errors.
- `npx --no-install expo-doctor`: ran once, exit 1, 19/21 checks passed. Existing shared issues: React Native Directory lists react-native-incall-manager and react-native-webrtc as untested on New Architecture; nine Expo packages have patch mismatches. No dependency changes made.
- Figma write calls confirmed creation of 3 pages, 8 semantic color collections + Primitives/Spacing/Radius/Motion, 321 variables, 11 text styles, 5 effect styles, 8 swatch boards, 29 component families and 12 editable 412×915 review screens. IDs persisted in figma-state.json, components-state.json, screens-state.json.
- Visual screenshots inspected: Midnight swatch board, Home, Appearance, Chat. Repaired content clipping in Home/Appearance; final screenshots saved as qa-home.png, qa-appearance.png, qa-chat.png, qa-foundations.png.

## Not completed — Figma tool quota

The final inspection call returned “You've reached the Figma MCP tool call limit on the Starter plan.” Further repairs, exhaustive component validation, screenshots of every page/family, and theme sample rebinding could not proceed. Do not treat this library as fully verified or production-ready.

Known visual defects in the latest saved screenshots:

1. Home shortcut rows still hug text instead of filling 364dp. Set each horizontal row to FIXED primary sizing AND explicitly resize width to 364; changing sizing alone preserves the previous hugged width.
2. Chat outgoing bubbles are left-aligned in the review screen. Wrap message rows in full-width Auto Layout; mine counterAxisAlignItems=MAX, theirs=MIN. The bubble component itself should remain max 300–309dp.
3. Some vector icon strokes render black instead of their semantic ink, despite bound strokes. Inspect each vector's paint binding and resolved value; assign the resolved token RGB as the paint fallback while retaining its variable alias, then re-screenshot. Do not introduce unbound literal colors as a workaround.
4. Home partner Online text appears slightly clipped at the left. Resize/reflow the name-and-presence column after its parent gets a fixed width.
5. Composer/shortcut horizontal widths need the same explicit resize repair. On the chat frame, group status/timestamp at the bubble's lower trailing edge.

Known library gaps requiring continuation:

- IconButton has vector children, not a linked INSTANCE_SWAP icon property yet. Create local vector icon components, replace vector child with an instance, and link a returned addComponentProperty key. Button labels are editable text overrides but not exposed TEXT properties yet.
- Failed outgoing bubble currently shows a warning glyph in bubble ink; add danger-on-bg Retry footer with a 48dp target to match SCREENS.md. Incoming bubble variants expose the requested status axis but intentionally do not render receipts.
- Tick clock rotation, second-tick draw/color tween, animated tab pill, looping typing/shimmer, and press-scale animations are specified in docs but not authored or verified as Figma motion/prototype interactions. Static variants exist. Do not claim playback validation.
- Eight themes exist as separate bound collections and preview cards, but a single shared sample component has NOT been rebound and visually verified through all eight. Starter cannot literally flip an eight-mode collection. See FIGMA_BRIEF.md for the equivalent verification process.
- Effect styles exist but their shadow colors need a binding audit. No exhaustive geometry/padding/radius/semantic binding or control 3:1 contrast audit was completed. Numeric body text contrast is complete.
- Figma includes representative review screens, not every state in SCREENS.md. Detailed full-screen Chess, player/fullscreen, media viewers, call-connected and error-state compositions still need assembly if desired; the original requested step was foundations/components, with screen specs in docs.
- No private photo assets were supplied. Media slots are explicitly placeholders. Scribble canvas in the review screen is illustrative and needs a fixed-white content primitive to match the actual drawing implementation.
- Cover and Flows exist but were not visually inspected before the quota block. No public library publishing or Code Connect mapping was attempted; those are not needed for this design-only task.

## Plan limits and recoverable failures

- Starter rejected a second color mode and a fourth page. User chose eight separate theme collections. Cover/Foundations/Components remain pages; other requested page names are sections on Components.
- One oversized tool result was rolled back; reduced response payload succeeded. SVG arc command was rejected; cubic path replacement succeeded. Tool responses confirmed these runs did not commit failed canvas edits.
- Quota reset time was not supplied. Resume when tool access returns, or move the work to a suitable plan with the user. Avoid repeated blocked calls.

## Device verification still required

## Git handoff

Only docs/design was staged. `git diff --cached --check` passed after trimming four trailing blank lines. The requested scoped commit failed: repository config has commit.gpgsign=true and gpg.format=ssh; the encrypted SSH signing key could not decrypt noninteractively. `ssh-add -l` reported no agent. Signing was not disabled, no commit was created, and no push was attempted because there was no new commit. Files remain staged for the user to commit after unlocking their key.

Manual commands after unlocking signing:

```powershell
git commit -m "docs(design): add Warm Glow audit tokens and Figma handoff" -- docs/design
git push origin main
```

## Device checks

Android safe areas/navigation bar, keyboard avoidance, font scaling, 48dp targets including Chess squares, TalkBack order/announcements, theme appearance on OLED, reduced-motion behavior, actual two-phone receipts/reconnect/sync, local-file verification/player orientation, calls/Bluetooth/media permissions, offline originals and picker flows. No local native build was run.

## Needs shared change (later implementation session)

Install/bundle Fraunces and Plus Jakarta Sans only in an authorized shared-change wave; migrate src/ui/theme.ts to semantic themes; wire device-local Auto schedule, motion preference and persistence; replace literal feature colors; add shared controls/sheets/toasts/skeleton/offline primitives. Implement the explicitly requested Appearance, message action/info presentation, outgoing receipt animations and accessible Retry. Correct stale Scribble Coming soon copy. Address Expo Doctor package findings in the shared dependency wave. None of these changes were made here.
