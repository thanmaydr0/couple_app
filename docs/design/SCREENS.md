# Warm Glow screen specifications

Source inventory: CURRENT_SCREENS.md. Android baseline 412×915dp. App functionality is unchanged by these documents. Existing routes remain the navigation contract; views below can be states/modals/sections of those routes. Explicit requested additions: Appearance, message actions and Message info. Profile and Notifications subviews regroup existing settings actions; they are not existing separate routes.

## Shared composition and states

24dp gutters; safe-area top and bottom measured on device. Header, content and fixed controls use vertical Auto Layout. Large display headers collapse to title/M only on scrolling screens. Five-tab navigation stays Home, Chat, Memories, Watch, Games; calls launch from Home or call history. Fixed bottom composer/controls must stay above Android keyboard/navigation. Content scrolls under fixed chrome without obscuring the last item. Do not fill empty data with invented content.

Every network surface uses: loading skeleton matching final geometry (static in Reduced/Off); contextual empty state with only an existing action; inline error with retry where implemented; offline/reconnecting banner retaining saved content where available. If a source does not expose a loading/offline signal, label its design as a handoff requirement rather than pretending it exists. Local menus and choice dialogs have no artificial network spinner. Never clear saved content to show a retry error.

Default motion: 8dp/240ms enter; 0.96/90ms press down and snappy release; 240ms page transition; sheet gentle spring with fade overlay; 160ms dismiss; preserve focus and Android back behavior. Reduced removes movement and loops, uses ≤160ms fade. Off switches immediately. Announce status changes once; avoid screen-reader chatter for timers.

## Auth and Home

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion and special moments |
|---|---|---|---|
| Login | “Us” wordmark, Fraunces “A little closer.”, brief admin-account explanation, labeled email/password, primary Sign in. Centered scrollable form; no signup/reset invention. | Busy label and disabled fields; missing-config/auth/validation inline alert; network error preserves input; no empty account list. | Form fades as a group; button feedback; errors crossfade without shaking password fields. |
| Auth gate | Full-screen bootstrap; unpaired message and admin guidance, Try again/Sign out; modal accessibility scope. | Skeleton while session/profile loads; unpaired state; retry + sign-out error; network uses friendly error. | 160ms fade to resolved screen; never reveal blocked content to accessibility. |
| Home | Large “Our space” header + Settings icon. Partner avatar/status card with two call buttons; optional anniversary number card; four navigation cards in existing order. | Partner/couple skeleton; no anniversary means omit card; fallback initials/name/last-seen; query error retry; offline status must not claim partner is online. | Cards enter with 40ms stagger; days count uses static number unless data genuinely changes; presence dot crossfades. No fabricated recent chat preview. |
| Games hub | Header “Play together”; two large cards, Chess and Scribble, each with description and Open action. | Static menu: no artificial loading/error/offline gate; game-specific network states begin after navigation. | Press surfaces tint and scale; replace stale Coming soon copy during later implementation. |

## Chat

Conversation uses partner header, reconnect/error banner, day chips, grouped message rows, new-message jump pill, typing row, reply preview/emoji strip and bottom composer. Bubble maximum width 85% (approximately 309dp within 364dp content), 12/16 padding, 20dp radius with grouped-side 8dp. Body/M, caption timestamp fully opaque. Incoming aligns left, outgoing right. Images use portrait crop preview and contain viewer; quoted messages have left rule and two-line snippet. Preserve anchored history when loading earlier messages.

