# Current iteration

- Request: `experience/requests/minefield-elite.json`; CLI/CI pointer: `experience/current.json`.
- Baseline/rollback: `b63e82a0af6d5648f85c431b178914e90163dbdc` (accepted PR #77).
- Branch: `feat/minefield-extreme-elite`.
- Production: https://analytics-games-service.vercel.app
- Candidate: http://localhost:3132; coordinator alone builds/starts servers.
- Owner: root owns contracts, independent oracle/browser tests, integration and release.
  `minefield_extreme_owner` (GPT6.1 Sol) owns Minefield implementation and dossier.
  `minefield_review` independently challenges readiness and candidate/live evidence.
- Intent: normal explainable no-guess logic; harder two-layer mode with truthful,
  optional unlimited echo scans and nontrivial subset/cross deductions.
- Baseline audit: no demonstrated false deduction; existing tests reuse the solver.
  Cropped screenshot lacks full clues/budget. Wrong flags may obstruct safe opening.
- Readiness, candidate and deployment status live in their actual receipts. This
  context does not certify completion or acceptance. Prior PR77 evidence remains
  on its QA tags; historical requests are evaluated at their matching source commit.
