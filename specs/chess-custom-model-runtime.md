# SPEC: Safe custom Chess model registry and runtime

## Status: Implemented and locally validated
## Date: 2026-07-25

## Summary

Add a safe, revisioned registry for community Chess models while preserving Stockfish 18, local play, and online rooms. Public users may submit either a quarantined model package or an immutable Hugging Face model revision. Only an administrator may approve a revision; only approved revisions may be selected for play or deployed to KServe.

## Scope

### In scope

- Public model submission without an account, with submitter contact optional and never displayed.
- Model name, description, runtime type, source, license, visibility, and immutable revisions.
- Direct upload through presigned object-storage URLs; application servers never proxy model binaries.
- Hugging Face import using `repo_id` plus mandatory immutable 40-character commit SHA.
- Admin review, approve, reject, archive, rename, and metadata modification.
- Modification of model artifacts or runtime settings creates a new pending revision; approved revisions remain immutable and playable.
- KServe deployment contract, runtime allowlist, resource ceilings, health state, and inference contract.
- Chess setup UI lists Stockfish plus healthy approved custom models.
- Model failures/timeouts fail closed and leave the current game recoverable; Stockfish remains available.
- Audit records for submissions, revisions, moderation, deployment, and runtime status changes.

### Out of scope

- Arbitrary Python, pickle/joblib, custom containers, custom CUDA extensions, shell hooks, or Hugging Face `trust_remote_code`.
- Training, fine-tuning, model conversion, billing, public comments, ratings, tournaments, or model authorship verification.
- Automatic approval or deployment based only on uploader-provided metadata.
- Anonymous mutation after submission. Public submitters receive a one-time receipt ID for status lookup only; administrators own moderation and changes.
- Multi-node GPU serving in the initial release.

## Safety and trust boundaries

1. New artifacts enter a quarantine bucket/prefix and cannot be served by KServe.
2. Submission endpoints enforce rate limits, CAPTCHA/abuse controls, declared and observed byte limits, file-count limits, extension allowlists, and checksums.
3. A scanner verifies archive paths, MIME/signatures, SHA-256, model format, tensor metadata, parameter count, license declaration, and absence of executable formats.
4. Hugging Face imports resolve an immutable commit SHA, enumerate files through the Hub API, reject LFS pointers outside limits, and download only allowlisted files. Tokens remain server-side and are never accepted from submitters.
5. Approval copies verified artifacts to a versioned immutable approved prefix. Approval never mutates an existing approved revision.
6. KServe pods use dedicated service accounts, read-only root filesystems, non-root users, dropped Linux capabilities, seccomp `RuntimeDefault`, no service-account token, deny-by-default network policy, bounded ephemeral storage, CPU/memory/GPU limits, request timeout, concurrency cap, and scale-to-zero.
7. Runtime responses are checked against `legal_moves`. Illegal, malformed, late, or unavailable responses are rejected and never applied to a game.
8. Model artifacts are data only. No runtime downloads dependencies or executes repository code.

## Supported package format: `chess-model/v1`

Every direct upload is a `.tar.zst` or `.zip` containing files at the archive root. No symlinks, hard links, absolute paths, parent traversal, nested archives, or encrypted entries.

```yaml
apiVersion: chess.analytics-games/v1
kind: ChessModel
metadata:
  name: tactical-otter
  displayName: Tactical Otter
  version: 1.2.0
spec:
  runtime: onnx-policy-v1
  format: onnx
  artifact: model.onnx
  sha256: "<64 lowercase hex characters>"
  license: apache-2.0
  inputContract: chess-move-v1
  outputContract: chess-move-v1
  resources:
    accelerator: cpu
```

Allowed package files:

- `chess-model.yaml` — required, UTF-8, maximum 32 KiB.
- `model.onnx` — required for `onnx-policy-v1`.
- `model.safetensors` plus allowlisted JSON tokenizer/config files — required for `hf-transformers-chess-v1`.
- `README.md` and `LICENSE` — optional text files.

