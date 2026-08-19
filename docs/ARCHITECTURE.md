# Architecture

## Product boundary

Analytics Games is a desktop-shaped launcher and integration platform, not one large game.

```text
Millennium Desktop
  ├─ local game window ───── isolated browser state/canvas
  ├─ multiplayer window ──── shared room engine ── PostgreSQL
  ├─ external game window ── bridge v1/postMessage ── any HTTPS host
  └─ desktop plugins ─────── typed build-time plugin SDK
```

The shell owns discovery, windows, entry, exit, plugin slots, and the external bridge. A game owns gameplay and visuals.

## Integration lanes

### Internal engine game

Use when a game benefits from shared multiplayer infrastructure:

- room codes and pseudonymous player capabilities;
- serialized semantic actions under PostgreSQL row locks;
- server-owned state, random choices, scoring, and role-specific projections;
- per-game leaderboards.

Internal modules live in isolated `games/*` workspaces. Consensus Radar is the reference.

### Browser-local game

Use for classics and experiments that do not need shared persistence. Game owns its React/canvas state and pure rule modules inside one workspace; portal only discovers, launches, and closes it. Minefield and Paintbox exercise DOM and canvas drawing without adding server coupling. Neon Forge is a browser-local game with original table/rule/rendering modules and a narrow Planck.js adapter for fixed-step collisions and flipper joints inside `games/orbit-pinball/`.

### External URL game

Use when another team owns deployment and repository:

- game remains on its own HTTPS origin;
- platform stores a strict catalog manifest in `platform_games`;
- desktop opens the URL in a sandboxed iframe or same-tab redirect;
- bridge v1 handles readiness, host context, and exit;
- origin and iframe source are checked for every message.

No room engine, framework, release process, or source contribution is required.

## Monorepo seams

```text
app/                       Next.js portal and APIs
components/desktop/        desktop/window host
games/*                    independently owned internal game workspaces
packages/game-bridge/      external integration contract
packages/plugin-sdk/       desktop plugin contract
plugins/*                  independently owned desktop plugin workspaces
lib/engine/                optional shared multiplayer engine
db/migrations/             canonical schema
```

Root npm workspaces make ownership explicit. Turborepo task configuration supports package-specific build/check pipelines when more games arrive.

## Security boundary

Full room state never comes from a browser. External messages require exact origin, exact source window, protocol name, and protocol version. External iframes do not receive top-navigation permission. Desktop plugins execute in the portal bundle and therefore require code review; untrusted remote experiences must use the iframe bridge instead.

## Deliberate limits

- Player identity is pseudonymous, suitable for internal play rather than prizes.
- External catalog administration uses one bearer token. Replace with company SSO/RBAC before broad self-service.
- Polling remains room transport. WebSocket/SSE can be added behind the existing client contract.
