# Minefield — compact puzzle window

11 November 2026. Current authority: `docs/experience/VISION.md`,
`experience/requests/desktop-refinement.json`, and `experience/apps/minefield.json`.
This replaces the earlier “field notes” direction, manual cell sizing and flag mode.
Generation, deduction solver, configurations and telemetry remain unchanged.

## Task and observed friction

Read neighboring clues, mark justified dangers, open justified squares. Beginner
is 9×9/10, intermediate16×16/40, expert30×16/99. The inspected production baseline
opened a beginner in1040×700, with a1032×671 iframe whose document needed731px.
The270px grid also lived in a board viewport with client272/scroll274: exactly2px
of accidental horizontal overflow. Detached editorial headings and controls took
more space than the task justified. Touch marking depended on a global mode.

## Direct references inspected

- [elementary HIG, Concision](https://docs.elementary.io/hig/design-philosophy/concision.md):
  main purpose immediately apparent; avoid feature/configuration burden.
- [Accessible Configuration](https://docs.elementary.io/hig/design-philosophy/accessible-configuration.md):
  sane defaults rather than asking users to make layout engineering choices.
- [Creating Layouts](https://docs.elementary.io/hig/widgets/creating-layouts.md):
  common tools first, related controls grouped. Read the text and visually inspected
  linked toolbar and Files artwork; those are historical screenshots, not evidence
  of the latest OS appearance.
- [Official elementary screenshots](https://elementary.io): directly downloaded and
  visually inspected `images/screenshots/appcenter.png` and `code.png`. Adopt clear
  toolbar/content boundaries, compact attached controls, quiet stable work area,
  rounded bounded surfaces. Reject AppCenter's promotional hero for a game and
  Code's sidebar, which would steal board width.
- [Official Zorin OS overview](https://zorin.com/os/): rendered the page and visually
  inspected its desktop/application presentations. Adopt soft silver material,
  modest rounding and careful hierarchy; reject marketing composition, OS branding
  and a whole shell reskin. XP chrome remains owned by the shell.
- [Simon Tatham Mines manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/mines.html),
  [GNOME Mines flags](https://help.gnome.org/users/gnome-mines/stable/flags.html.en)
  and [Hexcells publisher screenshots](https://store.steampowered.com/app/265890/Hexcells/)
  were directly read/visually inspected in the prior pass. Their retained useful
  patterns are protected flags, deduction-first generation, contiguous field and
  peripheral counters; no copied artwork or changed puzzle rules.

These references inform design decisions; they do not establish measured usability
or medical benefits for this implementation.

## Alternatives and chosen personality

1. **Compact puzzle instrument, chosen:** one bounded silver frosted toolbar,
   attached counters, opaque board fitted to both axes, concise input guidance.
   Uses the beginner window efficiently and expands for harder fields.
2. **Full-window cabinet:** large permanent surround with prominent instruments.
   Rejected because it recreates the disproportionate beginner window.
3. **Side-control workbench:** fixed control rail and broad board stage. Rejected
   because it sacrifices expert columns and complicates phone composition.

Character: patient, precise puzzle tool. Decorative budget: pink intent plus one
slate-blue identity; short silver neutral ramp. Failure red is semantic. Clues use
opaque dark digits on white, flags use white glyphs on dark slate, covered squares
use slate-blue fill; each state has shape/text as well as color. No animated garnish.
Toolbar gloss is bounded; individual cells have no blur. Solid preference restores
opaque controls; forced colors use system colors.

## Implementation and interaction contract

Manifest requests outer480×600. Explicit Level changes request480×600,
720×660 or1120×760 through the shared `requestWindowSize(width,height)` helper.
A ResizeObserver sizes cells from min(stage width/columns,stage height/rows),
using integer pixels and a24px readable minimum. The board's box accounts for
its own padding and border; no artificial2px rounding tolerance.

Only `.minefield-board-scroll[data-scroll-owner="minefield-board"]` can pan;
`data-panning="true"` identifies a physically constrained field and reveals a
short pan/keyboard hint. The document stays contained. This fallback is necessary
for expert720px minimum field width on a320px screen. Intermediate has the same
physical constraint below384px usable width and uses the same bounded fallback.
No Cell size selector or Flag mode exists. Click/Enter opens; right-click/F marks;
a450ms touch/pen hold marks. Movement over8px, pointercancel, reset and unmount
cancel pending marking. Completed/cancelled holds suppress the subsequent reveal.
Roving arrow focus follows the grid and scrolls offscreen cells into view; row
edges do not wrap. Existing clue click chording is unchanged.

Worker startup exceptions and runtime errors produce a readable status plus
“Retry verification”; retry uses the intended opening. New game/Level remain
available during verification; epoch checks reject stale results and workers stop.

## Working verification and limits

Working evidence: `/workspace/scratch/experience-working/minefield/`.
This is scoped implementation evidence, not final independent promotion acceptance.

- ESLint passed for changed TS/TSX. Existing model/solver suite:2 files,9 tests
  passed, including deduction proofs for all difficulties/openings.
- Actual XP beginner: outer480×600; iframe/app/document472×571; no scroll overflow.
  Board viewport341×341, scroll341×341, grid333×333 (37px cells). On one subsequent
  hot-reloading dev run a transient initial24px board was captured before fitting;
  a later stable repeat again fitted37px with exact341px viewport/scroll width.
  Clean-build initial-ready/no-overflow remains a coordinator check.
- Actual Expert Level change: outer1120×760; iframe/app/document1112×731;
  grid900×480 (30px cells, height constrained), no board/document overflow.
- Real right-click then F toggled a flag off. Real reveal generated a board.
  A public-visible-clue-only browser solver reached won (“Cleared in14 seconds!”);
  screenshots include dense96%-cleared state with364/381 safe cells. The script
  used DOM click/contextmenu dispatch for rapid solving, without hidden board data.
- At320×640, shell clamped outer320×598; app/document312×569 without overflow.
  Sole board pan contained720×384 at24px.29 real ArrowRight keypresses focused
  row1/column30 and panned it into view.
- Touch via Chromium CDP:550ms actual touch held one flag with zero revealed cells;
  moved touch cancelled with zero flags/reveals. A fixture threw the first Worker
  constructor: explicit failure rendered, Retry generated33 revealed cells.
- Forced colors/reduced motion and persisted solid material rendered and captured;
  `html[data-ui-material=solid]` observed. Visually inspected start, narrow, dense
  late expert and forced-colors captures. Full production composited contrast and
  all cross-app regressions remain coordinator checks.
- Narrow viewport screenshot includes shell Pip/Privacy overlays over the footer;
  app geometry itself fits. This external shell obstruction was reported separately.

The root consumes `--ui-app-height` with100svh fallback, allowing the shared
top-level Privacy footer to reserve space without shrinking embedded frames.
No build, server start, git mutation or shared-file/test edit was performed here.
