# Us — Session A local design review

Open index.html in a browser. No server, network or package installation is required: scripts, theme tokens and font files are bundled. An optional local preview is running at http://127.0.0.1:8766/ for this working session.

This is an editable HTML/CSS design artifact based on the user's Us — Warm Glow.png and the repository screen audit. It is not an Expo implementation or editable Figma file. The PNG remains unchanged. No Figma MCP calls were made during this continuation. Figma instances/variable aliases cannot be recovered from a flattened image; reusable local render functions and CSS custom properties provide the equivalent review structure here.

## Review controls

- Theme: Midnight default; Rose and Noir plus all eight documented themes. Gallery mini-previews retain their own palettes.
- Area / Screen: inspect one composition or the whole board.
- State: Default or All states; use All states to see specialized permission, busy and validation variants.
- Motion: Full, Reduced or Off; system reduced-motion always takes priority.
- Settings, Back, Appearance, Profile, Notifications, Sign out and permission links demonstrate the proposed flow. Out-of-scope destinations show an explanatory message. No credentials, calls, uploads, notification tests or OS permission requests are sent.
- Scroll inside frames to inspect long forms/gallery content. Each frame stays 412×915. Each has adjacent Motion notes on desktop, below on narrow viewports. Browser Print can export one study per page.

71 named screen/state frames cover auth bootstrap/Splash, Login, Home, Settings Main, Appearance, Profile, Notifications and system tab/toast/dialog/sheet/skeleton/offline/permission/error specimens. See frames.json or FIGMA_INDEX_A.md for individual local anchors. These are local DOM identifiers, not Figma node IDs.

## Visual direction and scope

Fraunces expressive headings, Plus Jakarta Sans controls/body, semantic tokens copied from tokens.json, opaque layered surfaces and a restrained tonal hero. Fonts are copied from already-installed packages with their font licenses; no new dependency was added.

Both avatar initials are illustrative. The self-profile binding, requested unread badge and latest-memory thumbnail are absent from current Home queries; the 128 badge appears only in the explicitly annotated long-content specimen. No personal photo was supplied, so no fictional latest-photo asset is presented. Settings has existing name/anniversary/avatar/test-notification/sign-out actions only; Appearance and system permission wrappers remain proposed design additions.

## Verification

JavaScript syntax check passed. Browser geometry audit covers 71 frames × Midnight/Rose/Noir: all 412×915, no frame horizontal overflow, no overflowing checked heading/button/name/gallery-title text, theme variables present. qa-geometry.json records results. This audit does not prove every frame's visual contrast or TalkBack behavior.

Visually inspected Home Midnight/Rose, Login Midnight and Appearance Noir; saved screenshots are in this folder. Home spacing was tightened so all four default shortcuts fit above tabs. Gallery and longer states intentionally scroll. Browser Settings → Appearance, Rose selection and Off motion selection were exercised; browser error logs were empty. Browser computed heading family is Fraunces; local fonts loaded visibly in screenshots.

Implemented motion samples: Splash reveal, slow Login gradient (paused while editing), one small days-counter heartbeat, loading spinner/shimmer and press feedback. Parallax, theme crossfade, moving navigation pill, spring sheet transitions and focus-management contracts are motion notes for app implementation, not fully authored playback in this artifact. The HTML rerenders on theme changes; do not mistake it for app persistence.

Remaining: exhaustive visual inspection of all 213 theme/state combinations, 200% Android font scaling, native insets/keyboard, TalkBack/modal focus, actual device permission prompts, presence, push, voice/video and app preference persistence. No native build was run.

Only FIGMA_INDEX_A.md is eligible for the requested scoped commit. This artifact and the brief remain untracked under that rule; the ZIP is a portable local handoff. Do not stage other sessions' files.
