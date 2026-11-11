# Experience gates

The current request and app contracts define coverage. These small Node tools
check that the evidence and independent review belong to the actual candidate.
They cannot judge beauty, prove reviewer honesty, or turn CSS declarations into
visual approval. The reviewer must actually open the cited images/sequences and
exercise or observe the interactions. Definitions live in
[`docs/experience/WORKFLOW.md`](../../docs/experience/WORKFLOW.md).

Each report has one writer. Run mutation commands serially, including `run`; do not
start a second recorder or collector while a command is still recording.

No server or build is started by a gate. The coordinator owns the running server.
Evidence lives in ignored `experience-evidence/`; keep the bundle downloadable in
CI/PR artifacts. CI always retains `test-results/`, `playwright-report/` and this
directory for 30 days, on success and failure. Put the independent review and
report checksums, artifact download URL, candidate tree and gate receipt in the
PR description. An unretained local path is not a durable handoff. CI validates
the real contracts/request review and generated negative fixtures, not a pretend
automatically approved visual report.

## 1. Request readiness

```sh
npm run experience:contracts
npm run experience:evidence -- context --request experience/requests/desktop-refinement.json
npm run experience:gate -- request --request experience/requests/desktop-refinement.json --review experience/reviews/desktop-refinement.request.json
npm run experience:test
```

`context` prints SHA256 of the raw request and a combined checksum of VISION,
WORKFLOW and scoped app contracts. The request reviewer records:

```json
{
  "schemaVersion": 1,
  "requestId": "desktop-refinement",
  "requestSha256": "<context hash>",
  "contractsSha256": "<context hash>",
  "reviewer": "experience_gate_review",
  "authors": ["root"],
  "reviewedAt": "2026-11-11T12:00:00.000Z",
  "verdict": "approve",
  "challenges": ["Concrete completeness/contradiction challenge and disposition"],
  "observations": [{"requirementId": "REF-01", "note": "Specific contract assessment; repeat for every requirement"}],
  "findings": [{"id": "R1", "severity": "major", "status": "resolved", "description": "Original missing behavior", "resolution": "How the contract now addresses it"}]
}
```

The example is abbreviated: every real requirement needs an observation.
`verdict` is `approve` or `reject`; severity is `minor`, `major` or `blocker`.
Resolved findings need a resolution. Open major/blocker findings reject readiness
and promotion. Reviewer identity must equal the request's accountable reviewer
and differ from all listed authors. Keep this review in source before freezing.

## 2. Freeze, capture, review, promote

Commit the complete candidate and request review, then build it. Promotion
requires a clean source tree. Ignored evidence does not change that tree. Any
source change requires a new candidate run and review. A working-tree snapshot
from `context`/`init` helps iteration, but a dirty tree cannot promote.

```sh
npm run experience:evidence -- init --request experience/requests/desktop-refinement.json --out experience-evidence/candidate.json --environment candidate --url http://localhost:3132 --author root --configuration '{"analytics":"disabled","material":"glass"}'
```

Capture real Playwright **viewport** PNGs after initializing the report. Use
`page.screenshot({ path, fullPage: false })`, not a locator screenshot or a full
page screenshot. Capture times default to file modification times; copying old
images into a new report does not establish new observations. Record actual
viewport size, window state and action/state. For example:

The shared `captureExperience` browser helper writes each PNG beside a JSON
sidecar with scenario, state, window, viewport, time, URL, build/native identity
and image checksum. Import a whole Playwright output directory with:

```sh
npm run experience:evidence -- collect --report experience-evidence/candidate.json --dir experience-evidence/candidate/browser
```

Collection verifies every capture against the initialized report and committed
source/native files, checks actual image bytes/dimensions, and retains checksums
for the original metadata files. It attaches all viewport captures and groups
ordered, distinct frames only within the same scenario, viewport and window state.
Generated sequence notes describe captured state labels; they do not invent input
actions or successful outcomes. The command reports scenarios still missing
dynamic proof. Scenario results and automation remain unchanged: record the real
command result and each observed outcome separately. Repeating collection is
idempotent; rewriting a previously imported capture is rejected. Keep all captures
and sidecars in the retained bundle. `--sequence-dir RELATIVE_PATH` optionally
selects the output directory (default: `sequences/` beside the report).

For individual captures or explicitly recorded actions, use:

```sh
npm run experience:evidence -- add --report experience-evidence/candidate.json --scenario mine-start --kind viewport --path experience-evidence/mine-start.png --width 1280 --height 800 --window requested480x600 --state ready
npm run experience:evidence -- sequence --report experience-evidence/candidate.json --scenario mine-input --frames experience-evidence/mine-before.png,experience-evidence/mine-after.png --states covered,flagged --action 'Hold covered square; release after marking' --observed 'Exactly one flag appears; square stays covered' --width 390 --height 844 --out experience-evidence/mine-input.sequence.json
```

`sequence` hashes at least two distinct, decodable viewport PNGs, retains ordered
capture timestamps and records the action/outcome. A WebM can satisfy a sequence
requirement using `add --kind video`; it must be a real recording and the reviewer
must inspect it. Full-page screenshots may be kept as supplements outside the
required viewport artifacts. A mismatched PNG dimension or altered frame fails.

Run automation through the recorder, or populate equivalent retained command
records from an existing CI run. `run` executes an argument array without a shell,
records exit status and output, and propagates a failed command as a failed CLI:

