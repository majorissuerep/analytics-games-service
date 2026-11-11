# Desktop and game reliability

## Scope and deployment

The application and chess inference deploy to Vercel. Cluster-based chess
inference is retired. Historical model submissions, audit records, and matches
are preserved. A submitted/approved artifact is not executable until a supported
Vercel adapter exists; the public executable catalog contains only implemented
built-ins. Do not reactivate the historical KServe manifests.

## Original desktop artwork

`public/wallpapers/millennium-meadow.webp` is a newly generated landscape, composed
for this project, with an early-2000s blue-sky/green-hill palette. It does not use
Microsoft's Bliss image. `public/pip-assistant.webp` is newly generated original
mascot artwork with an asymmetric silver-wire silhouette and waving end. It does
not contain extracted Office/Windows assets or Microsoft logos. Pip moves briefly
on entry and respects reduced-motion preferences.

## Minefield

Every opening is generated in a Web Worker by rejection sampling. The first cell
and its neighbors are safe. A candidate is accepted only if the deduction solver
can reveal every safe cell using public clues, the total mine count, direct
constraints, and subset subtraction. The hidden mine placement stays fixed once
play begins. Failure to find a board within the bounded attempt count returns a
retry message, never an unchecked board. The solver is sound but incomplete:
rejection does not imply that a board is mathematically unsolvable. Incorrect
player flags can still block progress or cause a loss when chording.

The board uses neutral numerals, a quiet opened surface, outlined covered cells,
and a uniform solid flag treatment. State is conveyed by shape, fill, and labels
rather than rainbow hue. Cell sizes range from 26 to 44 CSS pixels; large boards
scroll without shrinking their cells. Right-click, F, and touch flag mode toggle
flags; arrow keys navigate. Clicking an opened clue chords its neighbors only
when the adjacent flag count matches.

### Research and limits

Design decisions draw on these primary sources:

- Pei et al. (2026), [interface complexity, contrast and visual search](https://doi.org/10.1002/hfm.70060):
  density and contrast influence search performance and measured cognitive load.
- [Background clutter and visual search](https://doi.org/10.1186/s41235-025-00643-4)
  (2025): clutter affects target search in the studied conferencing setting.
- [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
  and [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html):
  essential states need perceptible cues and must not depend only on hue.

These are design inferences across different tasks, not a clinical validation of
this game or a claim that a palette prevents eye damage. Display brightness,
ambient lighting, viewing distance, and individual needs remain outside CSS's
control. The visual acceptance scenario is the 30 × 16 board with 99 mines,
including more than 70% of safe cells opened.

## Chess runtime contract

Both player-versus-engine and arena clients call
`POST /api/chess-models/{revisionId}/move` with FEN, authoritative legal UCI moves,
complete move history, and search time. History, FEN, and returned move are
validated server-side. All three UCI engines share a serial, bounded request
queue and one demand-created process per engine per warm function instance:

- `builtin-stockfish-18`: vendored Stockfish 18 WASM, Node UCI transport.
- `builtin-stockfish-19`: vendored Stockfish 19 WASM and bundled NNUE, Node adapter.
- `reckless-local`: pinned, checksum-verified Reckless 0.9 native binary.
- `builtin-styled-opening`: lazy bundled ONNX policy and repertoire artifacts.

No engine starts during module import or catalog lookup. The evaluation bar
uses the selected UCI engine; policy opponents do not silently start a separate
evaluator. Free and pick modes offer all three analysis-capable UCI engines.
Engines use one CPU thread and a 32 MB UCI hash, avoiding the previous eight-thread,
256 MB allocation per analysis request. Failures offer an explicit retry.

UCI processes and ONNX resources expire after two idle hours. Requests refresh
idle time; active UCI jobs are not terminated by the idle timer. Wall-time checks
also handle serverless suspension. Vercel can reclaim or duplicate function
instances at any time: this cache is best-effort reuse, not a two-hour residency
promise or control of Vercel's infrastructure scaling. No keep-alive traffic or
cluster service is needed.

### Evaluation presentation

Only a complete MultiPV iteration is preferred when a deeper iteration has not
finished. Candidate moves are legality-checked, deduplicated, and ordered by
score, with faster winning mates and slower losing mates preferred. Deltas use
the resulting best comparable score, so finite deltas cannot become negative.
Negative mate scores name the actual winning side.

Move quality is loss versus the best evaluated move, not position balance.
The primary row value is 0.00 for best (including in a losing position), then
negative pawn losses. Fixed stops are 0.00 green, −0.10 greenish, −0.25 amber,
and −0.50 saturated red. All worse losses retain the same red. Intermediate
values interpolate continuously. Candidate count and the worst displayed move
never stretch the scale. These are the requested product calibration thresholds,
not universal engine definitions of a chess blunder.

One shared scale drives ranks, row edges, score text, squares, arrows, hover
previews, and the visible legend. Position balance remains separately labeled
from White's perspective, with each candidate's mover-perspective evaluation
shown as secondary “Eval” text. Bounds are marked uncertain; mate alternatives
use qualitative labels without pretending mate distance is centipawn loss.
Equivalent best moves share zero loss. Exact score ordering prefers faster
winning mates and slower losing mates, honors the engine choice among ties, and
deduplicates stale entries using their freshest exact evaluation.

## Validation

`npm run check` covers lint, unit tests, types, all workspace checks and production
build. `tests/e2e/games-reliability.spec.ts` exercises real engines over consecutive
plies, human replies, all free-play engines, cross-engine arena pause/resume and
archive, plus an independent browser solver that clears an expert Minefield using
only visible clues. It also captures late-game and narrow-screen screenshots.
`tests/e2e/platform.spec.ts` covers the desktop, embedded games, multiplayer, and
existing interactions. A local PostgreSQL instance is required for durable arena
and room tests. Run the browser suite against `next start` after a production
build; do not run `next dev` and `next build` against the same `.next` directory.
