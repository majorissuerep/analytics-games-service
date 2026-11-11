# Mafia Online: the private-table invitation

11 November 2026. Scope is the existing Coming soon preview only. No game,
rooms, roles, media permission requests, or transport implementation is added.

## Task and friction

The visitor needs to understand what is planned, how many friends could gather,
and how to return to the desktop. The previous preview had three consequential
frictions: feature badges resembled available capabilities; capacity did not
explicitly include the host in its scan-friendly summary; and identical glass
card treatment flattened status, description, and proposed play sequence.
Keep the Coming soon icon and label, 20-person cap including host, existing
instruction content, desktop exit callback, and standalone home link.

## Direct research

Sources fetched directly on 11 November 2026 using their public HTML/text.
These are pattern observations, not usability experiments or authenticated
session reviews. No copied artwork or source code.

| Source and inspected surface | Useful pattern | Unsuitable pattern / access limit |
| --- | --- | --- |
| [Board Game Arena](https://en.boardgamearena.com/), public discovery/entry page | Frames online board gaming as a shared table; separates social invitation from game detail and distinguishes play pace. | Public page only: authenticated table/lobby was not inspected. Its live “Start playing” CTA would misrepresent our planning status. |
| [Blood on the Clocktower Online](https://online.bloodontheclocktower.com/), official app entry; [official Where to Play directory](https://bloodontheclocktower.com/pages/where-to-play) | Official directory gives host, experience level, and gathering context explicit labels; a social mystery benefits from invitation language and clear expectations. | Online companion returned a JavaScript-only shell, so no in-app interaction claim. Directory inspected as fallback. No borrowed role tokens, character art, or functioning seat diagram. |
| [Whereby Meetings](https://whereby.com/information/meetings/), product overview and feature/pricing groups | Names private/locked rooms and participant capacity explicitly; browser entry and device flexibility are understandable as plain language. | Marketing overview, not a joined call or verified participant UX. Video grids, camera buttons, and participant avatars would misleadingly imply a working call here. |
| [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md), material hierarchy and legibility guidance | Bound gloss to a distinct status layer; use solid backing for text. | No native Liquid Glass claim, refraction, or decorative blur throughout content. |
| [WCAG 2.2 target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), minimum target and spacing explanation | A single explicit 44px return control is easy to locate and operate. | 24px is a minimum with exceptions, not a reason to shrink the only action. No compliance certification claim. |

Also read repository AGENTS.md, APP_PERSONALITY_BRIEF.md, APPLICATION_DESIGN.md,
DESIGN_SYSTEM_RESEARCH.md, MAFIA_ONLINE_ARCHITECTURE.md, the existing preview,
manifest, catalog roadmap browser test, shared theme, and installed Next Link docs.

## Three directions

1. **Private-table invitation (selected).** Warm opaque paper, compact status
   rail, original abstract oval table, capacity ledger, and numbered evening plan.
   Separates what this is from what it may eventually do, with no pretend lobby.
2. **Case dossier.** Tabbed evidence folder with sealed-role illustration and
   stacked briefing notes. Strong mystery character, but implies role mechanics
   more strongly than an early planning preview warrants; tabs add no real task.
3. **Conversation lobby.** Person tiles and a central room summary. Social intent
   is immediate, but an empty live-call composition implies joinable seats and
   device setup. Reject until an actual lobby exists.

The chosen invitation uses a small amount of desktop illustration and gives it
up on phones to preserve information density. There is no fake join/create CTA.

## Personality contract and implementation

Character: hospitable, discreet, curious; a gathering of people rather than a
technology demo. Palette: pink for status/capacity/return intent, muted plum for
the table motif and planned-room facts, plus warm paper and a short neutral ramp.
The original Mafia icon remains intact, including its Coming soon clock.
All token overrides live inside `.coming-soon-game`; shared shell stays XP.

Hierarchy: Coming soon status first, recognizable icon/title, concise manifest
description, 20-person capacity explicitly including host, proposed three-step
evening, explicit unavailability note, return action. The status rail alone uses
shared bounded glass. All reading content has stable opaque backing. A static
oval is an original decorative illustration, aria-hidden, with no participant
identities, seat counts, misleading status lights, or controls.

Signature interaction: the one real action returns to desktop using the existing
button callback inside a window, or semantic Next Link in standalone mode.
Shared focus, control behavior, material preference and reduced motion rules
remain in force. No asynchronous operation is introduced; shared route loading
continues to own navigation waits. No decoration moves.

Narrow composition stacks at 600px. At 320/390 the table ornament is removed,
capacity and facts share a compact summary, instruction rows stay readable, and
the return action spans the available width. No fixed content width or page-wide
horizontal scroll is introduced. Forced-colors retains borders and link identity.

## Checks and limits

Implementation checks are recorded after browser verification below. Coordinator
owns combined builds, typecheck and broader regression suite. Direct source HTML
inspection does not establish usability, clinical comfort, or production media
capacity. The architecture document remains authoritative for delivery gates.

- `npx eslint components/games/ComingSoonGame.tsx --max-warnings=0`: passed.
- Headless Chromium on coordinator dev server: standalone 1280, 390 and 320px
  reported document scroll widths equal to viewport widths; Tab focused “Back to
  desktop”. Screenshots `/tmp/mafia-{1280,390,320}.png` were captured. Visually
  inspected 320 and 390; that review exposed cramped facts beside capacity at
  320, so the final phone summary stacks capacity above wrapping facts.
- Later browser reruns timed out while waiting for app content / desktop window,
  so the final phone adjustment and desktop callback need coordinator rerun.
  Do not interpret the failed browser setup as a passed desktop interaction.
  Earlier standalone return navigated home before desktop setup was blocked.
- Reduced-motion adds no motion to this static component. Reduced-transparency
  uses the shared glass primitive without overriding its material tokens; final
  rendered solid preference and forced-colors review remain coordinator checks.
- No game/room/media API call, iframe, async state, runtime, telemetry or manifest
  change was introduced. No root build, shared edits, commit or push performed.
