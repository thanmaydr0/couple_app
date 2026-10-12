# Warm Glow tokens

Source of truth: `tokens.json`. Rebuild and verify with `python docs/design/build_tokens.py`. Values below are design specifications, not installed app tokens.

## Color

Auto resolves Rose from 07:00–18:59, Midnight from 19:00–06:59 in device local time. Figma Auto is a static daytime specimen; it cannot follow the clock. Night preview uses Midnight. Maximum two decorative accent hues per theme; semantic feedback colors are reserved for their status meanings.

### Auto

| Token | Value |
|---|---|
| bg | `#FFF5F1` |
| bgElevated | `#FFFFFF` |
| surface | `#F9EAE6` |
| surfaceAlt | `#F1DCD7` |
| border | `#8E6669` |
| textPrimary | `#342029` |
| textSecondary | `#60434D` |
| textMuted | `#74535D` |
| primary | `#8A294B` |
| primaryContrast | `#FFFFFF` |
| accent | `#744A77` |
| success | `#275E41` |
| warning | `#77500A` |
| danger | `#9A233C` |
| bubbleMineStart | `#8A294B` |
| bubbleMineEnd | `#723047` |
| bubbleMineText | `#FFFFFF` |
| bubbleTheirs | `#F1DCD7` |
| bubbleTheirsText | `#342029` |
| tickSent | `#E8CAD8` |
| tickSeen | `#FFFFFF` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Midnight

| Token | Value |
|---|---|
| bg | `#131321` |
| bgElevated | `#1B1B2D` |
| surface | `#222238` |
| surfaceAlt | `#2B2B43` |
| border | `#77758D` |
| textPrimary | `#FFF7F3` |
| textSecondary | `#D4CDDE` |
| textMuted | `#BAB2C8` |
| primary | `#F0A9BD` |
| primaryContrast | `#261620` |
| accent | `#C4B5FD` |
| success | `#B1DDBF` |
| warning | `#F3D08C` |
| danger | `#FFB4BE` |
| bubbleMineStart | `#F0A9BD` |
| bubbleMineEnd | `#DDA1C7` |
| bubbleMineText | `#261620` |
| bubbleTheirs | `#2B2B43` |
| bubbleTheirsText | `#FFF7F3` |
| tickSent | `#503C49` |
| tickSeen | `#302739` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Noir

| Token | Value |
|---|---|
| bg | `#000000` |
| bgElevated | `#0C0C0C` |
| surface | `#151515` |
| surfaceAlt | `#222222` |
| border | `#777777` |
| textPrimary | `#FFFFFF` |
| textSecondary | `#D4D4D4` |
| textMuted | `#B5B5B5` |
| primary | `#FFAAAA` |
| primaryContrast | `#260D0D` |
| accent | `#FFC0C0` |
| success | `#B1DDBF` |
| warning | `#F3D08C` |
| danger | `#FFB4BE` |
| bubbleMineStart | `#FFAAAA` |
| bubbleMineEnd | `#F29B9B` |
| bubbleMineText | `#260D0D` |
| bubbleTheirs | `#222222` |
| bubbleTheirsText | `#FFFFFF` |
| tickSent | `#503C49` |
| tickSeen | `#302739` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Rose

| Token | Value |
|---|---|
| bg | `#FFF5F1` |
| bgElevated | `#FFFFFF` |
| surface | `#F9EAE6` |
| surfaceAlt | `#F1DCD7` |
| border | `#8E6669` |
| textPrimary | `#342029` |
| textSecondary | `#60434D` |
| textMuted | `#74535D` |
| primary | `#8A294B` |
| primaryContrast | `#FFFFFF` |
| accent | `#744A77` |
| success | `#275E41` |
| warning | `#77500A` |
| danger | `#9A233C` |
| bubbleMineStart | `#8A294B` |
| bubbleMineEnd | `#723047` |
| bubbleMineText | `#FFFFFF` |
| bubbleTheirs | `#F1DCD7` |
| bubbleTheirsText | `#342029` |
| tickSent | `#E8CAD8` |
| tickSeen | `#FFFFFF` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Sunset

| Token | Value |
|---|---|
| bg | `#21131F` |
| bgElevated | `#2C1C29` |
| surface | `#352334` |
| surfaceAlt | `#402D3F` |
| border | `#9C788D` |
| textPrimary | `#FFF6EF` |
| textSecondary | `#E4C9D8` |
| textMuted | `#C9AFC1` |
| primary | `#FFB29D` |
| primaryContrast | `#30171C` |
| accent | `#F7CB81` |
| success | `#B1DDBF` |
| warning | `#F3D08C` |
| danger | `#FFB4BE` |
| bubbleMineStart | `#FFB29D` |
| bubbleMineEnd | `#ECA2A6` |
| bubbleMineText | `#30171C` |
| bubbleTheirs | `#402D3F` |
| bubbleTheirsText | `#FFF6EF` |
| tickSent | `#503C49` |
| tickSeen | `#302739` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Ocean

| Token | Value |
|---|---|
| bg | `#071E23` |
| bgElevated | `#102A30` |
| surface | `#18343B` |
| surfaceAlt | `#213F46` |
| border | `#69979F` |
| textPrimary | `#F0FDFA` |
| textSecondary | `#C1DEDE` |
| textMuted | `#A8C7CC` |
| primary | `#91DED4` |
| primaryContrast | `#102B2A` |
| accent | `#A5CAFF` |
| success | `#B1DDBF` |
| warning | `#F3D08C` |
| danger | `#FFB4BE` |
| bubbleMineStart | `#91DED4` |
| bubbleMineEnd | `#A5CFD2` |
| bubbleMineText | `#102B2A` |
| bubbleTheirs | `#213F46` |
| bubbleTheirsText | `#F0FDFA` |
| tickSent | `#503C49` |
| tickSeen | `#302739` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Lavender

