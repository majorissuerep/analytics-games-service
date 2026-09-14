# Self-hosted event tracking

This app sends product analytics to the self-hosted event platform in the
MicroK8s cluster. Mixpanel is not used.

## Data path

```text
Consent-granted browser
  -> same-origin POST /api/analytics/events
  -> Next.js server relay
  -> https://events.theincompetent.app/api/s/s2s/track
  -> X-Write-Key auth proxy
  -> Jitsu Ingest -> Kafka -> Rotor -> Bulker -> ClickHouse
```

The browser never receives or sends the Site write key. It stores only an
opaque anonymous ID after consent and sends the fixed application event
allowlist. The server relay rejects unknown event names, unknown property keys,
invalid values, cross-origin requests, non-JSON requests, and relay bodies over
64 KiB. Game IDs, titles, versions, integration kinds, paths, and chess time
controls come from fixed server-side allowlists; browser-supplied dynamic or
external game metadata is rejected until explicitly added to that catalog. The
cluster edge remains the final 1 MiB request limit.

The cluster guides are authoritative for the platform contract:

- `microk8s-setup/docs/event-tracking/README.md` — overview;
- `QUICKSTART.md` — onboarding and canary;
- `API_REFERENCE.md` — wire fields and response codes;
- `SDK_SETUP.md` — server-only adapter rules;
- `OPERATIONS.md` — ownership, rotation, and verification;
- `microk8s-setup/docs/EVENT_TRACKING.md` — system architecture;
- `microk8s-setup/docs/runbooks/EVENT_TRACKING_USAGE.md` — usage runbook;
- `microk8s-setup/docs/runbooks/EVENT_TRACKING_OPEN_ENDPOINTS.md` — public
  endpoint and security contract.

## Deployment configuration

Set these as server-side deployment variables. `EVENT_WRITE_KEY` must come from
the approved secret manager. Do not use a `NEXT_PUBLIC_*` name and do not put the
key in Git, a browser bundle, a source map, a log, or a support bundle.

```text
EVENT_TRACKING_ENABLED=true
EVENT_TRACKING_URL=https://events.theincompetent.app
EVENT_WRITE_KEY=<Site write key injected as a server secret>
```

The current cluster proxy accepts one exact key from its shared
`platform/event-tracking` Vault record. That is a known single-key boundary, not
per-application revocation. Do not add another trust domain without a platform
security decision or a separate key boundary.

For local development, leave `EVENT_TRACKING_ENABLED=false` unless a synthetic
Site key has been provisioned. For a real development canary, enable the flag
and load the key through the local secret manager. Never paste it into a shell
command or `.env` file that is not explicitly protected.

## Event contract

The app preserves the existing event taxonomy:

- `platform_viewed`;
- `game_session_started`;
- `game_session_completed`;
- `game_session_ended`;
- `multiplayer_room_created`;
- `multiplayer_room_joined`;
- `multiplayer_room_started`.

Each request uses one stable `messageId`. The server adapter reuses that ID for
all retries. It sends only `POST /api/s/s2s/track` with JSON and
`X-Write-Key`; it never sends `Authorization` and never follows redirects.
Retryable conditions are network failures, `429`, and `5xx`, capped at three
attempts. Permanent `4xx` responses are not retried.

The app sends only opaque anonymous identity. It does not send user names, room
codes, prompts, message text, passwords, email addresses, tokens, or arbitrary
free-form content. Product analytics uses this consent-controlled self-hosted
path only.

## Verification

### Local unit and type checks

```bash
npm run test -- lib/analytics
npm run lint
npm run typecheck
npm run build
```

The adapter tests prove the exact route, JSON content type, `X-Write-Key`, lack
of `Authorization`, stable IDs across retries, permanent-error behavior, and
local 1 MiB rejection. The route tests prove the browser relay validation and
server forwarding without using the real key.

### Browser journey

Run the existing Playwright journey with a synthetic server key. Start the app
with the variables first; the test process cannot change the environment of an
already-running Next.js server. The test intercepts the same-origin relay, so it
does not publish a real event:

```bash
# Terminal 1
EVENT_TRACKING_ENABLED=true \
EVENT_WRITE_KEY=test-only-playwright-key \
npm run dev -- --port 3130

# Terminal 2
npm run test:e2e -- tests/e2e/platform.spec.ts -g 'self-hosted analytics'
```

It proves that no event leaves the browser before consent, then observes
platform view, game start, completion, and game end after consent.

### Public edge checks

From an authorized workstation, follow the cluster usage runbook. The safe
negative checks must remain true:

- missing `X-Write-Key` → `401`;
- client route `/api/s/track` → `404`;
- wrong method → `405`;
- non-JSON body → `415`;
- oversized body → `413`;
- unknown path or host → `404`.

A `2xx` from the public edge proves HTTP acceptance only. It does not prove
Kafka persistence, Rotor output, Bulker delivery, ClickHouse storage,
deduplication, ordering, or recovery. The platform owner must verify the exact
synthetic `messageId` at the required pipeline hop before production approval.

## Rollback and disable

Set `EVENT_TRACKING_ENABLED=false` through the normal deployment path. The app
then stops initializing the relay and makes no analytics HTTP calls. Do not
route around the public edge, expose Jitsu or Kafka, use a `.dev` compatibility
host, or accept the key through `Authorization` or a query parameter.
