# Us — Warm Glow

An intimate, modern, calm Android space for two, with a little playfulness where the existing app gives people a moment together. Default visual direction: Midnight, deep indigo with a warm pink glow. Layered opaque surfaces do most of the work; restrained tonal gradients give outgoing messages and a small hero surface warmth.

## Visual grammar

- Use an 8dp layout rhythm with 4dp optical steps. Screen gutters 24dp, section gaps 24/32dp, related controls 8/12dp. Cards 20dp radius, large cards/sheets 28dp; fields 16dp. Keep at least 48dp touch targets.
- Fraunces for expressive display headings and moments; Plus Jakarta Sans for titles, controls, body and captions. Maximum two font families. Do not use display type in chat body, timers or compact navigation.
- Readable first: normal text, muted metadata and bubble timestamps at least 4.5:1 in every theme; controls and focus indicators at least 3:1. Never dim important metadata with opacity. Text scale must reflow, not truncate actions.
- Maximum two decorative accent hues per theme. Semantic success/warning/danger are for feedback only. Gradient stays within a hue family; no rainbow chrome or saturated full-screen glows.
- Use editable line icons and real photo content when supplied; no clip-art hearts, sticker mascots or repeated heart glyphs as navigation decoration. The wordmark “Us” and quiet curved geometry carry intimacy.
- Give every touch target clear pressed, disabled and busy feedback. Press scale 0.96 with snappy spring, surface tint and optional existing haptics. A busy operation keeps its label and progress meaning.
- Keep destructive actions visually separate and confirm existing destructive behaviors. Never turn cache clearing into deleting shared originals.

## Motion and tone

Fade/translate entrances by 8dp over 240ms; limit stagger to short groups. Gentle spring for sheets, snappy for toggles and press release, bouncy only for a small successful game moment. Full/Reduced/Off are design additions; respect system reduced motion. No decorative motion during typing, reading or an urgent call decision. Existing video, drawing, timer and sync behavior remain functional.

Use direct, warm language: “Waiting for your partner”, “Saved on this phone”, “Try again”. Preserve actionable technical file-match requirements, but move raw diagnostics out of the main visual hierarchy. Never promise files are uploaded in Watch: each person uses a local copy.

## Theme character

Auto is Rose by day and Midnight by night. Noir is true AMOLED black with white type and a soft red accent; Rose is blush/cream; Sunset is plum/coral/amber; Ocean deep teal/aqua; Lavender light lilac/violet; Forest moss/sage/gold. Themes share geometry and semantics. Color changes never add features or hide status.

## Handoff boundaries

This session delivers design docs and Figma only. CURRENT_SCREENS.md is the source inventory; SCREENS.md describes the redesign. Appearance and Message info/action sheets are requested additions and are explicitly labeled. Existing profile/notification controls may be presented as subviews but do not currently have separate routes. Fonts, theme application and animation preferences require later app work.
