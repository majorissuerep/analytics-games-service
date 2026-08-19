# AGENTS.md

## Project overview

- Next.js 16 / React 19 / TypeScript web-games platform with a desktop shell.
- Internal games run in same-origin iframes; external games use `@analytics-games/game-bridge`.
- Tests use Vitest and Playwright. Production deploys to Vercel.

## Analytics (Mixpanel)

### SDK and configuration

- SDK: `mixpanel-browser`.
- Project token source: server-only environment lookup of `MIXPANEL_PROJECT_TOKEN` in `app/layout.tsx`; the public project token is passed to `AnalyticsProvider` at runtime. Never hard-code the token in source.
- Initialization: `lib/analytics/client.ts`, mounted only in the top-level browsing context by `components/analytics/AnalyticsProvider.tsx`.
- Data residency: the Mixpanel project is hosted in the EU; SDK requests must use `https://api-eu.mixpanel.com`.
- Initialization settings: local-storage persistence, no automatic page-view tracking, no batching, and opt-out by default.
- Consent: explicit opt-in. No custom events are sent before `granted` consent. The top-level app owns the consent UI; embedded game frames do not show duplicate prompts.
- Identity: anonymous Mixpanel device identity only. This project has no authenticated user identity, so do not call `identify`, `alias`, or set People profiles unless authentication is introduced and the identity plan is reviewed.
- Session recording and autocapture are not enabled.

### Tracking API

- Use `trackAnalyticsEvent` or `trackGameSessionStarted` from `lib/analytics/client.ts`.
- Event names are a fixed TypeScript union in `lib/analytics/controller.ts`. Do not introduce dynamic event names.
- Game completion signals go through `emitGameSessionCompleted` in `lib/analytics/game-events.ts`; embedded games send the versioned game-bridge telemetry message and the host records the event.
- Embedded room events use the allowlisted same-origin relay in `lib/analytics/internal-relay.ts`; game frames never initialize a second Mixpanel SDK instance.
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
- Consensus Radar: final phase reached.
- Minefield: won or lost.
- Paintbox: PNG save.
- Pinball: game over when all balls drain.

### Governance and verification

- Owners: repository maintainers until explicit Product and Engineering analytics owners are assigned.
- Review this plan whenever an event/property changes, authentication is added, consent requirements change, or a game adds/removes a completion state.
- Unit tests: `lib/analytics/*.test.ts`.
- Browser verification: the Mixpanel Playwright test in `tests/e2e/platform.spec.ts` intercepts the real SDK endpoint and proves pre-consent silence, launch, completion, and end events.
- Run `npm run test`, `npm run lint`, `npm run typecheck`, `npm run check`, `npm run build`, and the relevant Playwright test before release.
