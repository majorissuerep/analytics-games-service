# Desktop plugins

Desktop plugins are reviewed npm workspace packages. They can contribute to explicit shell slots without coupling games to portal internals.

```text
plugins/my-plugin/
  package.json
  src/index.tsx
```

Export `DesktopPluginDefinition` from `@analytics-games/plugin-sdk`, then add it to `plugins/registry.ts`.

Current slots:

- `desktop-overlay`
- `tray`
- `start-menu`

Plugin manager exposes installed versions and browser-persisted enable/disable state. Add lifecycle hooks to SDK rather than importing desktop store internals.

Bundled examples cover every slot:

- `paperclip-assistant`: animated overlay and contextual help.
- `sticky-note`: browser-local editable overlay state.
- `game-shuffle`: Start-menu action using catalog summaries from plugin context.
- `session-meter`: compact tray status.

Slot placement belongs to shell. Plugin components render only their contribution; they must not use absolute positioning unless their slot is `desktop-overlay`.

## Assistant example

`plugins/paperclip-assistant` uses Motion for spring/loop animation and an original CSS-drawn character named Pip. It deliberately does not use React95 Clippy or clippy.js assets: React95 license says Microsoft-associated images are outside its MIT grant.

Pip v2 includes a compact chat app backed by `POST /api/pip/chat`. The browser never receives the provider credential. The server validates and bounds conversation history, retrieves a small relevant slice of the curated repository/game knowledge in `lib/pip/chat.ts`, limits output to 320 tokens, and rate-limits callers. It pins the paid `xiaomi/mimo-v2.5` model and sends `provider: { zdr: true }` on every OpenRouter request, so a request fails rather than route to a non-ZDR endpoint. Configure only `OPENROUTER_API_KEY` in the deployment secret store or uncommitted local environment.

The app does not persist chat messages. OpenRouter states that prompts are not retained unless prompt logging is explicitly enabled; request-level ZDR additionally restricts routing to zero-retention endpoints. This is not a substitute for reviewing the OpenRouter account privacy settings.

## Game plugins

Desktop plugins and game-engine plugins are different. Phaser games may use Phaser global/scene plugins and community packages within their own workspace. Those dependencies never enter other games unless imported.

## Untrusted extensions

Never load arbitrary remote JavaScript as a desktop plugin. Package plugins run with portal authority. Untrusted or separately released experiences must use external game iframe contract.
