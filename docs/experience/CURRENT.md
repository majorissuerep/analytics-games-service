# Current iteration

- Request: `experience/requests/chess-current-position.json`; CLI/CI pointer: `experience/current.json`.
- Baseline/rollback: `e816ad49f861f23e05e76f4d2d60d758475cc6c7` (accepted PR #78).
- Branch: `fix/chess-current-position`.
- Production: https://analytics-games-service.vercel.app
- Candidate server/build controlled by root only; port announced after build.
- Owner: `chess_current_position` (GPT-6.1 Sol) owns Chess client, transport and UCI runtime cancellation; root owns contracts, independent browser tests, integration and release.
- Reviewer: `chess_cancellation_review` independently challenges readiness and actual candidate/live evidence.
- Intent: only the current board/request generation owns predictions; abort obsolete processing and remove queued work without affecting other players.
- Baseline audit: Promise-tail retains canceled queue slots; SSE consumer cancellation does not signal inference; startup and readiness cancellation delayed; move invalidation relies on effect cleanup and late client reads can escape explicit Cancel.
- Functional delta preserves existing composition, color calibration and engine selection. References are AbortSignal, ReadableStream cancellation and UCI stop/bestmove protocol.
- Status lives in actual request, promotion and deployed receipts. This context does not certify acceptance. Prior PR78 receipts/evidence remain on its QA tags.

- Provider audit found Vercel request cancellation requires per-function opt-in.
  The amended request requires scoped configuration and preregistered `after`
  retention of actual engine cleanup. Prior candidate2 CI passed 97 browser/235
  unit tests but is not promoted without provider integration. Fresh receipts
  must use the amended request hash and final source.

- Final candidate3 review found narrow loading Cancel clipped below the detail pane.
  Promotion was withdrawn before merge. Inference/evaluation Cancel and Retry now
  use the anchored action footer; fresh candidate4 must hit-test requested,
  390×844 and 320×640 dynamic states before scrolling, including Moves and
  simultaneous automatic move/evaluation controls. Frozen evidence may never be
  overwritten by a diagnostic rerun; use unique capture directories.
