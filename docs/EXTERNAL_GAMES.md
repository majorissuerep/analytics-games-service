# External game bridge v1

Protocol name: `analytics-games.bridge`. Version: `1`.

## Lifecycle

1. Desktop loads registered HTTPS URL in sandboxed iframe.
2. Game posts `game.ready` to exact platform origin.
3. Host replies `host.init` to exact registered game origin.
4. Either window chrome closes game, or game posts `game.exit`.

Messages:

```ts
{ protocol: 'analytics-games.bridge', version: 1, type: 'game.ready' }

{
  protocol: 'analytics-games.bridge',
  version: 1,
  type: 'host.init',
  payload: {
    gameId, sessionId, locale, theme, returnUrl,
    capabilities: ['exit', 'focus', 'telemetry']
  }
}

{
  protocol: 'analytics-games.bridge',
  version: 1,
  type: 'game.exit',
  payload: { reason: 'complete' }
}
```

## Rules

- Never use `*` as `targetOrigin`.
- Reject events whose `origin` differs from configured origin.
- Host also checks `event.source === iframe.contentWindow`.
- Manifest `origin` must equal `launchUrl` origin.
- URL and origin must use HTTPS.
- Do not assume host cookies, storage, framework, or backend.

This narrow contract keeps external teams independent. New optional capabilities require a protocol-compatible additive message or version bump.
