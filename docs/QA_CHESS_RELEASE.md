# Chess release and service UI QA

Date: 2026-07-24

## Scope

Production baseline plus the local production build after adding Chess. Covered desktop shell, five existing games, four plugins, Chess local/bot/online modes, room passwords, color selection, responsive layout, keyboard launch, drag continuity, window containment, and the complete four-player Consensus Radar flow.

## Foundation

- `chess.js` 1.4.0, BSD-2-Clause: legal moves, FEN/PGN, check/checkmate/stalemate/draw rules.
- Project-owned responsive board UI: avoids external piece artwork and keeps controls accessible by square name.
- Server-authoritative online moves use the existing room engine and player capabilities.
- Optional room passwords are salted with `scrypt`; plaintext passwords are not stored or projected to clients.

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
- Bot modes: Easy random legal moves; Medium prioritizes legal captures.
- Local pass-and-play: alternating legal turns on one device.
- Online rooms: create/join, optional password rejection/success, two-player seating, host-selected color, synchronized legal moves, resignation/rematch server rules.
- Rules: illegal move rejection, turn ownership, checkmate/draw detection through chess.js.
- UI: setup, board, move history, legal target highlighting, desktop embedding without duplicate title chrome, narrow viewport.

## Service evidence

- Production baseline loaded without browser console or JavaScript errors.
- Existing 10-scenario browser suite passed before the responsive Chess addition.
- Unit/type/lint/workspace/build gate passed after implementation.
- Final full browser and production results are recorded by CI and deployment workflow; deployment is not considered complete until production promotion and acceptance both pass.