| State/view | Layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Conversation | Avatar header, text/image/reply bubbles, day chip, composer image/emoji/send controls. Long press opens requested actions sheet. | Initial cache skeleton; empty “Say hello”; older-history spinner only at history edge; sync banner + retry; cached messages remain visible offline; failed outbox items retain content and retry. | New outgoing rises 8dp; incoming fades only when near bottom; never auto-scroll someone reading history. New messages pill fades in. |
| Reply composer | 3dp rule, sender, one-line text/photo label, Cancel 48dp target above input. | Unresolved original says Earlier message; preserve draft if fetch fails. | Height expands 160ms without moving scroll anchor; cancel collapse. |
| Image viewer | Full-screen opaque bg, contain image, safe-area Close target. Existing chat viewer has no zoom; do not depict zoom controls. | Photo loading/retry; cached image if available; unavailable state stays dismissible offline. | Fade 240ms; no unsupported shared-image gesture promised. |
| Message actions (requested addition) | Bottom sheet: Reply for server-confirmed message; Message info for outgoing message; Retry only for failed outgoing message. No edit/delete/forward/copy actions invented. | Pending message cannot reply to an unconfirmed id; failed state Retry; no network fetch required for loaded metadata. | Gentle sheet enter; focus first action, restore focus on dismiss. |
| Message info (requested addition) | Selected outgoing snippet; “Sent” + created_at, “Seen” + read_at. Localized date/time with accessible full date. | status sent: canonical server created_at; no read_at: “Not seen yet”. Sending/failed: show “Queued” local timestamp and “Not sent yet”; do not call enqueue time a sent time. | 160ms sheet content fade; live receipt update preserves layout. |

### Exact outgoing message status contract

Derive display status in order: sending → failed → (sent and read_at ? seen : sent). Outgoing messages only, beside timestamp. Incoming messages show timestamp without ticks. Data and optimistic send provenance are in CURRENT_SCREENS.md.

| Status | Visual | Ink / behavior |
|---|---|---|
| Sending | Clock with rotating hand in Full; static clock in Reduced/Off | tickSent, accessible “Sending”. Time is queued time until confirmed. |
| Sent | One vector tick | tickSent, muted but 4.5:1 on bubble; accessible “Sent”. No claim of device delivery. |
| Seen | Two vector ticks | tickSeen bubble-local accent; second stroke draws over 160ms while ink tweens over 240ms. Accessible “Seen”. Reduced fades, Off immediate. |
| Failed | Warning glyph and “Couldn’t send · Retry” below bubble | danger on bg, 48dp retry target; accessible “Failed, tap to retry”. Same client_id on retry; no duplicate message. |

Outgoing image and reply bubbles follow the same receipt system. Optional animations do not delay the canonical status update. Do not retain the current latest-only Seen heart in addition to double ticks.

## Memories

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Timeline | Large header, count and Add, compact storage card with Download all/Clear cache, month/day sticky headers and three-column grid. Video duration, saved badge with readable backing. | Skeleton grid; first-memory state + Add; inline sync/tile retry; offline banner and downloaded badge; Add disabled offline; storage pressure warnings remain actionable. | Tile press scale; short grid enter only for newly added items; sticky header transition 160ms. |
| Upload (inline queue) | Sheet-like inline job cards under storage; filename, human status, percentage/progress, failed Retry. Picker remains Android system UI. | Waiting/preparing/uploading/done/failed/skipped; permissions denied alert; cancel leaves timeline; show actual per-job state, not simulated progress. | Determinate progress linear; done check fade; no looping decoration in Reduced/Off. |
| Photo viewer | Full-screen, safe-area Close/index, photo, date, caption field, Save caption/Save gallery/Share; Delete only uploader. | Download spinner and Retry; busy disables conflicting actions; permission/share/save errors; downloaded originals open offline, uncached needs network. | Existing pinch/pan stays direct manipulation; double-tap reset gentle spring; swipe paging, no extra gesture competing with zoom. |
| Video viewer | Same metadata/actions with native video controls; pause when page inactive. | Download/decoder errors, busy and offline handling as photo. | Paging transition; no decorative animation over playback. |
| Delete / clear-cache confirmations | Dialog names exactly what is removed. Delete removes shared original for both; clear cache only this account’s offline copies. | Local confirm; operation busy/error comes from existing action. | Fade overlay and gentle dialog scale; danger action separate from Cancel. |

