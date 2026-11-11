# Scoped loading feedback QA

11 November 2026. Related contract: [Application design](APPLICATION_DESIGN.md#waiting-progress-and-recovery).

The shared component covers page, app, section, and inline waits. Its stage and
elapsed clock are observable; unknown work has no invented percentage. Real
upload byte counts have a known total. Engine APIs retain JSON compatibility
and offer SSE startup/search/result events to the UI.

Validation:

- Quality gate: lint, 239 unit tests, typecheck, workspace checks, production build.
- Browser regressions: application design at 1280/390/320px; XP shell boundary;
  human vs engine and free play for Stockfish 18/19 and Reckless; styled engine;
  mixed engine arena pause/resume/replay; 99-mine board cleared by deduction;
  private Chess and multiplayer Radar room flows; Pinball cabinet/mute/exit.
- Delayed/failing work: engine startup stages and elapsed time, abort/retry,
  interrupted iframe opening and timeout/retry, modal leaderboard failure/retry,
  PNG export while drawing controls remain available, stalled Pip cancellation,
  keyboard cancellation/reduced motion, worker verification attempt updates,
  and room creation failure preserving player input.
- Real SSE endpoint check: all four available engine/model runtimes return
  progress events and a legal move. Unit checks also prove startup is delivered
  before work finishes, warm reuse does not report a cold start, queued work is
  observable, and cancelled queued work never starts a search.
- Visual review: the engine startup card and the whole-app window loader use
  Prism pink, readable text, quiet backing, and visible cancel controls. The XP
  title bar and taskbar remain usable outside the app loading scope.
- Cosmic Forge workbench assembly and loading/readiness/error UI were checked
  with a runtime-factory fixture. The Powder Toy WASM engine is not installed
  in this workspace, so its full simulation verification was not run.

External apps own their internal loading states. The host covers frame opening;
authors should follow the same scoped feedback contract inside their content.
Engine percentages stay indeterminate: UCI readiness, depth, and candidate
verification attempts do not provide a trustworthy completion total.
