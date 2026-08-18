# Goal: Fully Self-Hosted Event Tracking

## Status

**Next primary target. Planning only — no implementation is authorized by this document.**

The current Mixpanel integration remains the production analytics path until the self-hosted system reaches verified functional, privacy, reliability, and operational parity.

## Goal

Build and operate a fully end-to-end, self-hosted event-tracking data plane for Analytics Games. The platform must own event ingestion, durable queuing, asynchronous processing, storage, replay, querying, and operational monitoring rather than depending on a third-party analytics event pipeline.

The completed system must preserve the current consent-first behavior: no analytics event or analytics-specific network request may leave the browser before explicit consent.

## Target outcome

A browser event can travel through the complete owned pipeline:

```text
Browser analytics client
  -> authenticated/versioned ingestion API
  -> durable event queue
  -> idempotent worker pool
  -> canonical event store
  -> aggregate/query layer
  -> internal reports and operational dashboards
```

Each accepted event must be traceable across this path without exposing secrets, room codes, player names, prompts, messages, passwords, IP addresses, or other free-form user content.

## Required capabilities

### 1. Consent-first browser collection

- Retain explicit opt-in consent as a hard gate.
- Emit no analytics request before consent is granted.
- Use a versioned, allowlisted event schema; dynamic event names and arbitrary properties are forbidden.
- Generate a stable event ID for idempotency and a session ID for bounded journey analysis.
- Support consent revocation without leaving an active browser-side queue that later flushes denied events.
- Keep anonymous analytics identity separate from room/player identity.

### 2. Ingestion boundary

- Expose one versioned ingestion contract with strict schema and payload-size validation.
- Accept only known event names and per-event property schemas.
- Stamp server receipt time and transport metadata; do not trust browser timestamps as canonical.
- Return success only after the event is durably accepted by the queue.
- Enforce request limits, abuse controls, origin policy, and bounded batch sizes.
- Avoid storing raw IP addresses or request headers as analytics dimensions.

### 3. Durable in-house queue

- Decouple request latency from event processing.
- Preserve accepted events across worker restarts and temporary downstream outages.
- Define explicit retry, visibility/lease, backoff, retention, and dead-letter behavior.
- Provide measurable queue depth, event age, retry count, and dead-letter volume.
- Use at-least-once delivery with idempotent consumers; do not claim impossible end-to-end exactly-once delivery.
- Support controlled replay without creating duplicate canonical events.

### 4. Worker pipeline

- Validate the schema again at the consumer boundary.
- Deduplicate by immutable event ID.
- Apply only deterministic, privacy-safe enrichment.
- Persist raw canonical events before deriving aggregates.
- Quarantine poison events after bounded retries.
- Record processing outcomes without logging complete event payloads.
- Scale workers independently from web ingestion.

### 5. Event storage and querying

- Maintain an append-only canonical event record with schema version, event ID, server receipt time, anonymous identity, session ID, and allowlisted properties.
- Partition and retain data according to an explicit retention policy.
- Separate canonical events from rebuildable aggregates and materialized views.
- Support the core product journeys already tracked: platform view, game launch, completion, exit, multiplayer room lifecycle, and returning-player launch.
- Provide documented internal query contracts for funnels, completion rates, retention, and operational reconciliation.
- Make deletion and retention operations auditable.

### 6. Operations and governance

- Publish service-level objectives for ingestion availability, accepted-event durability, processing latency, and query freshness before implementation begins.
- Monitor ingestion failures, queue lag, worker failures, dead letters, storage growth, and schema rejection rates.
- Provide runbooks for worker outage, queue saturation, poison events, replay, backup, restore, and schema rollback.
- Bind every deployed component to pinned artifacts and reproducible migrations.
- Keep credentials server-side and use least-privilege service identities.
- Define ownership for schema review, incident response, data retention, and access approval.

## End-to-end acceptance criteria

The target is complete only when automated tests and operational evidence prove all of the following:

