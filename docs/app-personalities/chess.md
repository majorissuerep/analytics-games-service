# Chess — viewport workspace

11 November 2026. Current contract: [experience vision](../experience/VISION.md)
and `experience/apps/chess.json`. This replaces the earlier club-desk,
document-scroll and sticky-board notes; those approaches are superseded.

## Tasks and failures addressed

Players choose an engine or room, make moves, inspect candidate lines, recover
with Undo, and leave or resign. Model users configure matches, inspect saved
replays and submit packages. Navigation and required actions must survive long
content and resizing.

The earlier changes were insufficient: removing an interior scrollbar by
scrolling the entire document moved navigation and actions out of reach; adding
a sticky board only masked that error. A slogan consumed working space, and
720px board/1200px workspace limits wasted expanded space. Actual XP reproduction
showed a 972×731 iframe containing a 1763px hints document, with Undo/Leave at
y1677; arena reached 2576px. These were functional failures, even though the
initial setup screenshot fit.

## Direct references

Read official sources and inspected actual app imagery during this correction:

- [elementary HIG: Creating Layouts](https://docs.elementary.io/hig/widgets/creating-layouts),
  [Concision](https://docs.elementary.io/hig/design-philosophy/concision),
  [Containers](https://docs.elementary.io/hig/widgets/container-widgets), and
  [First Launch](https://docs.elementary.io/hig/user-workflow/first-launch-experience):
  common actions first, task-oriented navigation, grouped controls, and useful
  initial content. HIG sidebars normally go left; the user's explicit fixed top
  navigation takes precedence here.
- [Official elementary Code screenshot](https://elementary.io/images/screenshots/code.png):
  visually inspected anchored source navigation, compact grouped toolbar and
  stable content pane. Adopt the separation of navigation/actions from content;
  reject tiny dense icons and unrelated editor configuration.
- [Official elementary AppCenter screenshot](https://elementary.io/images/screenshots/appcenter.png):
  inspected rounded window boundaries, restrained control highlights and clear
  grouping. Adopt bounded soft materials; reject its large promotional hero.
- [Official Zorin OS page](https://zorin.com/os/) and
  [Zorin 18 desktop imagery](https://assets.zorincdn.com/zorin.com/images/home/hero/18.png):
  visually inspected bright rounded surfaces against desktop scenery. Adopt
  restrained elevation and readable materials, not branding or shell assets.

These references were inspected directly, not subjected to usability testing.
No copied imagery is shipped.

## Alternatives and selected structure

1. Document with sticky board: rejected because section choices and actions can
   still disappear, and small windows require long travel between tasks.
2. Full-screen board with controls in a modal: rejected because persistent
   analysis and ordinary recovery actions would compete with modal navigation.
3. Fixed viewport workspace: selected. Top setup sections stay anchored; only
   the chosen rubric scrolls. Active play has a board stage and a utility pane
   with fixed status, tabs and actions around one selected-details scroller.

Below 700px the utility pane becomes a lower dock; the board receives the
remaining height. This deliberately trades board size for reachable controls.
The board size is `min(actual stage width, actual stage height)`, with no fixed
maximum. A short/wide window may legitimately be height-limited.

## Material and implementation

Pink is the only decorative hue family; a short warm neutral ramp supports it.
Board squares, piece art, move-quality colors and semantic feedback retain domain
meaning. Opaque board and candidate rows give stable data backing. Bounded
navigation/setup/sidebar surfaces use shared glass fill, highlight gradient,
edge and blur; solid/reduced preferences disable material through shared tokens.

`ChessGame.tsx` removes the intro entirely, adds fixed Computer/Online/Local/
Model arena/Models sections, and separates active Game/Analysis and Moves details
from the fixed action footer. `ModelSubmissionPanel.tsx` can open directly in
its explicit section. `ModelArena.tsx` separates New match, Replay and Saved
matches, preserving model budgets, pause/resume and all replay transports.
Engine protocols, evaluation math, legal moves, room state and telemetry remain
unchanged. Stockfish shows its difficulty rather than an unused custom budget.

Declared scroll owners use `data-scroll-owner`:

- `.chess-setup-details`: selected ordinary setup or Models content.
- `.chess-utility-details`: selected active Game/Analysis/Moves content.
- `.chess-arena-config`: model-match configuration.
- `.chess-match-archive`: saved match list.
- `.chess-arena-moves`: replay notation, inference progress and retry feedback.

Arena's outer selected-details wrapper does not scroll. Its tabs, replay
transports and Pause/Resume remain outside the notation scroller. Setup and model
submission actions stick to the selected pane's lower edge. Active Undo/Leave/
Resign sit outside scrolling content. Sound and New game remain in the appbar.

## Working evidence

Evidence lives at `/workspace/scratch/experience-working/chess/` and is candidate
working evidence, not a deployed acceptance claim. Actual XP window reproduction:
normal iframe992×731 document is exactly992×731, board659px, fixed action footer
y661–706. Maximized1432×929 gives an857px board and unchanged viewport document;
small792×579 gives476px board with actionsy509–554. Actual Stockfish supplied the
long candidate list; no inference fixture was used.

Standalone320×640,390×844 and1280×505 captures cover setup, long hints and its
scrolled end, Moves, model submission, arena/archive and replay. Pointer
hit-testing used `elementFromPoint` before any action auto-scroll: setup primary,
arena Start, replay transport and model Submit were hittable at every size.
At320×640, setup/Submit end aty630 and replay transport aty537. At390×844,
Submit ends aty834. Narrow replay, model submission and maximized actual-XP hints
captures were visually inspected. Targeted ESLint passes for all three TSX files.

The shared standalone privacy footer now supplies `--ui-app-height`; Chess
consumes it without flex shrinking. Repeated final checks show exact document
width/height at320×640,390×844 and1280×505 across setup, arena, Models, hints,
scrolled hints and Moves. Final action hit-test results are recorded in
`final-action-hits.txt`: at320×640 setup/Submit end aty578 and replay transport
aty485, leaving the shared Privacy footer clear. At390×844 Submit ends aty782.
Local e2–e4 produced `1. e4 *`, Undo was directly hittable and cleared history.
Tab focus computed a3px pink outline; solid sidebar computed no gradient/no blur.
The parent owns complete regressions, independent review and deployed acceptance.
No build, server, commit or push was performed by this agent.


## Current-position prediction ownership

Predictions belong to the current board and request generation. Every accepted move,
Undo, reset or relevant configuration change invalidates obsolete hints, evaluation,
progress and automatic moves synchronously. Returning to the same FEN creates a fresh
generation. Selection and illegal moves do not discard useful current analysis.

The cancellation signal travels through the streamed response into the shared engine
runtime. Waiting jobs are removable; active UCI work receives `stop` and drains its
`bestmove` before reuse, with a one-second process-restart fallback. Other players keep
their queued work. Explicit Cancel leaves a stopped state with Retry; automatic
invalidation starts only the current position's work. Existing glass composition and
absolute loss-color calibration remain the visual contract.

Protocol references: [AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal),
[ReadableStream cancellation](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream/cancel),
and [Stockfish UCI commands](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html).
The executable requirements and evidence scenarios are in
`experience/requests/chess-current-position.json`.