## Watch together

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Lobby | Header, local-file explanation, Pick movie CTA, active invite/return cards with readable size/duration; end action + refresh. No streaming catalog. | Profile/partner loading; no sessions; file reading busy; permission/metadata/backend error; lobby offline banner requires exposed signal later, preserves invitations. | Invite card fades on arrival; press feedback; native file picker transition. |
| Verification | Movie title, session vs local size/duration rows, Pick copy, mismatch warning, Choose another / Continue anyway confirmation. | Initial session skeleton is missing in code and specified for later handoff; remembered matching copy proceeds; mismatch blocks unless explicit override; ended state + Back; reload error. | Comparison rows appear together; mismatch warning fades, never a celebratory pass before acceptance. |
| Player portrait / landscape | Actual local video, controls ±10s/play/scrub/time/fullscreen, reaction row; status Both ready/Waiting/Buffering; Reconnect/change-file/end below. | Both pause on buffering/disconnect/background; ready gates play/seek; absent partner card; decode/rotation/sync errors; session-ended return state. | Controls fade 160ms, existing 5s hide timeout; reactions float only Full, Reduced short fade, Off static brief feedback. Landscape restores orientation. |

## Chess

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Lobby | Header, partner/live status, choose color segmented control, New/Resume card, completed count and result/rematch. | Query skeleton; no partner/link prompt; new game busy; refresh/restoration error; connection banner retains last board. | Color selection pill 160ms; new/resume transition 240ms. |
| Board | Turn/check/saving heading, captures, 8×8 oriented board, material, nudge/draw/resign controls, scrollable move list. | Saving locks moves; no moves hint; invalid board retry; offline board retained, no offline-success claim; pending draw offer with accept/decline. | Selected/legal squares fade; piece move 160ms design target; check uses outline + label, not color alone. Avoid animated board rotation mid-match. |
| Promotion | Modal with four labeled piece options and Cancel. | Local choice; disable when no longer legal/my turn; move errors inline on board. | Gentle sheet/modal; return focus to board. |
| Game over / draw / resign | Result card above final board, reason, rematch swap colors. Existing resign confirmation and draw offer state. | Win/loss/checkmate/resign/stalemate/draw reason; rematch busy/error; final board readable offline. | Small 400ms success bloom in Full, no fake confetti; Reduced fade. |

## Scribble

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Lobby | Quiet drawing motif, instructions, rounds 2–10 stepper, Start, match rows with round/date/resume. | Missing dedicated initial list-loading signal: handoff gap; empty first match; profile/action errors + Refresh; unpaired start disabled. | Stepper press feedback; rows fade on genuine insertion. |
| Word pick | Shared score header, drawer sees private choices, guesser sees waiting. | Options/restoring, busy lock; paused banner; failed choice keeps options. | Choices 40ms stagger Full; no secret revealed to guesser. |
| Draw | Secret word, round/timer, square white drawing canvas, expanded 48dp touch targets around palette/brush/eraser/undo/clear. | Restoring secret, no guesses prompt, capacity limit message; pause until both ready; tools disabled while blocked. | Strokes track finger immediately; timer never bounces; last 15s label + icon, no flashing; clear confirmation. |
| Guess | Mask and hints, shared canvas, feedback feed, input + Send. | Empty feed; paused disabled composer; close/correct feedback; sync error; timer resumes only when both ready. | Guess feed fades; correct feedback small spring only Full; preserve keyboard and scroll. |
| Round summary | Revealed word, solved/time-up, points, next-round drawer or waiting handoff. | Zero-point outcome explicit; next busy/error; pause banner until resumed. | Word reveal 240ms, score update 400ms; Reduced static value/fade. |
| Results | Final scores, win/tie, Play again/Back. | Replay busy/error; final scores stay visible offline. | Small bouncy result accent Full; no clip-art hearts; Off immediate. |

Drawing colors and white canvas are immutable user content, not theme recoloring. Use content primitives for brush palette; max-two-accent rule applies to app chrome, not drawings.

## Calls

