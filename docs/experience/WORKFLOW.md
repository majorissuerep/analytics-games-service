# Request, promotion and deployed acceptance

This is an executable handoff protocol, not a promise that green tests mean good
design. The current request manifest in `experience/requests/` connects user
intent to requirements, scenarios, checks, captures, reviews and rollout decisions.

## 1. Request readiness

Before implementation, record the baseline commit/URL, user-observed failures,
scope/exclusions, reference choices, measurable requirements, realistic scenarios,
risks and rollback target. Every requirement needs both a verification method and
an accountable scenario. Identify initial window geometry, scroll ownership,
required controls and dynamic states in `experience/apps/`.

An independent agent challenges completeness and contradictions. It must identify
what could still pass while looking or behaving badly. Resolve its blocking
findings before implementation. `experience:gate request` validates the manifest
and recorded review. It does not award aesthetic approval.

## 2. Candidate promotion

Use one implementation agent per affected app, bounded file ownership, and one
independent reviewer. Give them the request ID, applicable contract, references,
baseline failures, allowed files and reproduction URL. Do not send the entire
conversation to every agent. Shared behavior is owned once by the coordinator or
shell owner. Reuse a running server; only the coordinator builds or changes ports.

Run cheap contract/unit/geometry checks first. Then run affected task scenarios
on the production build. Capture **viewport** images at the actual requested XP
window, a constrained viewport and maximized state. Full-page images are optional
supplements: they cannot prove controls are visible without scrolling. Capture a
short sequence/video for focus, resize, long content and real gameplay.

Each artifact records the exact candidate tree, scenario, environment, viewport,
window state, action/state and checksum. Review must name the captures actually
opened, the interactions performed, observed outcomes, reference comparison and
any defects. A declaration of blur, file existence, score node, or canvas size is
never sufficient visual evidence. Required actions must pass hit-testing before
auto-scroll; automatic test scrolling cannot rescue a clipped action.

Independent review covers task clarity, geometry/scroll ownership, control reach,
material/color hierarchy, domain readability and dynamic feedback. Severity:

- **Blocker:** an essential task cannot be completed, data is damaged, or a core
  control is unreachable.
- **Major:** reproducible overflow/occlusion, wrong focus, unreadable gameplay,
  incorrect state feedback, or clear contradiction of the requested visual direction.
- **Minor:** local polish that does not violate a hard contract; describe and track it.

Open blocker/major findings fail promotion even when all automated checks pass.
The implementation author cannot be its sole visual approver. Record reviewer
identity, verdict and requirement coverage. Checks/reviews from another tree or
environment cannot approve this candidate. Any scoped exception requires a
specific rationale and user authorization; do not create an empty waiver.

Attach the candidate report and evidence index to the PR, run required CI, then
`experience:gate promotion`. Merge only a reviewed, green candidate. The retained
bundle must be downloadable from CI/PR artifacts; `/tmp` screenshots alone are
not a durable handoff.

## 3. Deployed acceptance

Verify the deployed commit/build identity before exercising the live URL. Repeat
the critical changed journeys and visually inspect the deployed viewport/sequence
captures. Record the environment configuration: e.g. analytics disabled means its
consent UI is not applicable there, not that a missing control passed its test.
Keep the enabled-state CI evidence separately; do not silently skip requirements.

Run `experience:gate deployed` with linked promotion and deployment reports. The
decision is **accept**, **hotfix**, or **rollback**, with evidence and ownership:

- Accept only when all critical changed requirements pass on the actual deployed
  build and the independent visual reviewer has no blocker/major finding.
- Hotfix an isolated, recoverable defect when the main task remains usable; create
  a linked request and repeat the affected gate. Do not call the release accepted.
- Roll back to the recorded known-good release for broken primary interaction,
  widespread missing controls, data risk, or failed recovery. Verify the rollback
  through the same live smoke checks. Escalate only concrete unresolved decisions.

## Keep iteration cheap and the checks honest

One small current-context file links active request, contract, branch, owners,
commands, baseline and unresolved findings. Do not duplicate policy in app notes.
Run the impacted scenario delta locally, shared shell smoke once, and the complete
required suite once on a frozen candidate. Rerun only failures or affected checks
after changes. Pin an artifact set to a tree before review; no build during dev/QA.

Prove enforcement with negative fixtures: incomplete requests, missing requirement
coverage, stale/wrong-build captures, missing dynamic evidence, self-only review,
and open major findings must fail. Browser guard checks must also reject a known
2px overflow, a clipped primary action and a failed body-focus interaction. Keep
those proofs in the automated suite so the gate cannot gradually become paperwork.

Independent visual review remains an accountable human/agent observation, not a
cryptographic guarantee or a numerical beauty score. Record uncertainty honestly.
