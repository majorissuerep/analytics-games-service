# AGENTS.md

## Project overview

- Next.js 16 / React 19 / TypeScript web-games platform with a desktop shell.
- Internal games run in same-origin iframes; external games use `@analytics-games/game-bridge`.
- Tests use Vitest and Playwright. Production deploys to Vercel.

## Application design

- Start experience work with [docs/experience/VISION.md](docs/experience/VISION.md),
  [WORKFLOW.md](docs/experience/WORKFLOW.md) and [CURRENT.md](docs/experience/CURRENT.md).
  The current request and `experience/apps/*.json` are acceptance contracts. They
  supersede conflicting historical design/QA notes. The user remains authoritative.
- Gate request readiness before app implementation, candidate promotion before
  merge, and actual deployed acceptance after rollout. Use `experience:gate` and
  an independent agent review of the exact candidate evidence. A green test count,
  CSS token or screenshot file alone is never visual approval. Blocking findings
  stop promotion; deployed failures produce an explicit hotfix/rollback decision.
- CI retains a retry for diagnosis but fails runs with flaky tests. Investigate
  the first failed attempt; a later passing retry cannot authorize promotion.
- Use actual elementary OS and Zorin OS references for current app content; inspect
  real screenshots and translate their task hierarchy/material into original app
  decisions. Preserve XP outer chrome. No opening slogans or ornamental editorial
  copy. Use useful glossy rounded controls with a limited palette.
- Test real requested XP windows, constrained sizes, resize/maximize/restore and
  long/dynamic states. Check named scroll owners and action hit-testing before any
  automatic scrolling. Capture viewport images plus dynamic sequences. Never use
  full-page screenshots to certify visible controls. Bind evidence/reviews to the
  source tree and actual build; retain CI artifacts and review verdicts with the PR.
- Cost control: one owner per affected app, shared behavior owned once, independent
  reviewer can reject; focused local deltas then required CI on a frozen candidate.
  Only coordinator starts/builds servers. Reuse current context and contract IDs.

- All application content uses Prism in `public/styles/app-theme.css` and an `app-surface` root. Read [docs/APPLICATION_DESIGN.md](docs/APPLICATION_DESIGN.md) and its research before changing presentation; `/design-system` is the live component reference.
- Keep the XP desktop, Start menu, taskbar, outer window borders, title bars, and window controls styled by `xp.css` and the shell. Application content does not inherit XP bevels or title-bar styling.
- Read [docs/APP_PERSONALITY_BRIEF.md](docs/APP_PERSONALITY_BRIEF.md). The shared engine defines interaction, geometry, scroll ownership, typography roles, spacing, focus, feedback and accessibility; every app owns its composition, material character and scoped token palette. At most two decorative chromatic families per app plus a small neutral ramp; semantic domain colors are explicit exceptions. No permanent glow/animation. Research and record each app in `docs/app-personalities/`.
- Shared patterns are reusable, not a mandatory uniform appearance. For app-specific design work, use a separate GPT-6.1 Sol agent per app when available, with the research/alternatives/implementation brief above. Preserve cross-app accessibility and regression checks.
- Pink anchors primary intent and selection. Put useful category/value/status color in content; backgrounds may be whitish or greyish. Use material, typography, shape, spacing, and explicit interaction states together; a background recolor is insufficient.
- Use bounded frosted layers for controls/floating surfaces, stable backing for dense content, and opaque playfields. Honor reduced transparency/contrast/motion and the persisted material preference across frames; never reduce entire-component opacity to create glass.
- Preserve semantic gameplay color (paint swatches, team identities, chess score colors) and essential playfield artwork. Do not style chess piece buttons as application form controls.
- Chess move-quality color measures loss from the best move: 0 green, −0.10 pawns greenish, −0.50 and worse saturated red. Show position balance separately; never color candidates by absolute position score or stretch colors across the listed candidates.
- The standalone pinball cabinet links the shared stylesheet; the Cosmic Forge workbench assembly copies it. External games can opt in using the stylesheet documented on `/develop`.
- All user-visible waits use scoped progress with stage and elapsed time. Unknown work stays indeterminate; percentages require measured work and a known total. Keep unrelated controls responsive, abort stale work, bound network waits, and offer recovery on failure. See the waiting contract in `docs/APPLICATION_DESIGN.md`.
- Verify `tests/e2e/application-design.spec.ts` together with relevant gameplay regressions before release.

