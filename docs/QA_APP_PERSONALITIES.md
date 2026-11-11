# Prism app personalities: release verification

11 November 2026. [App inventory and research dossiers](app-personalities/README.md).

## Scope

Sixteen separate GPT-6.1 Sol app passes researched direct references, considered
three directions and implemented scoped designs. Shared review then verified the
XP boundary, common interaction/accessibility contracts and cross-app behavior.
The policy is at most two decorative chromatic families per app plus its neutral
ramp; semantic game/feedback colors keep their actual meanings.

The resulting interfaces were reviewed at 1280px and 390/320px. Individual
dossiers contain exact inspected references, actual interactions and limitations.
This is visual/interaction QA, not a measured user study or accessibility
certification. Screenshots and scripts used during review are temporary evidence,
not runtime dependencies.

## Integrated corrections

- Rebound compatibility tokens at each app root so local palettes reach existing
  controls, and made solid/high-contrast material preferences override app tokens.
- Kept Chess sound and new-game controls available inside the XP desktop window.
- Delayed iframe navigation until the host installs its readiness listener. This
  prevents cached children from finishing before parent hydration and leaving an
  already-ready app behind a loading panel.
- Fixed the ordering of focus and native key dispatch for a previously focused
  Pinball control, preventing a pointer hold from losing its release.
- Contained long Start-menu descriptions and scrolling taskbar windows on narrow
  screens; retained the XP visuals and controls.
- Collapsed idle Pip to a compact explicit launcher on phones so tips no longer
  obscure app content; kept full conversation available on demand.

## Validation

- `npm run check`: lint, 172 unit tests, TypeScript, all workspace checks and
  production build passed. Final contrast, grid-sizing and embedded-header corrections were rebuilt.
- `node scripts/vendor-space-cadet.mjs --verify`: engine and CC0 data hashes match.
- Production-build Playwright: all 56 distinct scenarios passed across the main
  run and the targeted correction run. The main run passed 51; the six-scenario
  follow-up passed all five corrected scenarios plus the strengthened embedded
  chrome check. CI repeats the complete suite on the final commit.
- Production deployment smoke checks: recorded after deployment in the PR.

The browser suite covers real chess engines, human moves, arena pause/resume,
private rooms, fixed move-quality colors, no-guess expert Minefield, canvas
export/history, Space Cadet native controls/import/audio/recovery, Mafia's
planning-only paths, consent-gated events, scoped loading/cancellation, solid
materials across frames, forced colors, reduced motion, focus and narrow layouts.
Six added regressions check actual pixel history, retained note draft after storage
failure, embedded Chess actions, native key release, pre-hydration startup ordering
and long Start-menu content containment.

Early development-server runs encountered HMR reloads during simultaneous edits
and its overlay intercepting clicks. Final release evidence uses the optimized
production build after all agent edits stopped; development failures are not
reported as passing release checks.

## Workbench limit

Cosmic Forge remains an unlisted development workbench. Its runtime source and
assembled UI were checked at three widths, with real missing-engine/error/retry
states and a mocked readiness callback. The native Powder Toy WASM build was not
present in this environment, so full simulation playback is not claimed for this
pass. No experimental game was added to the production catalog. Mafia remains a
manifest and Coming soon preview; no room, media capture or gameplay was added.
