# PR78 release evidence

Source: `9f34d6562df541be822638d484fee8d341be6a57`.
Tree: `b18c7c72cd0755243b3dbba76a7a68f295518d51`.
PR: https://github.com/majorissuerep/analytics-games-service/pull/78

`candidate.tar.gz` contains the approved report, independent review, promotion receipt, 66 viewport captures with metadata and sequences, real manual traces, replay scripts, unit/oracle/generation logs and required CI results. Source paths are preserved. Extract into the matching source checkout to inspect with the repository's experience tooling. The CI configuration supplies database and browser setup; no secrets are included.

SHA256: `64a51ec4208e2e3824784cf6fb789d49342739044dd9f8997bfda8041e088791`.

`rejected-candidates.tar.gz` preserves two earlier rejected reports, independent rejection reviews and their actual evidence. A local passing test count did not authorize promotion after touch/font geometry or required CI failed.

SHA256: `a12f6b3bba45985c18e6179a4de3baedadc4e06f9ae876945e5aed7eece285fe`.

The candidate passed 221 unit tests and 90 required CI browser tests without flaky retries. Independent manual review includes real games, reconstructable proofs, touch/font layouts, scoped loading, failed/stale worker recovery and input transitions.


## Deployed acceptance

Production: https://analytics-games-service.vercel.app
Merged commit: `e816ad49f861f23e05e76f4d2d60d758475cc6c7`, with the approved tree above.

`deployed-acceptance.json` records **accept** after fresh production identity verification, eight passing live browser journeys and independent live manual review. Both Classic 99-mine and Extreme Elite games reached real wins using public clues. Layout, touch, proof navigation, flag correction and generator failure/recovery passed. No open major or blocker findings remain.

`deployed.tar.gz` contains the complete promotion-to-deployment receipt chain, 66 fresh live viewport captures and 14 sequences, manual observations and executable replay, source-matched oracle and gate checks, and a fresh 120-board generation sample. Benchmarks describe the local Node QA host, not browser or universal device performance. Analytics is disabled in production; consent-enabled coverage remains in the candidate CI evidence.

Deployed bundle SHA256: `dbcf60d85166f8ac5946582aa80bc16ab03826b58f87bf0071342f57d53476e5`.

Extract at the merged source checkout for checksum and gate validation. The separate candidate and deployed QA tags preserve both stages; these evidence-only commits do not alter the application branch.