```sh
npm run experience:evidence -- run --report experience-evidence/candidate.json --id gate-negative --command-json '["npm","run","experience:test"]' --requirements GATE-01 --scenarios gate-negative --log experience-evidence/gate-negative.log
npm run experience:evidence -- result --report experience-evidence/candidate.json --scenario gate-negative --status passed --observed 'Valid fixtures pass; missing proof, stale source, bad artifacts, self-review, major defects and wrong deployment identity reject'
```

Repeat actual affected checks and observed results for every declared scenario.
Every requirement/scenario needs automation coverage and the artifact types in
its contract. An automation log alone does not satisfy viewport/dynamic proof.
`add` associates an artifact with its scenario and linked requirements; `result`
derives requirement statuses from their scenarios. It does not invent results.

```sh
npm run experience:evidence -- finish --report experience-evidence/candidate.json
```

`finish` requires all scenario results and prints the frozen report SHA256. The
report schema is generated by `init`: identity/provenance, environment URL and
configuration, `automation`, `requirements`, `scenarios`, and `artifacts`.
Each artifact has `{id,scenarioId,kind,path,sha256,bytes,capturedAt,tree,environment,
viewport:{width,height},window,state}`. Paths are relative to the repository;
actual bytes and resolved paths are checked, including symlink containment.

The independent candidate reviewer uses the request-review shape above, plus:

```json
{
  "tree": "<exact candidate tree>",
  "environment": "candidate",
  "reportSha256": "<finished report hash>",
  "referenceComparison": "Concrete observed comparison against adopted Zorin/elementary references",
  "observations": [{"requirementId": "REF-01", "note": "What I actually saw and did, including limitations", "artifactIds": ["visual-matrix-viewport-1", "visual-matrix-sequence-2"]}]
}
```

Every requirement needs observations referencing the required evidence kinds for
**each** linked scenario. Describe task clarity, scroll geometry, control reach,
materials/color, domain readability and dynamic feedback. Review must follow the
finished report. These fields record accountable observations; hashes prove
which bytes were reviewed, not whether a reviewer is honest.

```sh
npm run experience:gate -- promotion --request experience/requests/desktop-refinement.json --request-review experience/reviews/desktop-refinement.request.json --report experience-evidence/candidate.json --review experience-evidence/candidate-review.json --out experience-evidence/promotion.json
```

The gate also probes the report URL's `/api/build-identity` (override with
`--identity-url` on that same origin). The running build's commit and tree must
match frozen HEAD. If native asset identity is supplied, all three Pinball
JS/WASM/data SHA256 values must match the committed files. The receipt binds all
input checksums; retain those input files and their artifacts together.

## 3. Verify the deployed build and decide

Fetch the deployed commit into the local Git object database before verification.
The live endpoint must return its build-time `{commit,tree,nativeAssets}` identity;
`tree` can be null when a platform omits Git metadata. The verified commit's Git
tree must equal the promoted tree, allowing squash/release commit metadata to
differ without allowing changed source. Redirected or other-origin identity URLs
are rejected. A failed/missing endpoint blocks acceptance.

```sh
npm run experience:evidence -- init --request experience/requests/desktop-refinement.json --out experience-evidence/deployed.json --environment deployed --url https://analytics-games-service.vercel.app --author root --commit FULL_DEPLOYED_COMMIT --configuration '{"analytics":"disabled","material":"glass"}'
```

This probes live identity before starting the evidence clock. Collect **new**
captures and checks, record scenario results, and finish as above. The independent
review names `environment: "deployed"`, the deployed report hash, observed live
artifacts and any failures. Promotion inputs are fully revalidated during the
deployed gate, including actual retained files. Failed checks may be documented
in a deployed report so that hotfix/rollback decisions remain possible.

Create `experience-evidence/decision.json`:

```json
{
  "decision": "accept",
  "owner": "root",
  "rationale": "Specific live observations supporting this decision",
  "primaryTaskUsable": true,
  "dataRisk": false,
  "widespreadFailure": false,
  "recoveryFailed": false
}
```

```sh
npm run experience:gate -- deployed --request experience/requests/desktop-refinement.json --promotion experience-evidence/promotion.json --report experience-evidence/deployed.json --review experience-evidence/deployed-review.json --decision experience-evidence/decision.json --out experience-evidence/deployed-decision.json
```

`accept` requires all checks passed and independent approval without open
major/blocker findings. `hotfix` requires an isolated failed check/finding while
the primary task remains usable; add `issueRequest` naming an existing JSON file
with `{id,parentRequest,owner,defect,expected,scenarios:["affected-scenario-id"]}`.
Repeat the affected request/candidate/live gates for the correction. A valid
hotfix decision produces `accepted:false`.

`rollback` requires the request's `rollbackCommit` and paths `rollbackReport` and
`rollbackReview`. Perform the rollback externally, then record newly captured
smoke evidence for each affected app. The rollback report is
`{schemaVersion:1,requestId,candidate:{commit,tree},author,startedAt,finishedAt,
identityUrl,environment:{name:"rollback",url},artifacts:[standard artifacts],
checks:[{app,scenarioId,status:"passed",command,observed,artifactIds}]}`. Each
smoke check needs command logs and dynamic primary-task evidence. It exercises
the known-good release's primary tasks, not the new visual design requirements.
The reviewer records `{reviewer,verdict:"approve",reviewedAt,reportSha256,findings,
observations:[{scenarioId,note,artifactIds}]}`. The gate probes the rolled-back
identity and verifies the smoke files and review. A valid rollback decision also
produces `accepted:false`; it does not label the failed candidate accepted.

The tools report policy decisions. They do not merge PRs, deploy, roll back, send
messages, or waive missing evidence.
