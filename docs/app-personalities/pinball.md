# Space Cadet — Aster Flight 01

11 November 2026. Scope: cabinet controls and original CC0 art; native physics,
collision/depth records, sprite masks and geometry remain unchanged.

The previous revision was visibly poor despite passing structural tests: pale
floor and noisy grey fixtures hid the ball, a giant printed seal suggested a
physical obstacle, labels overlapped flippers, narrow layouts hid Ball, and a
Unicode Resume rendered as an orange emoji. Those are visual failures, not
acceptable consequences of faithfully retaining the engine.

Direct references inspected:

- [elementary Button HIG](https://docs.elementary.io/hig/widgets/ui-toolkit-elements/button.md): tool button semantics, actionable tooltips and icon/text hierarchy. Adopt compact recognizable actions with accessible names. Reject adding a menu hierarchy to three game actions.
- [Official Zorin OS](https://zorin.com/os/): inspected the actual OS hero image, including the rounded silver launcher and restrained stable backing. Adopt bounded silver controls and short stationary highlights. Preserve XP outer chrome; do not reproduce another OS shell.
- [Visual Pinball](https://github.com/vpinball/vpinball): read maintained simulator documentation, camera fitting, cabinet display separation and touch support. Adopt uncropped physical table and separate score/control hierarchy. Do not import its infrastructure or proprietary machine art.
- [SpaceCadetPinball](https://github.com/k4zmu2a/SpaceCadetPinball): inspected engine/resource distinction and native controls. Keep native launch, scoring, ball lifecycle, pause and flippers. No Microsoft game resources are shipped.

Three directions considered: a silver flight instrument with navy physical table
(selected); a dark arcade bezel (too much machine-on-machine chrome); and a side
score dashboard (takes table width from a normal 920×740 XP window). The selected
composition gives the actual table the available height, keeps live score/ball
visible, and groups restart/pause/sound as one quiet instrument cluster.

Character: precise, calm physical cabinet. Controls use cool silver neutrals and
pink intent. Navy enamel, cyan native lamp/bumper states and rose flippers are
explicit gameplay material/domain colors. The opaque table is stable; gloss is
bounded to the header/action group and touch apron. White ball and restrained
metal rail highlights distinguish movement from the floor. No decorative seal,
microtype, floating slogans, menus or import setup remain.

The generator now draws original rail paths, raised ramp beds and enamel depth
at 4× before Lanczos resampling to the native 365×470 bitmap. Physical sprite
materials use procedural silhouette bevels and smooth dome shading rather than
inherited texture luminance. Seven bumper backings and target/rollover pedestals use measured native positions;
they are real existing fixtures. Native off inserts are recessed dark and actual
lit states become cyan. Native masks remain exact, so small inherited silhouette
irregularities remain at this resolution. Index zero remains
exactly zero. A separate opaque original backing is composed beneath the native
masked texture; internal cutouts reveal cap material rather than navy holes.
Native depth writes remain unchanged. The complete native
shooter/plunger stays visible; no physics region is cropped to hide whitespace.

Cabinet changes: coherent SVG controls replace emoji; score uses tabular figures;
Ball remains visible at 320/390px; a proper paused veil and Resume action expose
state clearly. Touch inputs have physical grouping, labels and held feedback.
Fixed table aspect ratio is independent of the runtime’s internal canvas resize,
preventing temporary stretching after host resize. Up/down arrows never scroll.
Keyboard Tab focus remains visible; script-driven table focus does not add an
unexplained pink rectangle. Native audio opt-in, startup stages, elapsed time,
error/retry, and the outer listener-before-navigation boot sequence are retained.

Working evidence: `/workspace/scratch/experience-working/pinball/` contains ready,
held plunger, flight sequence, scoring, paused/resumed, natural drain/next ball,
narrow 390/320, actual requested/maximized XP captures, real failed WASM download
and successful Retry recovery, plus full gameplay videos. `dynamic.json` records
natural score and ball state. Pause is verified by identical native canvas PNGs
900ms apart; resume changes the canvas within 450ms. Space launch produced real
score growth; unassisted drain advanced Ball 1/3 to 2/3 and the next fed ball was
launched again. Screenshots are visually inspected; scores/nodes alone are not
visual acceptance. Independent reviewer and coordinator retain final acceptance.

Validation: deterministic generator check (318 bitmap records; exact masks and
all non-art record comparisons); shipped artifact checksum verification; cabinet
JS syntax; actual engine flight/pause/drain/retry interactions. The native renderer was rebuilt to compose the original backing below unchanged
masked art. Zero-color sprite writes retain backing while measured depth writes
remain unchanged; no gameplay code changes. The pinned patch dry-run passed,
and the rebuilt loader/WASM/preload package hashes are recorded. The coordinator
owns integration tests/build/deployment. No Git or server actions were performed.

Final working direction accepted for frozen review after the opaque backing fixed rectangular cap perforations. `tests/e2e/pinball-experience.spec.ts` is the runnable candidate suite using shared capture/hit-test helpers for requested XP geometry, real arrow flippers, Space flight/score, physical pause freeze/resume, natural drain/next flight, narrow held/released controls, resize, no-scroll, and actual WASM failure/Retry recovery. Dev runs were interrupted by shell reloads during concurrent changes; they are not candidate acceptance. Frozen production execution belongs to the coordinator.


The frozen first-launch investigation found a real readiness race: one of three
immediate first holds never charged/launched while the ball was still settling
in the shooter. This was not classified as a saved drain. The native ready signal
now observes an actual unboosted plunger collision, with game mode active, instead
of merely the ball's ActiveFlag. Loading remains “Feeding the first ball” until
that observed contact. Later native feeds show a scoped footer meter/elapsed time
and keep Launch disabled until contact. No arbitrary settle delay or first-score
retry hides readiness. Physical keys use the same direct native input path as
touch and ignore OS repeat; keyup/blur still release inputs. Native Boost is exposed
as read-only cabinet state and the browser launch test asserts actual charging.

The background keyboard investigation preserved actual browser button defaults.
SDL's keypress handler had cancelled Enter, despite correct button focus and
keydown/keyup handling. Ordinary button keys stop at the button; an early
keypress guard prevents SDL cancellation. Enter now emits a real browser click
and native Pause resumes after switching away and refocusing. The exact event
trace and immediate-launch/repeat observations are retained in the working folder.
Only genuinely scored native early-drain saves receive bounded real Space
relaunches in the lifecycle test; first-score assertions have no retry masking.


C2 CI recovery evidence showed a separate test-strength issue: native input was
accepted (Pull > 0), the ball followed the pulled head and made a short upward
hop, then settled back in the shooter without entering the field. A fixed 1.2s
hold is only a partial native charge, especially under a slow simulation. Scoring
launches now release at the observed native maximum Pull=100, bounded to 10s,
while retaining the immediate accepted-keydown assertion. Touch uses the same
observed full-pull condition. There are no first-score retries or physics changes.
Failure recovery replaces stale “Working…” text with “Ready to retry”.
