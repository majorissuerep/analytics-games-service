# Add a game

Choose one lane.

## External game — recommended default

Host game on any HTTPS origin. Implement bridge v1 from `packages/game-bridge`:

```ts
import { readyMessage, exitMessage } from '@analytics-games/game-bridge'

window.parent.postMessage(readyMessage(), 'https://analytics-games.example')

window.addEventListener('message', (event) => {
  if (event.origin !== 'https://analytics-games.example') return
  if (event.data?.type === 'host.init') {
    // locale, sessionId, returnUrl, capabilities
  }
})

function leaveGame() {
  window.parent.postMessage(exitMessage('complete'), 'https://analytics-games.example')
}
```

Register strict manifest with `POST /api/platform/games` and admin bearer token. Required integration section:

```json
{
  "kind": "external",
  "launchUrl": "https://team-game.example/play",
  "origin": "https://team-game.example",
  "bridgeVersion": 1,
  "openMode": "embedded"
}
```

Use `openMode: "redirect"` when host forbids framing. Game receives `ag_return_url` and must provide a visible return action.

## Internal engine game

Create workspace:

```text
games/my-game/
  package.json
  manifest.ts
  model.ts
  server.ts
  client/Game.tsx
```

Server module implements `createState`, `reduce`, `project`, and `leaderboardEntry`. Client uses `useGameRoom()` and sends semantic actions—never replacement state.

Register manifest in `games/catalog.ts`, rules in `lib/engine/server/registry.ts`, and client component in `games/client-registry.tsx`.

Add tests for permissions, full flow, score derivation, secret projection, and JSON-safe state.

## Rendering engine

React/DOM remains valid. For canvas/WebGL games, Phaser 4 is recommended as an optional game-owned dependency. Its global and scene plugin contracts give game teams a mature plugin ecosystem without forcing Phaser into the portal or other games.
