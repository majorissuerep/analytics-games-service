PR #77 production acceptance evidence

Live site: https://analytics-games-service.vercel.app
Merged commit: b63e82a0af6d5648f85c431b178914e90163dbdc
Approved source tree: 5ce1fa38c0a107c0b5173f436d5cfebac7abfafb
Candidate evidence tag: qa-pr77-candidate-20261112
Post-merge CI: https://github.com/majorissuerep/analytics-games-service/actions/runs/43125802143

The completed production browser run passed all81 applicable cases without retry.
Production analytics is disabled; its four enabled-state cases passed in the85-case
candidate suite and both85-case CI runs. The live report records this distinction.
Actual downloaded native JS/WASM/data bytes match the approved source hashes.

Read deployed.json, deployed-review.json and deployed-decision.json together with
promotion.json and its candidate/request inputs. Capture sidecars contain actual
build identity, viewport, time, state and SHA256. Manual response fixtures for long
archive and failure/recovery are explicitly labelled. The initial manual touch
script attempted a select before readiness; retained diagnostics demonstrate that
the real loading overlay blocked pointer input and actual selection worked after
readiness. No induced network delay is claimed by that diagnostic probe.

The deployment Playwright config only adds the execution environment's inherited
HTTPS proxy for API requests. Node24 fetch commands use --use-env-proxy. No TLS
verification was disabled. The application source is the approved merged tree.

Restore this evidence over a checkout of the approved source to reproduce the
file checks. Workflow and command details are in scripts/experience/README.md.
A future changed deployment identity correctly rejects replay of this historical
live gate against the newer deployment; retained checksums certify the files that
were reviewed for this release.

Disposition: ACCEPTED by the deployed gate on 2026-11-12.
Read experience-evidence/deployed-decision.json for the exact receipt.
Minor findings are retained in deployed-review.json: native raster polish and an
unresolved original report-writer attribution. The coordinator's independent
revalidation and explicit adoption are documented in deployed/audit-root/README.txt.
The frozen report was preserved; all acceptance facts were independently checked.

Authoritative final evidence tag: qa-pr77-accepted-20261112.
This supersedes the earlier qa-pr77-deployed-20261112 snapshot. The final review
SHA256 is5adaea08fad32ab1ebcaefc0e237649028ee8b28bb4271fa61be2618d582616f;
it includes the coordinator audit and remaining minor attribution finding.