| Token | Value |
|---|---|
| bg | `#F8F4FF` |
| bgElevated | `#FFFFFF` |
| surface | `#EEE7FA` |
| surfaceAlt | `#E4DBF3` |
| border | `#867397` |
| textPrimary | `#30223F` |
| textSecondary | `#58476D` |
| textMuted | `#6B597E` |
| primary | `#67429A` |
| primaryContrast | `#FFFFFF` |
| accent | `#8A356F` |
| success | `#275E41` |
| warning | `#77500A` |
| danger | `#9A233C` |
| bubbleMineStart | `#67429A` |
| bubbleMineEnd | `#59398B` |
| bubbleMineText | `#FFFFFF` |
| bubbleTheirs | `#E4DBF3` |
| bubbleTheirsText | `#30223F` |
| tickSent | `#E8CAD8` |
| tickSeen | `#FFFFFF` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

### Forest

| Token | Value |
|---|---|
| bg | `#111B14` |
| bgElevated | `#1B281E` |
| surface | `#253328` |
| surfaceAlt | `#303F32` |
| border | `#809881` |
| textPrimary | `#F7F9EF` |
| textSecondary | `#D3DFCF` |
| textMuted | `#B5C8B1` |
| primary | `#BDD3AA` |
| primaryContrast | `#1C2B16` |
| accent | `#E7CC8B` |
| success | `#B1DDBF` |
| warning | `#F3D08C` |
| danger | `#FFB4BE` |
| bubbleMineStart | `#BDD3AA` |
| bubbleMineEnd | `#C9CAA0` |
| bubbleMineText | `#1C2B16` |
| bubbleTheirs | `#303F32` |
| bubbleTheirsText | `#F7F9EF` |
| tickSent | `#503C49` |
| tickSeen | `#302739` |
| overlay | `#000000B8` |
| shadowColor | `#000000` |

`bubbleMineStart` / `bubbleMineEnd` are the requested bubbleMine gradient endpoints. tickSent and tickSeen are bubble-local semantic inks: muted single tick and accented double tick. Do not substitute page primary on a similarly colored bubble. Double-tick shape also conveys seen status. Error status lives below the bubble on bg using danger, with a warning glyph and Retry label.

All listed text tokens pass 4.5:1 on all four background surfaces, and primaryContrast on primary, both bubble text pairs, and both ticks across the mine gradient pass. Exact results: CONTRAST.md. Border is a functional control outline, not body text; decorative dividers may be subtler.

## Geometry

Spacing: 4, 8, 12, 16, 20, 24, 32, 40, 56 dp. Layout uses an 8dp rhythm; 4/12/20 are optical substeps. Radii: 8, 12, 16, 20, 28, pill=999. Typical cards 20, sheets 28 at top, fields 16, bubble 20 with grouped-side 8. Minimum interactive target 48×48dp; small visual controls retain an expanded target. Android frames 412×915, safe-area insets measured at runtime.

## Type

| Style | Font | Size | Line | Weight | Tracking |
|---|---|---:|---:|---:|---:|
| display/XL | Fraunces | 48 | 56 | 600 | -1 |
| display/L | Fraunces | 40 | 48 | 600 | -0.8 |
| display/M | Fraunces | 32 | 40 | 600 | -0.5 |
| title/L | Plus Jakarta Sans | 26 | 34 | 700 | -0.4 |
| title/M | Plus Jakarta Sans | 22 | 30 | 600 | -0.2 |
| title/S | Plus Jakarta Sans | 18 | 26 | 600 | 0 |
| body/L | Plus Jakarta Sans | 18 | 28 | 400 | 0 |
| body/M | Plus Jakarta Sans | 16 | 24 | 400 | 0 |
| body/S | Plus Jakarta Sans | 14 | 22 | 400 | 0 |
| label | Plus Jakarta Sans | 14 | 20 | 600 | 0.2 |
| caption | Plus Jakarta Sans | 12 | 18 | 500 | 0.2 |

Sizes/line heights are sp; tracking is dp at baseline scale. Use tabular numerals for clocks. Respect Android font scaling; expand cards and scroll instead of clipping. Font styles verified in Figma: Fraunces SemiBold, Plus Jakarta Sans Regular/Medium/SemiBold/Bold.

## Elevation

All shadows use shadowColor with the listed opacity. Borders and surfaces must carry hierarchy in AMOLED; shadows are supplementary.

| Level | Offset x/y | Blur | Spread | Opacity | Android dp |
|---|---|---:|---:|---:|---:|
| 0 | 0/0 | 0 | 0 | 0 | 0 |
| 1 | 0/2 | 8 | 0 | 0.12 | 1 |
| 2 | 0/4 | 16 | 0 | 0.16 | 3 |
| 3 | 0/8 | 24 | 0 | 0.2 | 6 |
| 4 | 0/16 | 40 | 0 | 0.24 | 12 |

## Motion

Durations: instant 90ms; fast 160ms; base 240ms; slow 400ms; hero 600ms. Stagger 40ms, press scale 0.96.

| Spring | Damping | Stiffness | Mass |
|---|---:|---:|---:|
| gentle | 24 | 180 | 1 |
| snappy | 26 | 320 | 0.8 |
| bouncy | 14 | 220 | 0.9 |

Easing cubic Béziers: standard (0.2,0,0,1), enter (0,0,0.2,1), exit (0.4,0,1,1), linear (0,0,1,1). Full: tokens as written. Reduced: no spatial travel, bounce, parallax or looping shimmer; fade ≤160ms, static typing and clock glyphs. Off: immediate state changes, no animated interpolation. Functional progress/timers and video remain legible and update without decorative motion. System reduce-motion takes precedence over Full.
