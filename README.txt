PR #77 experience acceptance evidence

Repository: https://github.com/majorissuerep/analytics-games-service
Request: experience/requests/desktop-refinement.json
Candidate commit: 145ef28f571da314f9b4f3376b9318611a80eea8
Candidate tree: 5ce1fa38c0a107c0b5173f436d5cfebac7abfafb
CI run: https://github.com/majorissuerep/analytics-games-service/actions/runs/43123170335

Extract this archive into a checkout of the candidate revision. Paths are relative
to the repository. Reports and receipts retain SHA256 hashes for the exact files,
viewport dimensions, capture times, build identity and native asset identity.
Manual scripts and measurement logs are included beside their fresh captures.
The raw browser captures and all sequence frames referenced by the report are
included; Playwright attachment duplicates are omitted.

Read scripts/experience/README.md and docs/experience/WORKFLOW.md for reproduction.
Request readiness is retained in experience/reviews/desktop-refinement.request.json.
Candidate promotion is retained in experience-evidence/promotion.json.
When included, deployed.json, deployed-review.json, decision.json and
deployed-decision.json are the separate post-release acceptance record.

The CI retry-policy fixture deliberately fails its first attempt and passes its
retry. Its probe verifies that CI still exits unsuccessfully; this is expected
negative proof, distinct from the real browser suite, which must pass with no
failed first attempts. Retained evidence is excluded from source lint/type/test
discovery. Run report mutations serially; each report has one writer.

Historical rejected candidates were not promoted. Fresh report identity and the
independent review, rather than old screenshots or an aggregate green CI status,
authorize this revision. A future deployment's changed identity will correctly
reject replay of this historical live gate against that newer deployment.