| Screen/state | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Idle and Recent | Voice/video primary cards, notification setup, call history row with direction/type/status/date/duration and callback. | Service readiness; history skeleton/empty/retry; notification registration notice; offline disables starting when engine not ready. | Row press feedback, history fade; no auto-call on decorative preview. |
| Incoming | Large avatar/name and call type, incoming label, Decline/Accept controls. Global modal accessible from any route. | Avatar fallback; permission failure; stale/ended invite leaves through engine. | Subtle ring glow only Full; accept/decline remain stationary 64dp targets; Android back cannot accidentally hide call. |
| Preparing / outgoing / connecting | Avatar/name/status, Cancel until active. | Getting ready spinner, calling, connecting; actionable permission/engine error; recovery. | Slow breathing glow Full; static status Reduced/Off. |
| In-call audio | Avatar, name, tabular timer, mute/output/end; audio-route selection dialog. | Media/route errors retain call; Bluetooth permission state; unavailable routes omitted. | Timer updates without scale; control selection tint 160ms; end destructive. |
| In-call video | Remote video full bleed, readable opaque/scrim-backed header/controls, draggable self preview, mute/camera/flip/output/end. | No remote frame falls back to identity; camera off preview icon; errors; reconnect overlay. | Self-preview follows drag directly; no ornamental video filter; control fades. |
| Reconnecting | Clear overlay + spinner/label over preserved identity/video state; End available. | Network/media recovery, existing engine failure/timeout messages. | Static banner in Reduced/Off; status announced once per phase. |

## Settings

| Screen/view | Purpose / layout / components | Loading, empty, error, offline | Motion |
|---|---|---|---|
| Main | Profile, anniversary, Stay connected sections + sign-out; route /settings. Optional regrouped subview navigation must be implemented later. | Query skeleton/retry; blank anniversary hides counter; mutation busy; friendly errors; no fictional saved-offline confirmation. | Card enter; success toast or inline confirmation for real completed mutations. |
| Profile subview (existing actions regrouped) | Avatar/change, name max80, Save name, anniversary date or blank + Save. | Avatar upload/cancel/permission; invalid name/date; per-action busy, network failure preserves fields. | Avatar crossfade; valid save check fade. |
| Notifications subview (existing actions regrouped) | Explain Android notification/battery settings; Test notification and actual result. | Testing/provisioning/remote-delivery errors; no unsupported notification preference toggles. | Busy indicator; result stays until dismissed/new test. |
| Appearance (requested NEW design) | Theme gallery with eight labeled preview cards showing heading, both chat bubbles and selected radio/check; Auto day/night explanation. Accent swatches reflect selected theme's two curated accents. Full/Reduced/Off segmented control. | Local controls; preview loading only for assets; no backend empty state; selected state and text scaling. Persistence/apply errors are implementation requirements, not existing behavior. | Theme change 240ms crossfade Full, 160ms Reduced, immediate Off; live motion sample respects selected mode. |

Accent swatches are informational palette previews in this design. Arbitrary accent overrides are not built and have not been contrast-verified; keep them non-interactive until a constrained, validated implementation is separately agreed.

## System pieces

- Tab bar: five equal 48dp-minimum targets, icon + label, active rounded pill; only pill moves 160ms. Reduced fades and Off immediate. State available beyond color through label/shape.
- Toast: concise result, optional existing retry action, max two text lines, safe-area above composer/tab bar. 240ms fade/8dp enter; no auto-dismiss of critical failure.
- Dialog: title/body/Cancel/action, focus containment, Android back cancels except call modal behavior. Sheet: 28dp top radius, drag handle, safe-area padding; actions ≥48dp; no essential swipe-only action.
- Skeleton: exact card/list geometry; Full gentle shimmer, Reduced/Off static shapes. Screen-reader exposes one Loading status instead of each shape.
- Offline banner: Wi-Fi-off icon, explicit saved-content limitation and existing Retry. Do not claim a reliable offline queue outside chat/media behavior audited above.
- Permission explanation sheets: describe photos/gallery, microphone/camera, notifications/Bluetooth only when existing operation needs them; then invoke native Android prompt. Denied state explains Android Settings. Custom sheet is a design wrapper, not a replacement OS permission dialog.
- Error screen: contextual heading, retained input/content where possible, retry/sign-out/back only where source supports them. Never raw secrets, stack traces or configuration values.
