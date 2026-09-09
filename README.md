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

## Tuned opening model

Chess keeps Stockfish 18 as the default browser opponent and adds Stockfish 19 as a selectable alternative. Computer games also show a side evaluation bar powered independently by Stockfish 19; scores are displayed from White's perspective with mate handling. `Tuned Opening Style` remains a separate opponent. The tuned model is the selector-conditioned Otter checkpoint from the sibling `ml-anti-stockfish-service` project. Production runs the committed ONNX export through `onnxruntime-web`'s single-threaded WASM CPU backend; it does not require Python, CUDA, or a second service. The model, vocabularies, compact opening book, provenance metadata, and reproducible builder live in `public/models/` and `scripts/build_styled_runtime_artifacts.py`.

The optional Python sidecar remains useful for local parity checks:

```bash
npm run chess-styled:serve
```

Set `STYLED_CHESS_INFERENCE_URL=http://127.0.0.1:8765` only when intentionally using that sidecar. Leave it unset for the bundled CPU runtime used by the deployed Next.js service. Artifact paths can be overridden with `STYLED_CHESS_ONNX_PATH`, `STYLED_CHESS_POLICY_VOCAB_PATH`, `STYLED_CHESS_HISTORY_VOCAB_PATH`, and `STYLED_CHESS_BOOK_PATH`.

In Chess → Computer, select `Tuned Opening Style`, choose one of Italian Game, Queen's Gambit, Caro–Kann Defense, or Slav Defense, and start the game. The browser sends the complete UCI history and legal move set to the Next.js route; the route validates the move against `chess.js` before applying it. The runtime enforces the trained opening book when the current line is known and falls back to the legal neural policy after a deviation. If inference returns malformed output, no move is applied and the UI reports a safe failure; Stockfish remains available.

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

Built-ins: Chess, Consensus Radar, Minefield, Neon Forge Pinball, and Paintbox. Desktop plugins: Pip Assistant, Sticky Note, Game Shuffle, and Game Counter.
