# Custom Chess model operations

Canonical product/security contract: [`../specs/chess-custom-model-runtime.md`](../specs/chess-custom-model-runtime.md)

## Implemented foundation

- Public model catalog and submissions: `GET/POST /api/chess-models`
- Receipt status: `GET /api/chess-models/submissions/{receipt}`
- Ready-model inference proxy: `POST /api/chess-models/{revisionId}/move`
- Admin metadata changes: `PATCH /api/admin/chess-models/{modelId}`
- Admin review: `POST /api/admin/chess-models/{modelId}/revisions/{revisionId}/decision`
- Package schema: `/schemas/chess-model-v1.json`
- KServe runtime/security definitions: `deploy/kserve/`
- Immutable public Hugging Face import with executable/remote-code rejection
- Optional checksum-bound S3-compatible quarantine upload

Stockfish 18 remains the only executable opponent until a revision completes scanning, admin approval, KServe deployment, and contract canary verification. Pending or approved-but-not-ready revisions are never listed as playable. Ready custom revisions automatically appear in the opponent selector; the server re-derives legal moves from FEN and rejects malformed, stale, or illegal runtime output.

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

Approval is accepted only from `pending_review`; it does not make a model playable. A deployment controller must create the `InferenceService`, run the `chess-move-v1` canary, and atomically mark the deployment/revision ready.

## Apply runtime policy

These manifests define the hostable stacks but do not deploy unreviewed models:

```bash
kubectl apply -f deploy/kserve/chess-model-security.yaml
kubectl apply -f deploy/kserve/chess-serving-runtimes.yaml
```

Before applying, mirror and digest-pin runtime images in the trusted registry, then replace image tags. The manifests intentionally disable Hugging Face network downloads; approved artifacts must be copied to immutable internal object storage first.
