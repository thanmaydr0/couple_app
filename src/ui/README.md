# Warm Glow shared UI

`src/theme` owns the exact fallback tokens copied from `docs/design/tokens.json`.
Figma Variables were attempted on 12 October 2026; the tool returned the Starter plan quota limit.
Auto follows Android's system color scheme, as requested (Rose light / Midnight dark), rather than the design document's clock rule.
The default is Midnight. Preferences hydrate before the app leaves the splash screen.
Fonts are bundled JS assets: Fraunces Semibold and Plus Jakarta Sans Regular/Medium/Semibold/Bold; no native rebuild or config plugin was added.

## APIs

- `useTheme()` exposes colors, spacing, radius, typography, geometry and elevations. Use `useThemeStyle()` for animated semantic color properties.
- `useThemeStore()` owns `themeId`, `accentOverride`, `animationLevel` and setters. `useAppearanceStatus()` reports persistence failures. Accent IDs are the eight theme names; null restores the theme primary. Overrides preserve hue and adjust luminance until primary passes 4.5:1 on all four surfaces; their foreground is selected for AA. Bubble receipts stay bubble-local and unchanged.
- `useMotion()` combines local preferences with the live Android reduction setting. `duration(name)` and `spring(name)` are worklet-safe. Below Full, use a timing fade instead of spatial springs. Off returns zero duration. Decorative loops/particles/parallax are disabled below Full; direct manipulation remains functional.
- `StaggerList` animates the first eight children by default; supply `firstScreenful` for the actual initial viewport. Paginated/virtualized feature lists should apply `FadeInView` only to initially visible items and preserve item keys.
- `BottomSheet` snap points are fractions of available height. Drag the handle, use its accessibility expand/collapse actions, tap Close/backdrop, or use Android Back. `Dialog` uses a native modal window for focus containment.
- Wrap the application in `ToastProvider`; `useToast().show({ message, kind, actionLabel, onAction })` replaces the current toast. Errors and actionable toasts remain until dismissed. Informational timeouts honor Android accessibility recommendations.
- `AnimatedBottomTabBar` is a standalone controlled component. Home owns the router adapter and future Settings entry point. The existing tabs layout is unchanged.
- `OfflineBanner` takes actual offline state from its feature; it does not infer connectivity or promise queued writes.
- `MessageStatusTicks` takes presentation status only. Features must derive seen from confirmed read receipts; no messaging logic was changed. Sent/seen are intended for the mine bubble gradient; failure is intended for the page surface.

## Compatibility

All original barrel exports and direct import paths remain. Button accepts original Pressable props and title; IconButton retains name/accessibilityLabel; Text accepts native Text props; Screen retains centered/bottomInset/style; Avatar retains name/uri/size; Card retains View props; FormField retains label and TextInput props. LoadingScreen and TodoScreen remain available.

The deprecated `src/ui/theme.ts` maps every old color/spacing/radius key to the new system. Render-time getters follow the active palette; values already captured in a feature's module-level StyleSheet remain snapshots. Full recoloring of those feature-owned styles requires their later presentation-only restyle. Existing data hooks, routes, queries, channels and feature stores were not modified.

Run `npx tsc --noEmit` and `node src/ui/check-exports.cjs <baseline-ref>` to validate original exports, import paths, prop contracts, exact fallback token values and all 64 accent/theme contrast combinations. Without a ref, the checker compares against HEAD.

## Design Lab / Android checks

In a development client, tap the temporary flask button at the top right, or navigate to `/ui-lab`. The route and entry are guarded by `__DEV__`; the release route redirects home. No backend writes occur in Lab.

Inspect all eight palettes, swatches, typography, enabled/disabled/busy buttons, field focus/error, selection controls, avatar failure fallback, badge, cards/rows/header, loading/empty/error/offline, receipts, typing, entrances, rings, count-up, parallax, particles, tabs, gradient, sheet/dialog and toast. Pause the receipt cycle and choose Sent then Seen to inspect the second stroke drawing in.

Device checklist:

1. Change theme/accent/motion; restart and confirm persistence. Toggle Android light/dark with Auto selected and reduce motion with Full selected.
2. Check font-loading cold start, large font scaling and TalkBack labels/focus/actions; check legacy screens for layout regressions.
3. Test sheet snap points, expanded content scrolling, backdrop and Android Back; test dialog busy and destructive variants, toast accessibility timing and retry.
4. Confirm count-up, receipt draw-in, haptics and Skia particle performance; Reduced must suppress loops/travel/particles, Off must update immediately.
5. Compare font/icon rendering and spacing with the Figma frames when quota access returns.

No emulator/device or native build was used. A JS Android export is not a device runtime test. Expo Doctor currently reports existing patch-version mismatches and untested New Architecture metadata for the call libraries; dependency upgrades are outside this task.
