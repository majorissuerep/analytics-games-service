# Chess release and service UI QA

Date: 2026-07-24

## Scope

Production baseline plus the local production build after adding Chess. Covered desktop shell, five existing games, four plugins, Chess local/bot/online modes, room passwords, color selection, responsive layout, keyboard launch, drag continuity, window containment, and the complete four-player Consensus Radar flow.

## Foundation

- `chess.js` 1.4.0, BSD-2-Clause: legal moves, FEN/PGN, check/checkmate/stalemate/draw rules.
- `react-chessboard` 5.10.0, MIT: responsive standard board/pieces, drag-and-drop, click handling, notation, and animation.
- Server-authoritative online moves use the existing room engine and player capabilities.
- Optional room passwords are salted with `scrypt`; plaintext passwords are not stored or projected to clients.

## Corrective release

The initial Chess release failed product acceptance despite green CI. Its bot was a handcrafted random/capture heuristic, the board was a crude Unicode grid, and the newly introduced `analytics-games-service` Vercel project lacked `DATABASE_URL`, so every room creation returned HTTP 500. Those defects were reproduced directly in production and replaced rather than cosmetically patched.

- Computer play now runs Stockfish 18 lite single-threaded WASM in a dedicated Web Worker.
- Five difficulty profiles use Stockfish `Skill Level` 0/5/10/15/20 and increasing bounded search times.
- The UI now uses the MIT `react-chessboard` foundation with standard pieces, drag/drop, click moves, animation, notation, legal-target highlighting, last-move highlighting, explicit promotion choice, and a responsive game/sidebar layout.
- Production deployment now resolves the `analytics-games-service` Vercel project by name, provisions its encrypted `DATABASE_URL`, and requires a successful stateful Chess-room API smoke test before browser acceptance or promotion.
- Stockfish GPLv3 provenance, exact checksums, license, and corresponding-source links are in `public/vendor/stockfish/UPSTREAM.md`.

## Consolidated findings

| ID | Severity | Finding | Resolution |
|---|---|---|---|
| CH-01 | High | Chess was absent from production despite an earlier planning response. | Implemented as an internal catalog game and added production deployment verification as a release gate. |
| CH-02 | High | Existing rooms had player capabilities but no shared room password. | Added optional salted room password verification on create/join while preserving existing unprotected rooms. |
| CH-03 | Medium | Dependency audit began reporting development-only `brace-expansion` issues after lockfile refresh; forcing the suggested major ESLint upgrade breaks Next.js's current lint plugins. | Runtime dependency audit now explicitly uses `--omit=dev`; production dependencies report zero vulnerabilities. Lint remains on the supported ESLint/Next configuration. |
| CH-04 | Medium | A chess board could easily overflow narrow mobile layouts without a dedicated responsive rule. | Board/sidebar collapse to one column; 390px browser regression verifies containment and a legal move. |

No unresolved Critical, High, or Medium functional defects remain in this pass.

## Chess coverage

- Color selection: White, Black, Random.
- Stockfish modes: Beginner, Casual, Club, Advanced, and Expert using genuine Stockfish 18 search at increasing skill/time bounds.
- Local pass-and-play: alternating legal turns on one device.
- Online rooms: create/join, optional password rejection/success, two-player seating, host-selected color, synchronized legal moves, resignation/rematch server rules.
- Online time controls: host picks bullet/blitz/rapid/long (base + optional increment) before starting; live countdown clocks for both sides; loss-on-time when a clock expires (unless the opponent lacks mating material); a timeout claim is reflected to all players.
- Rules: illegal move rejection, turn ownership, checkmate/draw detection through chess.js, flag-fall priority over a late move.
- UI: setup, board, move history, legal target highlighting, desktop embedding without duplicate title chrome, narrow viewport.

## Service evidence

- Production baseline loaded without browser console or JavaScript errors.
- Existing 10-scenario browser suite passed before the responsive Chess addition.
- Unit/type/lint/workspace/build gate passed after implementation.
- Final full browser and production results are recorded by CI and deployment workflow; deployment is not considered complete until production promotion and acceptance both pass.