## Analytics (consent-gated event relay)

### Runtime and configuration

- Browser transport: `lib/analytics/client.ts` sends allowlisted events to the
  same-origin `/api/analytics/events` relay. No third-party browser SDK is loaded.
- Server configuration: `EVENT_TRACKING_ENABLED`, `EVENT_WRITE_KEY` and optional
  `EVENT_TRACKING_URL`; keys stay server-side. `app/layout.tsx` passes only the
  configured boolean to `AnalyticsProvider`.
- Initialization and consent UI run only in the top-level browsing context.
  Embedded games relay events to their same-origin parent.
- Consent is explicit opt-in, browser-local persistence, and opt-out by default.
  Closing the initial card does not grant consent. The Privacy control reopens it.
- Identity is an opaque browser-local anonymous ID. No user profiles, free-form
  message data, autocapture or session recording. Never put credentials in events.
- The server validates event names, property allowlists and payload size before
  forwarding through `EventTrackingClient`. Do not claim a hosting region or
  retention period unless deployment evidence establishes it.

### Tracking API

- Use `trackAnalyticsEvent` or `trackGameSessionStarted` from `lib/analytics/client.ts`.
- Event names are a fixed TypeScript union in `lib/analytics/controller.ts`. Do not introduce dynamic event names.
- Game completion signals go through `emitGameSessionCompleted` in `lib/analytics/game-events.ts`; embedded games send the versioned game-bridge telemetry message and the host records the event.
- Embedded room events use the allowlisted same-origin relay in `lib/analytics/internal-relay.ts`; game frames never initialize a second analytics controller.
- Never include room codes, player names, prompts, message text, passwords, email addresses, tokens, or other free-form user content in analytics properties.

### Event taxonomy

| Event | Trigger | Required properties | Source |
| --- | --- | --- | --- |
| `platform_viewed` | Desktop becomes visible after consent | `games_available`, `path` | `components/desktop/DesktopShell.tsx` |
| `game_session_started` | A desktop or standalone game session opens | `game_id`, `game_title`, `game_version`, `integration_kind`, `launch_context`, `is_returning_user` | `components/analytics/useTrackedGameSession.ts` |
| `game_session_completed` | A game emits a real terminal/value signal | `game_id`, `result`, `duration_seconds` | `components/analytics/useTrackedGameSession.ts` |
| `game_session_ended` | The game frame/window unmounts | `game_id`, `duration_seconds`, `completed`, `exit_reason` | `components/analytics/useTrackedGameSession.ts` |
| `multiplayer_room_created` | Room creation API succeeds | `game_id`, `player_count`, `is_password_protected` | `lib/engine/client/use-game-room.ts` |
| `multiplayer_room_joined` | Room join API succeeds | `game_id`, `player_count` | `lib/engine/client/use-game-room.ts` |
| `multiplayer_room_started` | Supported multiplayer start action succeeds | `game_id`, `player_count` plus bounded game configuration | `lib/engine/client/use-game-room.ts` |

All events also receive `platform: "web"` from the analytics controller.

### Value moments

- Primary: a player completes a game or saves a completed creation (`game_session_completed`).
- Secondary: a player launches a game (`game_session_started`).
- Multiplayer: a host successfully starts a room (`multiplayer_room_started`).
- Retention: a launch has `is_returning_user: true`, based on prior consented game starts stored locally.

### Supported completion signals

- Chess: terminal checkmate/draw/resignation and completed model match.
- Minefield: won or lost.
- Paintbox: PNG save.
- Space Cadet: launch/end tracking; native game-over completion awaits an explicit engine callback. Do not infer completion from time or button presses.

### Governance and verification

- Owners: repository maintainers until explicit Product and Engineering analytics owners are assigned.
- Review this plan whenever an event/property changes, authentication is added, consent requirements change, or a game adds/removes a completion state.
- Unit tests: `lib/analytics/*.test.ts`.
- Browser verification: the event-relay Playwright test in `tests/e2e/platform.spec.ts` intercepts the same-origin analytics endpoint and proves pre-consent silence, launch, completion, and end events.
- Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run check`, `npm run build`, and the relevant Playwright test before release.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
