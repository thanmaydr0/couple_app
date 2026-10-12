# Games presentation restyle — r4

Built from the local PNG references indexed by docs/design/FIGMA_INDEX_C.md (which records the earlier Us — Warm Glow.png direction). No Figma MCP used.

## Built
- Games: two themed, press-scale cards with staggered entrance and current Scribble copy.
- Chess: theme squares, original SVG silhouettes with contrasting outlines, selection lift/haptic, spring slides (including the castling rook), fading last-move outline, staggered legal-move pops, pulsing check outline plus explicit check label, fading/shrinking captured pieces and tray entrances, avatar ring, waiting dots, promotion BottomSheet, win Burst, calm result fade, existing rematch, AnimatedNumber lobby tallies.
- Scribble: token-based chrome and shared Header/Button, 48dp palette/brush targets, word-card stagger and selection feedback, sliding toolbar, animated palette rings, brush preview, themed canvas frame, warning/danger countdown ring with pulse outside the drawing surface, flipping hints, first-screenful feed entrances, close-guess input shake, score count-up, round transitions, podium and winner Burst.
- Game data hooks, rules, types, routes, scoring, persistence, stroke model, gesture callbacks and network channels are unchanged. No dependencies installed and no native build.

## Verification
- `npx --no-install tsc --noEmit`: passed after fixing owned-file errors.
- Existing chess verifier: passed legality, checkmate/draw variants, restoration, castling, en passant, material/captures, four promotions and corrupt history.
- Existing Scribble verifier: passed two-player flow, scoring, hints, strokes/eraser/undo/clear, pause/reconnect/recovery, alternating turns, timeout and persisted final scores.
- `npx --no-install expo-doctor`: 19/21. Existing calling-library New Architecture metadata and nine Expo patch-version mismatches remain; shared dependencies were left untouched.
- `git diff --check`: passed. Verified no diff in rules, data hooks, model, or DrawingCanvas.

## Device verification and manual checklist
No Android rendering, font scaling, AA composite contrast, haptics, animation timing, keyboard layout, actual Realtime delivery or 60fps measurement was available here. Existing canvas frame coalescing and cached paths are untouched; decorative effects do not overlay its surface.

On both phones:
1. Chess: complete a game including check/checkmate; test castling/en passant, every promotion, resign, draw and rematch; verify both board orientations and capture animations.
2. Scribble: play six rounds, alternate drawers, check live strokes/eraser/undo/clear, close/correct guesses, score updates, both hints, timeout, final winner/tie and replay.
3. Disconnect/reconnect and background each phone; check retained board/drawing and existing pause behavior.
4. Review Midnight/Rose/Noir, large system text, and Full/Reduced/Off motion. Check at least 48dp controls, keyboard visibility and smooth strokes.

## Deviations from the reference/request
- At narrow widths, the chess board scrolls horizontally to retain true 48dp square targets. The PNG's fit-to-width squares are smaller.
- Captures shrink/fade at their square and enter the tray independently; there is no measured cross-screen flight path.
- Original vector silhouettes replace the reference's font glyph pieces. Colors and typography map to existing tokens, rather than copying PNG pixels.
- Initial Scribble loading has no dedicated signal in the existing data hook; the restyle retains its existing empty/loading behavior rather than inventing state.
- Correct-guess celebration occurs in the solved round summary; the drawing surface remains free of decorative overlays.

## Needs shared change
No shared-file edit or dependency is required. Feature-local presentation helpers were added in chess/presentation.tsx and scribble/presentation.tsx; they may be promoted to src/ui in a future shared task. Dependency/Doctor warnings and a dedicated Scribble loading signal require a separate authorized shared/data task if desired.
