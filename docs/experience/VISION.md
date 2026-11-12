# Experience constitution

The latest user request is authoritative. This document is the shared product
contract; app contracts specify the workspaces, controls and states that implement
it. A successful command, CSS token or screenshot file is not acceptance.

## Product character

Keep the XP desktop, title bars, window boundaries and native window controls.
Inside: use the deliberate task hierarchy of elementary OS and the soft, rounded
surface treatment of Zorin OS, with original glossy materials. References inform
composition and interaction; do not copy their branding, assets or whole skins.

Pink marks intent and selection. Each app has at most one additional decorative
color family and a short coherent neutral ramp. Domain colors have explicit
meaning. Use crisp text, restrained highlights, visible material depth and rounded
groups. A flat grey page, a tinted background, or many unrelated pastel cards does
not satisfy this direction. Dense playfields have stable backing; glass belongs
to bounded controls/navigation. Respect solid material, contrast and motion
preferences. No claim of medical eye safety or measured aesthetic superiority.

Apps start with their task, not advertising, inspirational slogans, editorial
eyebrows, redundant explanations, or infrastructure details. Controls must answer
a real user decision. Automatic layout is not a user setting.

## Geometry and interaction invariants

1. Every installed app and system window declares its preferred **outer window**
   dimensions. Third-party integrations without a request use the explicit external
   default in the desktop contract. Launch width and
   height are independently the smaller of that request and the actual available
   desktop workspace. Account for the taskbar once. Explicit resizing is respected;
   maximize/restore and viewport shrink must preserve reachable windows.
2. Opening an app must not create an accidental document or playfield scrollbar.
   One or two pixels of horizontal overflow is a defect, not rounding tolerance.
   Each deliberately scrolling region is named in its app contract.
3. Primary navigation, current task identity and required actions stay reachable.
   Only the selected detail pane scrolls in complex apps such as Chess. A scrollbar
   gets a reserved lane at the pane edge, never a thumb over its controls.
4. A board scales to its available width **and height**. No unexplained fixed cap,
   aspect distortion or hidden controls. Height can legitimately limit a square
   board; tests distinguish that constraint from an arbitrary maximum width.
5. Every pointer/keyboard interaction with a background window raises it. The
   same click also performs its intended action. This includes nested game frames
   and repeated switches, without a transparent click-eating overlay.
6. Loading, ready, active, paused, terminal and failed states must be distinguishable
   in actual rendered output. Unknown work is indeterminate and recoverable. A
   running engine or canvas does not prove that a game is visibly playable.
7. Essential state and controls survive small windows, maximize/restore, long
   content, touch, keyboard focus, and supported accessibility settings. Legitimate
   physical constraints require an explicit designed fallback in the app contract.

## Evidence and authority

Authority order: latest user instructions → this constitution → current request
and app contracts → implementation → historical notes. Conflicting historical
guidance must be updated or labelled superseded, not silently retained as policy.

Acceptance has three separate gates: request readiness, candidate promotion, and
deployed acceptance. See [WORKFLOW.md](WORKFLOW.md). Automation measures invariants;
an independent agent observes real viewport captures and interactions against the
reference direction. Neither can substitute for the other. The user is the final
judge of subjective preference; escalate a concrete, reviewed result with evidence.

References: [elementary HIG](https://docs.elementary.io/hig),
[elementary application screenshots](https://elementary.io),
[Zorin OS](https://zorin.com/os/). Per-app dossiers record the exact inspected
screens and adopted/rejected patterns. These are design references, not evidence
that this implementation has been validated by those projects.
