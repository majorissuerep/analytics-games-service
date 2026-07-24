# Analytics Games

Desktop-shaped web platform for games built across analytics teams. Consensus Radar remains the multiplayer engine reference; three isolated browser-local classics demonstrate lightweight games without server state. Independently hosted HTTPS games integrate through bridge v1.

## Why this exists

Original prototype made one game equal whole application: room persistence, client polling, rules, private data, scoring, translations, and 1,400+ lines of visuals lived together. Database had no game identity. Adding another game meant copying app.

Platform now separates two layers:

- Millennium Desktop owns discovery, windows, entry/exit, plugin slots, and external bridge.
- Optional engine owns room codes, capabilities, polling, locked actions, private projections, and leaderboards.
- Game owns deployment, rules, content, and visuals. It may live here or at any registered HTTPS URL.

## Run

```bash
cp .env.example .env.local
npm install
npm run dev
```

Pip's optional repository-aware chat requires `OPENROUTER_API_KEY` as a server-side deployment secret. Without it, the desktop and games continue to work and Pip reports that chat is not configured. The key is never exposed to the browser.

Production and preview workflows run the idempotent `scripts/migrate.mjs` before deployment.
Local development also initializes missing tables on first API use. Canonical engine DDL:
`db/migrations/0001_game_platform.sql`.

## Quality and security

`npm run check` runs ESLint (Next.js, TypeScript, React, and security rules), tests,
workspace type checks, and a production build. `npm run scan:security` additionally
runs npm audit, Gitleaks, Trivy, actionlint, and zizmor locally. CI also runs CodeQL
while Dependabot opens weekly npm and Actions updates. Scanner versions, container
images, and GitHub Actions are pinned.

```bash
npm test
npm run build
```

## Add game — short version

External game (recommended):

1. Host anywhere over HTTPS.
2. Implement `game.ready` / `host.init` / `game.exit` bridge v1.
3. Register strict manifest through `POST /api/platform/games`.
4. Desktop handles launch and return; no platform source contribution needed.

Internal engine game:

1. Create `games/<game-id>/manifest.ts`, `model.ts`, `server.ts`, and client component.
2. Implement `createState`, `reduce`, `project`, and `leaderboardEntry` in server module.
3. Register manifest in `games/catalog.ts`, server rules in `lib/engine/server/registry.ts`, client in `games/client-registry.tsx`.
4. Use `useGameRoom()` in client; send semantic actions, never replacement room state.

Browser-local game:

1. Create `games/<game-id>/manifest.ts` and a client component.
2. Keep gameplay/state/assets inside that workspace.
3. Register manifest in `games/catalog.ts` and client in `games/client-registry.tsx`.
4. No room API or database code required.

See [docs/ADDING_A_GAME.md](docs/ADDING_A_GAME.md), [docs/EXTERNAL_GAMES.md](docs/EXTERNAL_GAMES.md), and in-app `/develop` page.

## Layout

```text
app/                         desktop entry, dynamic game route, APIs
components/desktop/          window manager and bridge host
games/                       isolated internal game workspaces
packages/                    bridge and plugin SDK workspaces
plugins/                     desktop plugin workspaces
lib/engine/client/           reusable browser room client
lib/engine/server/           registry, room store, leaderboards
db/migrations/               PostgreSQL schema
docs/                        architecture + author guide
```

Built-ins: Consensus Radar, Minefield, Orbit Pinball, and Paintbox. Desktop plugins: Pip Assistant, Sticky Note, Game Shuffle, and Game Counter.
