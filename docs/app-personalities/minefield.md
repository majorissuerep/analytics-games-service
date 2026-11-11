# Minefield — field notes

11 November 2026. Scope: Minefield client composition, CSS and interaction details.
Generation, solver, telemetry and board configurations remain unchanged.

## Task and friction

The task is to scan a partly opened field, reconcile neighboring clues and flags,
and open a justified square. First opening verifies a deduction-only board.
The shipped expert field is **30 × 16 with 99 mines**, not 99 × 99.

Three consequential problems in the previous interface:

1. Three rounded frosted containers and separate colorful counters competed with
   the field. Controls, configuration and game state had similar visual weight.
2. Flag mode changed only its fill. Its effect on the next tap was not stated,
   particularly consequential when switching between mouse and touch.
3. Horizontal arrow navigation wrapped from one row to another; long instruction
   text could also dictate the board container width. Both weaken spatial mapping.

Preserve: numbered clues, visible flags/mines, protected flagged squares, chording,
roving keyboard focus, right-click/F marking, selectable cell size, internal scroll,
worker verification/cancellation/error recovery, elapsed timing and terminal events.

## Direct references and limits

- [Simon Tatham, Mines manual](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/doc/mines.html),
  directly read current 20260923 manual: deduction-only generation, protected marked
  cells, click-to-clear surrounding squares and cursor navigation. Adopt explicit
  first-opening verification and terse contextual controls. Do not import undo,
  alternate tilings, solve commands or different Space-key behavior into this game.
- [GNOME Mines flags](https://help.gnome.org/users/gnome-mines/stable/flags.html.en)
  and [board sizing](https://help.gnome.org/users/gnome-mines/stable/board-size.html.en),
  directly read: flags protect covered tiles; difficulty is selected separately.
  Adopt clear marking feedback and field dimensions beside the field. Do not add
  GNOME's question flags, theme menus or change the existing beginner dimensions.
- [Hexcells publisher Steam page](https://store.steampowered.com/app/265890/Hexcells/),
  directly read and visually inspected its first 1920×1080 publisher screenshot:
  contiguous puzzle grouping, strong covered/clue distinction, peripheral counters,
  sparse neutral surround. Adopt spatial priority and a bounded numeric instrument
  strip. Do not copy hex geometry, blue/orange artwork, diagonal menu or mistake
  allowance. The developer-site URL returned HTTP 403; the publisher listing and
  screenshot provided the inspected evidence.
- [W3C, Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html),
  directly read: meaning needs a visible non-color cue. Flags retain their glyph;
  clues retain numbers; flag mode uses text and pressed state; clearing has a
  labeled measured progress element. Not a whole-product conformance claim.
- [Putkonen et al., visual search in GUIs](https://research.aalto.fi/en/publications/understanding-visual-search-in-graphical-user-interfaces/),
  DOI 10.1016/j.ijhcs.2025.103483: the repository's shared research records
  guess–scan–confirm behavior and the influence of GUI/cue/target type. The direct
  page returned HTTP 403 in this pass, so no newly inspected experimental results
  are claimed. Used as a caution to preserve predictable positions and labels,
  not as evidence that this palette improves speed or health.

## Three considered directions

1. **Survey sheet — chosen.** An editorial heading, slim configuration line and
   one paper field with an instrument strip. Slate covered squares become the
   strongest visual mass; opened space becomes quiet paper. Scales to expert.
2. **Instrument panel.** Dark fixed side rail, large time/mine instruments and a
   framed board. Strong technical identity, but side rail steals horizontal space
   from wide expert boards and requires major rearrangement on phones.
3. **Puzzle folio.** Centered small board, large whitespace, expandable help and a
   footer action dock. Appropriate for a casual small field, but excessive empty
   space and detached controls make late-game expert scanning less direct.

The survey sheet sacrifices ornamental glass and large metric cards to keep the
field, its remaining mine count and next action in one stable spatial group.

## Personality contract and implementation

Character: precise, patient field notebook. Palette budget: pink intent/selection
plus one desaturated blue-slate identity, supported by warm opaque paper and the
shared neutral canvas. Mine-triggered red is semantic failure, not decoration.
Numbers use a consistent dark slate; their digits carry clue meaning. No animation,
cell shadows beyond a static covered-edge highlight, or repeating glass panels.

Hierarchy: identity/configuration → actual field dimensions → mines/reset/time →
field → measured clearance → immediate input mode → keyboard/chord guidance.
The measured progress is safe cells revealed / safe cells total, not a generation
percentage. Worker verification continues using its scoped indeterminate loader.

Changes: explicit flag-mode on/off label and next-tap explanation; compact field
metadata; tabular instruments; warm stable playfield; clear covered/open/flag/mine
states; board width derives from actual cell geometry; responsive wrapped controls;
arrows stop at field edges while preserving row/column. Standard controls inherit shared focus,
hover, target sizing and disabled behavior; board cells keep their essential
geometry. Forced colors receives system-defined state surfaces. This app uses
opaque material throughout, so reduced transparency and persisted solid preference
have the same stable backing by construction. No new infrastructure or art.

## Verification

Scoped ESLint passed. Browser checks and limitations are recorded below after
rendered review; coordinator owns the final shared suite and production build.

- Chromium rendered review at 1280px and real 390/320px layouts completed against
  `http://localhost:3131/games/minefield`. Both narrow widths had document width
  exactly equal to viewport, including 44px expert cells and horizontal board scroll.
- Real pointer interaction verified mode toggling, marking/unmarking and reset;
  real keyboard interaction verified F mark/unmark, Enter opening, visible 3px
  focus, and right/up edge navigation without wrap or column jumps.
- Persisted `analytics-games.material.v1=solid` applied `data-ui-material=solid`;
  board material remained opaque with no backdrop filter. Reduced-motion and
  forced-colors emulation completed. No motion-dependent meaning exists.
- Public-clue-only solver from the existing expert test completed the 99-mine
  field via dispatched DOM click/contextmenu events, reaching “Cleared in 5
  seconds!”. No hidden state was read and no solver/generator code changed.
- The unmodified expert Playwright regression was attempted. On the shared dev
  server it reached ordinary late-solving interactions but exhausted its 90s
  timeout during a right-click; no deduction assertion failed. This is a reported
  test limitation, not a claimed passing full regression. Coordinator should rerun
  the exact test with final shared-server/build conditions.
- Initial `127.0.0.1` checks hit a development hydration/origin issue (SSR-only
  controls); localhost resolved it. Results above use the functioning origin.
- Screenshots: `/tmp/minefield-personality/clean-{1280,390,320}.png`,
  `expert-320.png`, `expert-complete.png` and late-game captures. Inspected actual
  rendered screenshots, including a measured 73%-cleared field and the dense 96%-cleared field. The original
  fixture's “70percent” filename may show a later post-action reveal percentage;
  do not infer the percentage from that filename.

A separate measured **73% cleared** screenshot was captured and visually inspected
at `/tmp/minefield-personality/expert-70actual.png`. Numbers, flags, covered
frontier and quiet revealed areas remain distinct without per-clue color noise.
Repeated development-frame navigations interrupted subsequent capture runs, so
the passing complete-solver observation above refers to the earlier stable run.