Initial limits: 1 GiB compressed, 2 GiB expanded, 32 files, 500 million parameters, 30-second scan timeout per structural stage. Limits are server-owned policy and may only be reduced by a submission.

## Runtime allowlist

| Runtime ID | KServe stack | Accepted data | Initial accelerator | Notes |
|---|---|---|---|---|
| `builtin-stockfish-18` | Existing browser Web Worker/WASM | Vendored Stockfish build | Client CPU | Always available; not uploaded or modified through registry. |
| `onnx-policy-v1` | KServe `ServingRuntime` backed by NVIDIA Triton ONNX backend | One validated `.onnx` graph, static allowlisted operators | Server CPU; optional reviewed GPU profile | Preferred custom-model format; no Python deserialization. |
| `hf-transformers-chess-v1` | KServe Hugging Face `ServingRuntime` with `safetensors` | Immutable Hub revision or package; allowlisted architecture/config/tokenizer files | Server CPU/GPU by admin profile | `trust_remote_code=false`; no `.bin`, `.pt`, `.pth`, `.pkl`, Python, or shell files. |

A runtime ID is versioned. Contract or security-policy changes require a new runtime ID rather than silently changing accepted artifacts.

## Inference contract: `chess-move-v1`

KServe V2 protocol endpoint:

`POST /v2/models/{model}/versions/{revision}/infer`

Request tensors:

```json
{
  "id": "01J...",
  "inputs": [
    {"name":"fen","shape":[1],"datatype":"BYTES","data":["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"]},
    {"name":"legal_moves","shape":[20],"datatype":"BYTES","data":["a2a3","a2a4","b2b3"]},
    {"name":"move_time_ms","shape":[1],"datatype":"INT64","data":[500]}
  ]
}
```

Successful response:

```json
{
  "model_name": "tactical-otter",
  "model_version": "rev_01J...",
  "outputs": [
    {"name":"move","shape":[1],"datatype":"BYTES","data":["e2e4"]},
    {"name":"scores","shape":[20],"datatype":"FP32","data":[0.1,0.2]}
  ]
}
```

Contract rules:

- `fen` is a valid standard Chess FEN and is the authoritative position.
- `legal_moves` contains every legal move exactly once in UCI notation; promotion suffix is mandatory (`e7e8q`). Maximum 256 entries.
- `move_time_ms` is advisory and clamped by the gateway to 50–5000 ms.
- `move` is required and must exactly equal one request `legal_moves` entry.
- `scores` is optional; when present its length equals `legal_moves`, all values are finite, and larger is preferred.
- Unknown tensors, batch size other than one, oversized payloads, NaN/Infinity, or additional output types are rejected.
- Gateway hard timeout: requested move time plus 750 ms, maximum 5750 ms. One retry is allowed only for transport failure before any response bytes.

## Lifecycle and state model

Model states: `draft -> pending_scan -> pending_review -> approved -> deploying -> ready`.

Terminal/side states: `scan_failed`, `rejected`, `deployment_failed`, `disabled`, `archived`.

- Public submission creates a model and revision in `pending_scan` and returns a random receipt ID.
- Successful scanning advances to `pending_review`; it never auto-approves.
- Admin approval records reviewer, policy version, scan report hash, and timestamp.
- Deployment creates a KServe `InferenceService` for the approved immutable revision.
- Readiness probes plus a contract canary move it to `ready`.
- Editing display metadata is audit-logged and does not create an artifact revision.
- Changing artifact, source SHA, runtime, resource profile, or contract creates a new pending revision.
- Disabling/archiving stops new games from selecting the revision; existing games retain model identity and may fall back safely if unavailable.

## REST API (OpenAPI 3.1 fragment)