1. **Pre-consent silence:** a fresh browser produces zero analytics requests and zero queued events before opt-in.
2. **Full journey:** after consent, a Playwright game journey produces an event that is durably accepted, processed by a worker, stored once, and returned by the internal query surface.
3. **Schema enforcement:** unknown events, extra properties, free-form content, malformed values, and oversized batches fail closed.
4. **Idempotency:** repeated delivery of one event ID results in one canonical event and one aggregate contribution.
5. **Worker recovery:** accepted events survive worker termination and are processed after restart.
6. **Downstream outage tolerance:** ingestion remains bounded and explicit under storage failure; queued events are retained or requests fail without false success.
7. **Poison handling:** permanently invalid events reach a dead-letter state after bounded retries and do not block healthy events.
8. **Replay safety:** replaying a queue range or canonical time window does not duplicate canonical records or aggregates.
9. **Backpressure:** overload behavior is measured, rate-limited, and fails predictably without unbounded memory or connection growth.
10. **Privacy:** tests prove that forbidden identifiers and free-form fields cannot cross the browser, ingestion, queue, logs, or storage boundaries.
11. **Observability:** one event ID can be traced through redacted operational metadata from ingestion to canonical storage.
12. **Disaster recovery:** backup and restore exercises recover the event store and queue state within declared objectives.
13. **Deployment parity:** the same containerized topology and migrations run in CI integration tests and the self-hosted production environment.
14. **Count reconciliation:** during migration, self-hosted counts reconcile against Mixpanel by event, day, and anonymous session within a predeclared tolerance, with every discrepancy classified.

## Architecture decisions required before implementation

The design phase must produce explicit decisions for:

- **Queue:** PostgreSQL-backed queue, Redis Streams, NATS JetStream, Kafka-compatible log, or another self-hosted durable system.
- **Event store:** partitioned PostgreSQL, ClickHouse, or another owned analytical store.
- **Worker runtime:** process model, scaling policy, lease semantics, and deployment platform.
- **Query layer:** SQL access, internal API, dashboard tooling, and authorization boundary.
- **Topology:** single-node starter topology versus multi-node durability target.
- **Data contract:** event envelope, schema registry/versioning, compatibility rules, and migration policy.
- **Identity:** anonymous-device and session lifecycle, rotation, deletion, and cross-device non-goals.
- **Capacity:** expected and peak events per second, batch size, retention volume, query concurrency, and cost ceiling.
- **Reliability:** SLOs, recovery point objective, recovery time objective, and acceptable event freshness.
- **Security:** authentication between services, network boundaries, encryption, audit logs, and operator access.

These choices must be justified with failure-mode tests and operational cost, not feature checklists alone.

## Deployment boundary

The current application is deployed on Vercel. A durable queue and continuously running worker pool cannot be treated as ordinary Vercel request handlers. The self-hosted target therefore requires a separately operated data plane with persistent storage and worker compute, while Vercel may continue to host the web application and ingestion proxy if the final architecture preserves durability and trust boundaries.

No implementation should begin until the deployment topology, ownership, backup strategy, and on-call expectations are accepted.

## Migration direction

1. Keep Mixpanel as the production baseline.
2. Introduce the self-hosted pipeline behind an explicit configuration gate.
3. Run consent-respecting dual delivery only after privacy and durability gates pass.
4. Reconcile event cardinality, lateness, duplicates, funnels, and retention cohorts.
5. Move internal reporting to the owned query layer only after sustained parity.
6. Disable Mixpanel delivery only through a separate reviewed decision with rollback criteria.

This sequence is directional, not an implementation plan.

## Non-goals

- Implementing any queue, worker, database, API, deployment, or dashboard in this phase.
- Replacing Mixpanel before measured parity and rollback readiness.
- Building a general-purpose customer data platform.
- Capturing session replay, keystrokes, room content, chat content, prompts, player names, or other free-form user data.
- Joining analytics identity to authenticated identity; the platform currently has no authentication system.
- Claiming exactly-once transport or processing without an enforceable idempotency contract.
- Selecting infrastructure solely because it is already available.

## First planning deliverable

Before code is written, produce an evidence-backed architecture decision record comparing at least:

- PostgreSQL queue + PostgreSQL event store,
- durable stream queue + PostgreSQL event store,
- durable stream queue + analytical event store.

The comparison must include data flow, failure modes, delivery semantics, operational burden, recovery, privacy controls, local/CI reproducibility, expected capacity, deployment cost, migration path, and a concrete recommendation.
