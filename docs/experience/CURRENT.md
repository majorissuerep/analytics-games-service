# Current iteration

- Request: `experience/requests/desktop-refinement.json`
- Baseline: `da4a0e4a134fa36977eb2903360dbb5d61c4ed77`, PR #76.
- Branch: `feat/desktop-experience-contracts`.
- Production: https://analytics-games-service.vercel.app
- Local candidate server (coordinator controls dev/build/start): http://localhost:3132
- Owner: coordinator owns vision, request, shared materials, test integration,
  builds, release and evidence. App agents own Minefield, Chess and Pinball. Shell
  agent owns geometry/focus. Independent reviewer can block all of them.
- User priorities: Zorin/elementary reference quality; remove Minefield size/flag
  selectors; compact requested windows/no micro-overflow; fixed Chess navigation
  and reachable gameplay actions; useful board scaling; legible playable Pinball;
  repeated iframe body focus; executable three-stage acceptance.
- Current phase: request independently approved; app implementation and targeted checks complete; freeze, production-build evidence, promotion, CI and deployed acceptance pending.
- Baseline failures: Minefield 2px board overflow/60px page overflow/default1040×700;
  Chess long sections move nav/actions offscreen (actions around y1677 in731px);
  Pinball poor obstacle/ball hierarchy and missing narrow Ball state; iframe body
  click never reaches parent activation; mobile560px minimum overflows390px.
- Authority: latest user request, VISION.md, request/app contracts. Earlier
  document-scroll Chess guidance is superseded. No claim of approval from old QA.

- Iteration findings: hit-testing rejected Pip over Chess actions (moved explicit
  access into taskbar); native Pinball transparency required a renderer fix;
  touch cancel, worker recovery, archive navigation and readable board panning
  now have actual scenario coverage. None are approved from working captures.
- Runtime discipline: one coordinator runs browser suites against a stable build.
  App agents may use separate output directories for focused probes; never run
  shared output folders or interpret HMR navigation as frozen-release evidence.