```yaml
openapi: 3.1.0
paths:
  /api/chess-models:
    get:
      summary: List ready public Chess models, including built-in Stockfish
      responses:
        '200': {description: Model summaries}
    post:
      summary: Create a quarantined public submission
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/DirectSubmission'
                - $ref: '#/components/schemas/HuggingFaceSubmission'
      responses:
        '202': {description: Submission accepted; returns receipt and upload instructions if direct}
        '400': {description: Invalid manifest or source}
        '413': {description: Declared artifact exceeds policy}
        '429': {description: Submission rate limited}
  /api/chess-models/submissions/{receiptId}:
    get:
      summary: Read redacted submission status using the unguessable receipt
      responses:
        '200': {description: State and safe rejection reason}
        '404': {description: Unknown receipt}
  /api/admin/chess-models/{modelId}:
    patch:
      security: [{adminSession: []}]
      summary: Rename or modify model metadata
      responses:
        '200': {description: Updated model}
        '401': {description: Admin authentication required}
  /api/admin/chess-models/{modelId}/revisions:
    post:
      security: [{adminSession: []}]
      summary: Create a replacement revision
      responses:
        '202': {description: Pending revision created}
  /api/admin/chess-models/{modelId}/revisions/{revisionId}/decision:
    post:
      security: [{adminSession: []}]
      summary: Approve or reject a scanned revision
      responses:
        '200': {description: Decision recorded}
        '409': {description: Revision is not reviewable or scan policy is stale}
  /api/admin/chess-models/{modelId}/revisions/{revisionId}/deploy:
    post:
      security: [{adminSession: []}]
      summary: Deploy an approved revision to KServe
      responses:
        '202': {description: Deployment requested}
        '409': {description: Revision is not approved}
components:
  securitySchemes:
    adminSession: {type: apiKey, in: cookie, name: admin_session}
  schemas:
    DirectSubmission:
      type: object
      required: [source, name, runtime, sizeBytes, sha256, license]
      properties:
        source: {const: direct}
        name: {type: string, pattern: '^[a-z][a-z0-9-]{2,39}$'}
        runtime: {enum: [onnx-policy-v1, hf-transformers-chess-v1]}
        sizeBytes: {type: integer, minimum: 1, maximum: 1073741824}
        sha256: {type: string, pattern: '^[a-f0-9]{64}$'}
        license: {type: string}
    HuggingFaceSubmission:
      type: object
      required: [source, name, runtime, repoId, revision, license]
      properties:
        source: {const: huggingface}
        name: {type: string, pattern: '^[a-z][a-z0-9-]{2,39}$'}
        runtime: {enum: [onnx-policy-v1, hf-transformers-chess-v1]}
        repoId: {type: string, pattern: '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'}
        revision: {type: string, pattern: '^[a-f0-9]{40}$'}
        license: {type: string}
```

Binary upload is a two-step protocol: `POST /api/chess-models` returns a short-lived, content-length/checksum-bound presigned PUT URL for quarantine storage; upload completion enqueues scanning. No binary body is accepted by Next.js/Vercel routes.

## Hugging Face integration

- Submission uses public `repo_id` and immutable commit SHA, never a branch/tag.
- Server-side Hub integration reads repository metadata and allowlisted files. Private repositories are unsupported initially; no user token collection.
- Optional publishing of an approved direct-upload revision to the platform's Hugging Face organization is an admin-only action using scoped `HF_TOKEN` and `hf upload-large-folder`/Hub API.
- Published model cards include the `chess-model/v1` manifest, runtime/contract IDs, checksums, license, scan-policy version, and source revision.
- Hub webhook events may mark upstream status as changed but never mutate an approved immutable revision or trigger automatic redeployment.

## Data model

