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

## Extreme Elite and inspectable deduction — 12 November 2026

Current scope is `experience/requests/minefield-elite.json`; the compact instrument
and original XP chrome remain. The statement above that algorithms/configurations
remain unchanged describes the November 11 migration only. This iteration adds
an explicit visible-information boundary, proof explanations and a linked-layer
variant, while retaining the established rejection-sampling approach.

### Audit and direct research

The baseline already rejected boards that its sound but incomplete local/subset
solver could not finish from the chosen opening. It used revealed clues and the
global mine total, without treating player flags as facts or moving live mines.
A classic 50/50 is rejected rather than patched during play. The material gap was
inspectability: generation and tests shared one solver, and the player could not
request a reason or distinguish a misplaced flag from an actual logical impasse.

Sources fetched and read directly this iteration:

- [Simon Tatham Mines manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/mines.html)
  documents no-guess generation, protected flags, local clearing and safe zero
  openings. Its [maintained source mirror](https://github.com/chrisboyle/sgtpuzzles/blob/main/app/src/main/jni/mines.c)
  uses clue regions, overlap/subset subtraction, the global budget and generation
  perturbation. Adopt the ordinary constraint arithmetic, not its entire engine
  or pre-play perturbation machinery. The official source web interface returned
  HTTP 403, so source observations are specifically from the mirror.
- [14 Minesweeper Variants, developer product page](https://store.steampowered.com/app/1865060/14_Minesweeper_Variants/)
  describes procedural logic-only boards, distinct rule systems, drawing notes
  and a hint system that helps without simply supplying the solution. Adopt one
  learnable rule addition and inspectable reasoning, not fourteen combined rules.
- [Tametsi, developer product page](https://store.steampowered.com/app/709920/Tametsi/)
  explicitly promises logic-only levels across different tilings. [Hexcells](https://store.steampowered.com/app/265890/Hexcells/)
  provides another focused numerical puzzle reference. Adopt precise clue scope
  and stable opaque tiles; do not copy artwork or claim these products validate
  this implementation.
- [4D Minesweeper source README](https://github.com/aeramos/4D-Minesweeper)
  describes its four-dimensional Swing game and later N-dimensional coordinate
  mapping. [MineSweeper3D source README](https://github.com/VincentGsell/MineSweeper3D)
  describes 2D and 3D renderers sharing logic. These were textual source inspections,
  not playtests. Reject spatial camera/occlusion cost and high-dimensional memory
  burden for a compact XP window.
- Official [elementary Code screenshot](https://elementary.io/images/screenshots/code.png)
  and [Zorin 18 desktop/application hero](https://assets.zorincdn.com/zorin.com/images/home/hero/18.png)
  were downloaded and visually inspected. Adopt elementary's attached toolbar/tab
  hierarchy, quiet stable work area and Zorin's bounded rounded material. Reject
  Code's permanent sidebar and the promotional/multi-window presentation. XP
  remains the shell; pink intent plus slate-blue remain the two decorative families.

### Alternatives and exact choice

1. **Linked two-layer instrument, chosen:** two 8×8 layers, 28 total mines; normal
   local clues plus player-requested echoes. One readable layer, explicit tabs and
   a compact persistent clue inspector. Extra information crosses an actual spatial
   dimension without a camera. Unlimited scans are counted as an efficiency metric;
   there is no claimed optimal score and no resource that can strand the player.
2. **Full 3D/4D volume:** authentic spatial complexity, but occlusion, coordinates,
   memory and narrow layouts dominate the deduction task. A naive two-layer single
   combined 17-neighbor count also allows aligned mine swaps and ambiguity. A
   temporary simulation found zero accepted boards in 25 samples even at eight
   mines; this is an exploratory observation, not a general impossibility proof.
3. **Finite scan currency / probabilistic risk:** meaningful acquisition choices,
   but an unhelpful scan can consume the last resource. Avoiding softlocks would
   require recharge, extra guarantees or recovery complexity. Unlimited counted
   exact scans retain information strategy while preserving fair solvability.

### Rules, information and certification

An Elite tile's local number counts the eight neighbors in its own layer. Its
unscanned echo is `?`. Scanning an already revealed safe tile permanently discloses
one exact count for the aligned 3×3 footprint in the other layer, including the
aligned tile. The footprint is clipped at edges: four cells at a corner, six at an
edge, nine inside. Scanning never reveals a cell and never moves a mine. Repeated
scanning is a no-op. The first opening and its same-layer neighbors are safe;
the opening's local count is zero, while its unknown echo can be positive.

The generator uses standard rejection sampling, bounded by 3,000 candidates and
an 8-second search limit. It accepts only a completed visible-clue proof. Elite
also requires an actual echo-source proof step, failure when echoes are removed,
and failure when subset subtraction is removed. The local-only failure is weak
on its own because it cannot enter the unopened second layer; the three checks
are documented together, not presented as a mathematical difficulty rating.
Certification requests every echo on safely opened tiles. Players may acquire
those exact constraints in any order; added information is monotonic, and scans
cannot be exhausted. Solver incompleteness can reject valid boards, never justify
an uncertain reveal. No probability estimator, SAT service, AI model or live mine
relocation was added.

`toVisibleMinefield` strips mine bits, covered local clues and unscanned echoes.
`analyzeMinefield` accepts only that public view; flags are annotations and never
premises. It returns single-region, global-budget or subset steps with original
clue provenance, residual operand regions and counts. Supporting deductions are
retained. A stalled result says these rules found no move, not that guessing is
mathematically required. A scan suggestion is explicitly an information request,
not a safe-cell claim. Known-safe flagged cells receive an explicit correction and
an optional **Unflag and open** action. Already flagged inferred mines are skipped
when choosing an instructional target.

### Interaction, material and containment

Elite requests outer 720×760. Its active 8×8 layer auto-fits both axes with a
32-pixel minimum for separate local/echo lines; classic retains its 24-pixel
minimum. Only named `minefield-board` pans when a readable field cannot fit.
At constrained 320×640, at least 192 pixels of the board stage remain visible.
A bounded, closable proof dialog has the additional named `minefield-proof` scroll
owner; it cannot grow the document or push essential controls away.

Layer tabs show opened counts only, never hidden layer mine/safe totals. The
inspected source coordinate persists across tab changes and highlights exactly
the opposite footprint. Revealed Elite cell clicks select without clearing.
C/Shift-click explicitly chords local neighbors; E or **Scan echo** requests an
echo. Open/Enter, F/right-click/hold, cancelled-touch protection, roving arrows and
classic clue-click chording remain. **Show this cell** changes layers and focuses
the actual cell after DOM commit, allowing the named board to pan to it. Proof
focus is trapped, Escape closes, and ordinary closing restores Explain focus.

The inspector and layer tabs use one bounded slate/silver control group. Pink
marks the active layer and inspected/intended cell. Opaque tiles retain clear
state shapes and two readable clue lines. No blur per tile, persistent animation,
Cell size control, Flag mode, slogans or per-layer mine totals were introduced.
Solid, contrast, reduced-motion and forced-colors fallbacks remain scoped.

A main-thread 10-second watchdog terminates stuck generation independently of the
worker's search limit. Failure, success, cancellation, mode changes and reset
invalidate the generation epoch so late or duplicate messages cannot replace the
current board. Retry keeps the intended opening. The progress indicator reports
candidate activity and elapsed time without inventing a completion percentage.

### Working verification and limits

- Original model/solver baseline: 2 files, 9 tests passed before implementation.
- Updated scoped suite: 2 files, 14 tests passed, including all classic sizes,
  six Elite openings, subset/cross requirements, exact corner/center topology,
  positive unknown opening echo, scan idempotence, hidden-view gating, flag
  independence and bounded failure. App ESLint passed. Coordinator owns the
  independent feasible-world oracle, integration suites and final build checks.
- A working Chromium 320×640 standalone run, consent dismissed, showed body
  320×640 without overflow, a 588-pixel app below the top-level Privacy reserve,
  a 211-pixel board stage and readable 32-pixel cells. A real opening produced
  eight revealed tiles; `/tmp/minefield-elite-open320.png` was visually inspected.
  Temporary captures alone are not durable promotion evidence.
- Coordinator's working Node benchmark of 120 boards reported no failures;
  expert p50 211ms/p95 649ms/worst 672ms, Elite p50 10ms/p95 18ms/worst 23ms.
  These are executor measurements, not browser or universal performance claims.
- Independent reviewer found an initial proof-explanation gap (missing operand
  values/regions/supporting steps) and a focus-restoration issue. Both were fixed
  in source; final candidate review must verify the exact new tree and captures.
  Production acceptance, complete E2E, material screenshots and rollout belong
  to the coordinator's three-gate evidence, not this working note.
