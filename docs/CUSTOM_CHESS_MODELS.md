# Custom Chess model operations

Historical cluster product/security contract: [`../specs/chess-custom-model-runtime.md`](../specs/chess-custom-model-runtime.md)

## Implemented foundation

- Public model catalog and submissions: `GET/POST /api/chess-models`
- Receipt status: `GET /api/chess-models/submissions/{receipt}`
- Ready-model inference proxy: `POST /api/chess-models/{revisionId}/move`
- Admin metadata changes: `PATCH /api/admin/chess-models/{modelId}`
- Admin review: `POST /api/admin/chess-models/{modelId}/revisions/{revisionId}/decision`
- Durable model matches: `GET/POST /api/chess-model-matches` plus move and pause endpoints
- Package schema: `/schemas/chess-model-v1.json`
- Active Vercel runtime: [reliability and runtime contract](GAME_RELIABILITY.md)
- Immutable public Hugging Face import with executable/remote-code rejection
- Optional checksum-bound S3-compatible quarantine upload

Stockfish 18, Stockfish 19, Reckless 0.9, and Tuned Opening Style run on Vercel,
loaded only when selected. Computer games evaluate with the selected UCI engine;
the policy model does not start a second evaluator. Resources have a two-hour
idle expiry within a warm function instance, subject to earlier Vercel eviction.

Cluster hosting is retired. Community submissions remain reviewable, but approval
alone does not make them playable. A supported Vercel adapter and canary proof are
required before adding a revision to the executable catalog. The inference route
re-derives legal moves from FEN, validates history, and rejects malformed or illegal
output. Historical cluster endpoints are never invoked.

## Required production secrets

Always required:

- `CHESS_MODEL_ABUSE_SALT` — hashes source IPs for the three-submissions-per-24-hours abuse limit.
- `CHESS_MODEL_ADMIN_TOKEN` — bearer token for admin-only endpoints; never expose it to browser code.

Direct upload additionally requires:

- `MODEL_STORAGE_BUCKET`
- `MODEL_STORAGE_REGION`
- `MODEL_STORAGE_ACCESS_KEY_ID`
- `MODEL_STORAGE_SECRET_ACCESS_KEY`
- `MODEL_STORAGE_ENDPOINT` — optional for AWS; required for MinIO/R2-compatible endpoints.
- `MODEL_STORAGE_FORCE_PATH_STYLE=true` — optional for MinIO.

When object storage is absent, the UI clearly disables direct package upload while immutable Hugging Face submissions remain available.

## Admin examples

The supported operator workflow is the checked-in CLI. Keep the bearer token in the process environment; never paste it into browser JavaScript:

```bash
export CHESS_MODEL_ADMIN_TOKEN='<value from the encrypted operator secret store>'
npm run chess-models:admin -- list
npm run chess-models:admin -- approve MODEL_ID REVISION_ID
npm run chess-models:admin -- reject MODEL_ID REVISION_ID 'Reason'
npm run chess-models:admin -- rename MODEL_ID 'New display name'
```

```bash
curl -X PATCH "$BASE/api/admin/chess-models/$MODEL_ID" \
  -H "Authorization: Bearer $CHESS_MODEL_ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  --data '{"displayName":"Renamed model","description":"Reviewed metadata"}'

curl -X POST "$BASE/api/admin/chess-models/$MODEL_ID/revisions/$REVISION_ID/decision" \
  -H "Authorization: Bearer $CHESS_MODEL_ADMIN_TOKEN" \
  -H 'content-type: application/json' \
  --data '{"decision":"approve"}'
```

Approval is accepted only from `pending_review`; it does not make a model playable. A supported Vercel adapter must be implemented and pass the legal-move canary before a model becomes selectable.

## Model arena and replay

- Any two supported built-in revisions may be selected, including Reckless and Tuned Opening Style.
- Computer games render the selected UCI engine’s evaluation; arena replays do not create an evaluation stream.
- The configured turn budget is 1–10 seconds; UCI search time excludes cold loading and queue wait. A move exceeding the budget is rejected, not silently clamped.
- A random control token authorizes move and pause mutations. Only its SHA-256 digest is stored; the browser keeps the token in local storage so the creator can resume after reload.
- Every accepted move stores UCI, SAN, resulting FEN, duration, timestamp, full PGN, and an optimistic-concurrency version in PostgreSQL.
- Match records and replay snapshots are public and immutable through replay APIs. Controls support first, previous, play/pause replay, next, and last position.

## Deployment

Push tested application changes to the Vercel-connected GitHub branch. Production
builds fetch the pinned Reckless binary, verify its checksum, and trace all bundled
WASM/NNUE/model assets. No Kubernetes deployment or cluster credentials are used.