- `chess_models`: stable identity, slug, display metadata, visibility, lifecycle flags, current ready revision.
- `chess_model_revisions`: immutable artifact/source identity, runtime/contract, checksums, sizes, state, resource profile, scan report hash, approval data.
- `chess_model_submissions`: hashed receipt token, abuse metadata with retention, source, redacted status.
- `chess_model_deployments`: KServe name/namespace, revision, observed generation, endpoint identity, health, timestamps.
- `chess_model_audit`: append-only actor/action/target metadata; no secrets or raw tokens.

Receipt and admin tokens are stored only as keyed hashes. Object keys are random IDs, never user filenames. Database rows store object identity and checksum, not binary data.

## Behavioral scenarios (Gherkin)

```gherkin
Feature: Safe community Chess models

  Scenario: Existing play remains available
    Given no custom model is ready
    When a player opens Chess
    Then Stockfish 18, local play, and online rooms work unchanged

  Scenario: Public direct upload is quarantined
    Given a valid onnx-policy-v1 manifest within limits
    When a visitor creates a direct submission
    Then the API returns 202 with an unguessable receipt and checksum-bound quarantine upload URL
    And the model is not selectable for play

  Scenario: Public Hugging Face submission is immutable
    Given a public repository and a 40-character commit SHA
    When a visitor submits it
    Then scanning uses only that commit and allowlisted files
    And branch names, tags, user tokens, executable files, and remote code are rejected

  Scenario: Approval is mandatory
    Given a revision passed scanning
    When no administrator has approved it
    Then deployment is rejected with 409
    And it is absent from the public playable model list

  Scenario: Modification preserves approved revisions
    Given revision A is ready
    When an administrator changes its artifact or runtime
    Then pending revision B is created
    And revision A remains immutable and playable until explicitly disabled

  Scenario: Illegal model output fails closed
    Given a ready custom model
    When it returns a move not present in legal_moves
    Then the gateway rejects the response
    And no move is applied to the game
    And the UI offers retry, model change, or Stockfish fallback

  Scenario: Model runtime is isolated
    Given a malicious artifact containing Python, pickle, traversal, or symlinks
    When it is scanned
    Then the revision enters scan_failed
    And no KServe resource is created

  Scenario: Approved custom model can play
    Given an approved ready revision with a passing canary
    When a player selects it and starts a game
    Then each model turn is requested with chess-move-v1
    And only a validated legal UCI move is applied
```

## Verification criteria

- [ ] Current unit, browser, Stockfish, local, and online-room suites pass unchanged.
- [ ] OpenAPI request/response schemas validate in CI.
- [ ] Archive-bomb, traversal, symlink, wrong-MIME, checksum, executable-file, pickle, oversized tensor, unsupported operator, and Hugging Face remote-code fixtures are rejected.
- [ ] Public submissions cannot deploy, approve, overwrite names, mutate revisions, or access admin APIs.
- [ ] Approved revisions are content-addressed and byte-identical after approval.
- [ ] KServe manifests pass policy checks for non-root, read-only filesystem, dropped capabilities, seccomp, no token mount, deny-by-default egress, quotas, and timeouts.
- [ ] Contract canary tests reject malformed/illegal outputs and accept legal promotion, castling, and en-passant moves.
- [ ] Runtime outage/timeout never corrupts Chess state; Stockfish/local/online remain usable.
- [ ] Hugging Face integration accepts immutable public revisions and never executes repository code.
- [ ] Audit entries exist for every moderation, revision, deployment, disable, and archive action.

## Delivery slices

1. Registry foundation: schema, contracts, public submissions, admin moderation, immutable revisions, audit, UI management, mocked scanner queue.
2. Storage and scanning: S3-compatible quarantine/approved buckets, presigned upload, format-specific scanners, Hugging Face immutable import.
3. KServe serving: GitOps runtime manifests, inference gateway, deployment controller, canaries, observability, resource/network policies.
4. Gameplay integration: custom-model selection and legal-move gateway with safe failure/fallback; preserve all existing modes.
5. Hugging Face publishing: admin-only export to the platform organization with model card/provenance.
