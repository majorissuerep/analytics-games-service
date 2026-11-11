# Chess — the club analysis desk

11 November 2026. Scope: Chess setup, live/local/online board, ranked analysis, model arena/replay, model submission. Applies `APP_PERSONALITY_BRIEF.md`; the old four-category decorative palette is superseded.

## Task hierarchy and friction

The principal tasks are choosing how to play, keeping the board in view while making a move, and comparing concrete candidate lines. Secondary tasks are inspecting a saved model match and submitting a model. Engine choice, actual startup stages, cancel/retry, local legal moves, online rooms/clocks, loss-from-best semantics, model turn budgets, saved replay and completion telemetry must remain intact.

Three consequential presentation problems were the equally prominent multi-color mode cards, a mobile sidebar placed ahead of the board with history removed, and repeated rounded/frosted containers around dense analytical rows. The old replay transport also lacked accessible names and endpoint state, and playing an archived match from its final position never restarted it.

## Direct research

Sources accessed directly on the implementation date; no gallery aggregation or usability outcomes inferred.

| Reference inspected | Useful pattern | Deliberately not imported |
| --- | --- | --- |
| [Lichess analysis](https://lichess.org/analysis) and [studies](https://lichess.org/study) | Direct HTML inspection of the analysis tool/navigation and study listing, including named chapters and tool entry points. Purpose-specific task selection and concise chess vocabulary are useful for the setup rail. | The analysis HTML is a dynamic shell; this inspection does not establish live engine behavior. Public community feeds and broad site navigation would distract from this embedded game. |
| [Scid vs. PC project/features](https://scidvspc.sourceforge.net/) and its [actual application screenshot](https://scidvspc.sourceforge.net/images/scidvspc.jpg) | Read maintained feature documentation for engine tournaments, configurable engines, game lists and clickable variation arrows. Visually inspected the board/PGN/player/tree composite screenshot. The large stable board beside compact notation and move navigation is the clearest transferable composition. | Its many simultaneous panes, tiny toolbar icons, saturated annotation colors and database-management density do not fit a 320px iframe. No assets were copied. |
| [GNOME HIG: Scaling & Adaptiveness](https://developer.gnome.org/hig/guidelines/adaptive.html) | Read adaptive layout guidance: retain functionality across sizes, start from constrained layouts, prefer scalable lists, use maximum-width containers and move utility panes below primary content. This supports board-first mobile flow and retaining history. | GNOME's minimum recommended phone width is 360px; this implementation additionally checks the requested 320px. No native-widget appearance claim. |

## Three directions considered

1. **Tournament broadcast:** large board, contrasting dark clock dock, wide result strip and minimal analysis. Strong for spectators, but requires the principal analysis task to compete with broadcast framing.
2. **Notation notebook:** white paper, serif chapter headings, full-width move ledger beneath the board and disclosure panels for setup. Good for study, but scrolling separates candidate moves from the board on a desktop.
3. **Club analysis desk — selected:** side rail for choosing a mode, restrained paper setup sheet, olive-rimmed board and opaque compact analysis beside it. Serif display/status headings establish a chess-room voice; mono notation keeps changing values aligned. On phones the rail becomes a two-column selector and the utility panel follows the board.

The selected direction prioritizes board-and-line comparison while keeping setup understandable. The tradeoff is a vertically scrolling document on phones or genuinely short windows; controls and history remain available instead of disappearing.

## Personality contract

- Character: quiet, considered club chess; warm paper and an actual table edge, rather than generic dashboard cards.
- Decorative budget: pink intent/selection as the only decorative hue family, supported by a small warm neutral ramp. Unused violet/teal/amber aliases map to pink locally. Form feedback and fixed chess evaluation colors are semantic exceptions.
- Material: stable opaque board, setup, notation and analysis. Bounded shared frost only on navigation/hover/dialog layers; persisted solid material and shared reduced-transparency fallbacks remain authoritative.
- Hierarchy: serif editorial title and turn status; system UI labels; compact monospace moves, evaluations and room codes. Setup uses a vertical mode rail, not four equal decorative cards.
- Signature interaction: a pink inset rail/underline identifies selected modes and segmented choices; current replay moves have a pink edge plus `aria-current`. Selection is structural as well as colored.
- Domain exceptions: piece art, legal-target/heat-map overlays, black/white identities, fixed loss-from-best gradient and explicit error/success feedback retain their original meaning.

## Implementation

`games/chess/client/chess.css` contains scoped tokens, responsive composition, compact contiguous candidate rows, retained phone move history, model form containment, bounded material and forced-color/reduced-motion handling. Engine controls stack at 400px and below so option text remains readable. The large phone board precedes its utility panel.

`ChessGame.tsx` supplies the chess-room title, monochrome mode/sound glyphs, stateful segmented choices and accurate arena subtitle (the budget is configurable). Existing engine-selection, board, progress, test hooks and telemetry paths are preserved.

`ModelArena.tsx` gives first/previous/next/latest controls accessible labels and endpoint disabled states, marks the current replay ply and selected saved match, restarts replay from the final position, and explains the empty archive's next action. `ModelSubmissionPanel.tsx` connects its disclosure to the form using `aria-controls`. Submission protocols, safety text and runtime options remain intact.

## Verification

- Targeted ESLint passed for the three changed TSX files. Chess logic, evaluation and sound unit suites: **18 tests passed**.
- Playwright against the coordinator's development server: 1280×800, 390px and 320px setup screenshots; 1280px and 320px local board; 1280px and 390px actual Stockfish analysis (19 ranked candidates); 320px arena and expanded model submission. Screenshots visually inspected. No horizontal page overflow at 320px local/submission or 390px analysis.
- Real local interaction: `e2–e4` produced `1. e4 *` in history; Undo returned the history to its empty state. Engine selection/free-both-sides startup produced actual Stockfish suggestions; no invented progress percentages.
- Keyboard Tab produced a visible 3px focus outline. Reduced-motion emulation yielded zero transition duration. Persisted solid material yielded `backdrop-filter: none` and opaque paper on the toolbar.
- Arena replay uses a temporary intercepted three-ply completed-match fixture for UI verification; this avoids requiring database writes. It verifies transport endpoint states, current-ply state, final-position restart and narrow containment. This does not verify live server match persistence.
- Evidence artifacts are in `/tmp/chess-personality/` (setup, play, analysis, arena, submission and replay screenshots). They are temporary verification files, not committed application assets.

Limitations: the database-backed live arena and actual model upload were not submitted in this presentation pass. Coordinator owns full application-design/e2e integration, forced-colors/reduced-transparency media verification, online multiplayer and release checks. `127.0.0.1` initially served unhydrated development markup with HMR cross-origin failures; switching to `localhost` resolved hydration and allowed real interactions. No root build or shared-file changes performed by this app agent.

Integrated review fixed the capped setup grid to keep intrinsic row heights: model submission now scrolls into view without shrinking under the attribution footer. The root QA suite exercises disclosure and starting play afterward.


## Glass desk correction — 11 November 2026

The screenshot review found that a height-capped setup region produced an
interior scrollbar and opaque paper hid the intended material. The correction
uses one pink decorative family, a warm neutral ramp, and a compact two-column
setup sheet beside a single frosted navigation rail. The old `data-tone`
attributes are removed entirely; board and fixed evaluation colors retain their
semantic meaning. The title is smaller, the engine and difficulty share a row,
and Stockfish no longer shows the custom-model budget it does not use. The
optional model registry, its loading state and errors are disclosed with model
submission instead of lengthening the closed setup.

The three directions were reconsidered: a single scrolling control column is
simple but needlessly tall at 920px; a tabbed full-width wizard is compact but
separates related engine choices; the selected rail plus compact control sheet
keeps all ordinary choices and the primary action visible together. The board
remains opaque while the surrounding controls use alpha fills, highlight edges
and the shared blur. The coordinator owns the transparent iframe document and
the XP window's material boundary, which are necessary for actual desktop
wallpaper to show through an iframe. App-only alpha cannot sample another
browsing context.

Re-fetched the direct Lichess analysis, Scid vs. PC feature page, and GNOME
adaptive guidance above during this correction. The niche tools continue to
support board/notation priority; GNOME's adaptable layout guidance supports
removing an arbitrary nested viewport cap. No new source usability claims.

Verification against localhost:3132 with Playwright: 920×680 and 1100×800
setup documents fit their viewports with the main action ending at 527px and
512px respectively. `.chess-setup` computed overflow is `visible`, and its
scroll height equals its client height. At 320px and 390px, document widths
match their viewports; only the outer document scrolls vertically. Selected
mode fill is pink and the other three backgrounds are transparent. Setup fill
computes to `rgba(255,255,255,.76)` with `blur(18px) saturate(.85)`.
Screenshots `/tmp/chess-glass-920.png`, `-1100.png`, `-390.png`, `-320.png`
and `/tmp/chess-glass-play.png` were captured; desktop and 320px setup were
visually inspected. Real local e2–e4 produced `1. e4 *`. Targeted ESLint passes
for `ChessGame.tsx` and `ModelSubmissionPanel.tsx`. No build was run alongside
the coordinator's development server.

Review selectors: `body:has(.chess-app)` owns the scrolling/gutter;
`.chess-setup`, `.chess-sidebar` and `.chess-suggestion-list` have no constrained
inner scroll; `.chess-mode-tabs button` owns the single-family mode palette;
`.chess-toolbar`, `.chess-mode-tabs`, `.chess-setup-panel`, `.chess-sidebar`
and `.chess-model-submit` use shared material tokens. Dense suggestions and
board squares remain stable opaque surfaces. Move history and replay notation
retain bounded data scrolling with reserved gutters. Shared solid preference,
reduced transparency and forced-colors remain coordinator integration checks.

Final material/contrast follow-up: bounded toolbar, rail, setup, optional model
panel and play sidebar layer shared `--ui-glass-sheen` above their glass fill.
No additional backdrop filters were introduced; nested form controls stay
opaque. Playwright computes the shared highlight gradient on the rail and setup;
solid mode computes `none, none` for their background images and no blur.
Unbacked intro/kicker/attribution now use strong ink #302a2c. Compositing the
coordinator's rgba(255,250,253,.55) window and rgba(255,251,253,.16) canvas
over black yields RGB(158.61,155.66,157.37); strong ink has 5.15:1 contrast
against that darkest bound. Sound state now reads “Sound on” or “Sound off”,
while existing accessible action names and toggle behavior are preserved.
`/tmp/chess-gloss-920.png` was captured and visually inspected. Targeted
ChessGame ESLint passes.

Wide gameplay keeps `.chess-board-wrap` sticky at 16px while the document
scrolls long candidate lists. The existing viewport-height width cap keeps the
square board within the viewport. Source review confirms `.chess-game-layout`
uses `align-items:start`, `min-height:0` and `overflow:visible`, and `.chess-app`
also has visible overflow, so no intervening scroll container captures sticky
positioning. At 760px and below the board retains relative positioning in normal
flow. This final CSS-only change was source reviewed; no build/dev was started.
