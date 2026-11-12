# PR78 candidate evidence

Source: `9f34d6562df541be822638d484fee8d341be6a57`.
Tree: `b18c7c72cd0755243b3dbba76a7a68f295518d51`.
PR: https://github.com/majorissuerep/analytics-games-service/pull/78

`candidate.tar.gz` contains the approved report, independent review, promotion receipt, 66 viewport captures with metadata and sequences, real manual traces, replay scripts, unit/oracle/generation logs and required CI results. Source paths are preserved. Extract into the matching source checkout to inspect with the repository's experience tooling. The CI configuration supplies database and browser setup; no secrets are included.

SHA256: `64a51ec4208e2e3824784cf6fb789d49342739044dd9f8997bfda8041e088791`.

`rejected-candidates.tar.gz` preserves two earlier rejected reports, independent rejection reviews and their actual evidence. A local passing test count did not authorize promotion after touch/font geometry or required CI failed.

SHA256: `a12f6b3bba45985c18e6179a4de3baedadc4e06f9ae876945e5aed7eece285fe`.

The final source passed221unit tests and90requiredCIbrowser tests without flaky retries. Independent manual review includes real games, reconstructable proofs, touch/font layouts, scoped loading, failed/stale worker recovery and input transitions. Current candidate approval is distinct from deployed acceptance, which will be added after rollout.
