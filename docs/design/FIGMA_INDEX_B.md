# Figma index B — Chat and Memories

12 October 2026. **24 local editable screen specimens created; no B Figma nodes created.**

User supplied `C:/Users/thanm/Downloads/Us — Warm Glow.png` and requested continuation without MCP. The PNG is a visual reference, not an editable Figma document.

[Open local design board](B/design-board.html) · [Verification evidence](B/verification.json) · [Midnight contact sheet](B/contact-midnight.png) · [Rose contact sheet](B/contact-rose.png) · [Noir contact sheet](B/contact-noir.png).

The self-contained board has all 24 frames below, a theme selector, motion preference specimens, beside-frame Motion notes, and local Chat/Reply/Actions/Info/Viewer/Upload preview links. Fonts are embedded from installed font packages. Media uses illustrated placeholders, not actual user photos. The board operates without network access; app actions are labeled prototypes and do not mutate data. Its CSS variables reproduce the existing theme token values; these are not live Figma variables or Components-page instances. Native Smart Animate connections remain unavailable.

Reviewed all three theme contact sheets. Browser checks covered 72 frame/theme combinations: every frame 412 × 915, no detected horizontal text overflow, both requested fonts loaded, no script errors. Default Chat shows all four outgoing statuses without history clipping. Checked 27 text/token pairs per theme: minimum contrast Midnight 4.798:1, Rose 5.086:1, Noir 4.769:1. Checks include both outgoing-gradient endpoints, incoming text and semantic text on surfaces, not every rendered pixel. Send visibility, Actions → Info, and Timeline → Upload links passed browser interaction checks. Large Android text and real keyboard behavior remain device checks.

[Existing Us — Warm Glow file](https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2).

Figma exposes create/edit tools (`use_figma`, `create_new_file`) plus metadata, screenshots, variables, components, library search, assets and motion tools. Full tool inventory: CAPABILITIES.md. The Figma connection was selected previously as recorded there. The attempted read-only inspection failed: “You've reached the Figma MCP tool call limit on the Starter plan.” No canvas write was attempted. This is a quota failure, not proof of read-only file permissions.

Detailed design specification: [FIGMA_BRIEF_B.md](FIGMA_BRIEF_B.md). The brief and local board artifacts remain uncommitted because the session authorizes committing only this index. The original quota failure below records why Figma delivery was replaced with the user-authorized local board.

## Existing references — not created or reverified by B

| Existing representative frame | Recorded node | Link |
|---|---|---|
| Chat / Conversation | 6:161 | [Open](https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2?node-id=6-161) |
| Chat / Actions + Message info | 6:206 | [Open](https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2?node-id=6-206) |
| Memories / Empty | 6:228 | [Open](https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2?node-id=6-228) |
| Memories / Timeline | 6:259 | [Open](https://www.figma.com/design/JwVhPmEJoyxV6ZO9JxfSe2?node-id=6-259) |

## B frame manifest

Each frame below exists in the local board under its matching name. **Figma node IDs do not exist.** Local anchors are stable HTML IDs, not invented Figma IDs.

| Required frame name | Node ID |
|---|---|
| Chat/Conversation/default | [Local frame](B/design-board.html#chat-conversation-default) · No Figma ID |
| Chat/Reply composing/default | [Local frame](B/design-board.html#chat-reply-composing-default) · No Figma ID |
| Chat/Message actions sheet/default | [Local frame](B/design-board.html#chat-message-actions-sheet-default) · No Figma ID |
| Chat/Message info sheet/seen | [Local frame](B/design-board.html#chat-message-info-sheet-seen) · No Figma ID |
| Chat/Message info sheet/pending | [Local frame](B/design-board.html#chat-message-info-sheet-pending) · No Figma ID |
| Chat/Image viewer/default | [Local frame](B/design-board.html#chat-image-viewer-default) · No Figma ID |
| Chat/Image viewer/loading | [Local frame](B/design-board.html#chat-image-viewer-loading) · No Figma ID |
| Chat/Image viewer/error | [Local frame](B/design-board.html#chat-image-viewer-error) · No Figma ID |
| Chat/Conversation/empty | [Local frame](B/design-board.html#chat-conversation-empty) · No Figma ID |
| Chat/Conversation/loading | [Local frame](B/design-board.html#chat-conversation-loading) · No Figma ID |
| Chat/Conversation/error | [Local frame](B/design-board.html#chat-conversation-error) · No Figma ID |
| Chat/Conversation/offline | [Local frame](B/design-board.html#chat-conversation-offline) · No Figma ID |
| Memories/Timeline/default | [Local frame](B/design-board.html#memories-timeline-default) · No Figma ID |
| Memories/Upload sheet/uploading | [Local frame](B/design-board.html#memories-upload-sheet-uploading) · No Figma ID |
| Memories/Photo viewer/default | [Local frame](B/design-board.html#memories-photo-viewer-default) · No Figma ID |
| Memories/Video viewer/default | [Local frame](B/design-board.html#memories-video-viewer-default) · No Figma ID |
| Memories/Viewer/loading | [Local frame](B/design-board.html#memories-viewer-loading) · No Figma ID |
| Memories/Viewer/error | [Local frame](B/design-board.html#memories-viewer-error) · No Figma ID |
| Memories/Timeline/empty | [Local frame](B/design-board.html#memories-timeline-empty) · No Figma ID |
| Memories/Timeline/loading | [Local frame](B/design-board.html#memories-timeline-loading) · No Figma ID |
| Memories/Upload sheet/error | [Local frame](B/design-board.html#memories-upload-sheet-error) · No Figma ID |
| Memories/Timeline/storage almost full | [Local frame](B/design-board.html#memories-timeline-storage-almost-full) · No Figma ID |
| Memories/Timeline/error | [Local frame](B/design-board.html#memories-timeline-error) · No Figma ID |
| Memories/Timeline/offline | [Local frame](B/design-board.html#memories-timeline-offline) · No Figma ID |

## Verification and handoff

- Read all five required design docs; no Code Connect files found by repository glob. Existing node references come from FIGMA_INDEX.md, not a live canvas read.
- `npx tsc --noEmit`: one reported error in another session's src/theme/ThemeProvider.tsx, unsupported StatusBar backgroundColor prop. No app source edits in B.
- `npx --no-install expo-doctor`: 19/21 passed. Failures: React Native Directory marks react-native-incall-manager/react-native-webrtc untested on New Architecture; nine installed Expo packages differ from required patch versions. Dependency remediation is a shared task; no packages changed.
- Midnight/Rose/Noir local board review, screenshots and motion boxes completed after the supplied PNG. Figma canvas validation and native Smart Animate connections remain unavailable.
- Device-only unknowns: Android text scaling, keyboard/safe areas, network/outbox recovery, backend receipt timing, permissions, media upload/download and video/gesture behavior.
- Manual review: open B/design-board.html (or the local browser preview), choose Midnight/Rose/Noir and inspect long partner names/filenames, 128 unread count, saved badges, sheets and viewer actions. Use Explore Chat/Explore Memories and Show board to switch between linked review and the complete inventory. Figma migration, if later wanted, requires actual editable file access.
- Needs shared change: requested Copy/Delete and info sheets, true Chat upload-progress telemetry, theme/receipt/animation implementation after review. No dependencies installed or shared files edited by B.
