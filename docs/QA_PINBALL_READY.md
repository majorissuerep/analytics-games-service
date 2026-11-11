# Ready-to-play Pinball release verification

11 November 2026. This revision supersedes the earlier optional-original-files
cabinet. The game now ships a complete original Aster table and synthesized sounds.

Python regenerates 318 bitmap records: ivory enamel floor, rose flight markings,
original spacecraft seal, machined fixtures, rose flippers with chrome rims and
chrome balls. The generator checks exact bitmap masks, bounds and all non-art
records against the pinned CC0 source. Native source, source patch, generator,
CC0 source/output DAT, previews, compiler version and artifact hashes are recorded
in `public/vendor/space-cadet/UPSTREAM.md` and `provenance.json`.

The patched native engine draws only the full-height physical table. It supplies
actual score, ball, pause and mission values to a persistent cabinet HUD, uses
horizontal arrows/Space, and provides a native input bridge for HTML controls.
Browser visibility governs native updates; readiness waits for the actual first
ball. Native menus, setup shortcuts, file imports and the old score surround are
absent from the delivered workflow. The platform's XP window supplies Close.

Validation:

- `npm run check`: 172 unit tests, lint, TypeScript, workspace checks and build passed.
- Final shell positioning correction: production build passed.
- Art regeneration `--check`, shipped artifact hash verification, JavaScript syntax
  checks and `git diff --check` passed.
- Integrated browser run: 21 of 22 passed, including every Pinball and shared design
  check. An unrelated Paintbox test hit duplicate hidden/visible hydration canvases;
  its locator now scopes the visible canvas, and the targeted verification passed. All 22 distinct scenarios passed.
- Pinball checks use actual keyboard and touch launches and require the native
  score to increase; they also cover restart, pause/resume, sound persistence,
  pointer and keyboard key release, slow/failing downloads and retry, delayed host
  startup, vertical-arrow no-scroll, absence of file setup, and phone Privacy
  launcher containment outside the right flipper button.
- Rendered desktop and 390/320 layouts were inspected. No claim of a usability
  study or native historical Microsoft artwork is made.

Production verification is recorded in the release PR after deployment.
