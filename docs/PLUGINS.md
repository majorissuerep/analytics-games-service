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

## Assistant example

`plugins/paperclip-assistant` uses Motion for spring/loop animation and an original CSS-drawn character named Pip. It deliberately does not use React95 Clippy or clippy.js assets: React95 license says Microsoft-associated images are outside its MIT grant.

## Game plugins

Desktop plugins and game-engine plugins are different. Phaser games may use Phaser global/scene plugins and community packages within their own workspace. Those dependencies never enter other games unless imported.

## Untrusted extensions

Never load arbitrary remote JavaScript as a desktop plugin. Package plugins run with portal authority. Untrusted or separately released experiences must use external game iframe contract.
