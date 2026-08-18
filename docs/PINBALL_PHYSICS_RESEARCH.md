# Browser Pinball Physics and Table-Design Research

**Research date:** 2026-08-18  
**Target:** an original TypeScript/React pinball game for a Next.js 16 platform

## Executive recommendation

Use **Planck.js (`planck` 1.5.x) as a headless 2D physics layer**, with original TypeScript game/rules/rendering code around it.

Why:

- A pinball ball is exactly the kind of small, fast body that exposes tunneling. Planck provides swept continuous collision detection (CCD), including a `bullet` mode for dynamic-vs-dynamic collisions, while Matter.js still documents CCD as absent and recommends substeps, thicker colliders, and speed limits as workarounds.
- Planck has the right primitive for a flipper: a revolute joint with angle limits, motor speed, and maximum motor torque.
- Sensors, chain/polygon/circle fixtures, contact events, collision filters, impulses, gates, spinners, and multi-ball are already supported.
- The complete checked-in minified Planck build measured about **297 KB raw / 55 KB gzip**; Matter measured about **83 KB raw / 26 KB gzip**. The roughly 29 KB gzip premium is small compared with the engineering and correctness cost of tunneling workarounds or a custom solver.
- Planck and Matter are MIT-licensed. Using an MIT dependency does not make the game's own table, rules, graphics, audio, or integration derivative of the surveyed games. Keep those original and preserve the dependency's license notice.

Do **not** port or translate Visual Pinball/VPX code. Its physics is sophisticated and instructive at the architectural level, but the relevant implementations are GPL or mixed-license. This report describes behavior and general mechanics only; it reproduces no project code.

A custom engine is viable only if “from scratch” means *no third-party physics dependency*. It can be compact when the world consists only of balls, fixed segments/circles, and kinematically prescribed flippers. It becomes a much larger reliability project once it must support rotating swept collision, simultaneous contacts, ball trapping, gates, spinners, drop targets, and ball-ball CCD. For the requested rich game, Planck is the better risk/quality trade.

---

## 1. Verified project census

The rows below were checked against each repository's README, license file or per-file headers, dependency manifest, and representative physics sources at the listed repository heads. “Approach” is descriptive; it is not permission to reuse implementation.

| Project | License observed | Physics approach and practical lesson |
|---|---|---|
| [vpinball/vpinball](https://github.com/vpinball/vpinball) | **Mixed/transitional**: the license file says most files are now GPLv3+, but unmarked files remain under an older MAME-like noncommercial license; third-party code has its own terms. Do not simplify this to “entire repo GPL.” | Native, purpose-built pinball simulation. It searches for the earliest time of impact inside a step, partitions static/dynamic hit geometry, uses spatial acceleration structures, and models dedicated flipper, bumper, slingshot, plunger, spinner, gate, target, and ramp behavior. It demonstrates that high-end pinball is more than generic rigid-body restitution. [README](https://github.com/vpinball/vpinball#readme), [license](https://github.com/vpinball/vpinball/blob/master/LICENSE) |
| [vpdb/vpx-js](https://github.com/vpdb/vpx-js) | GPL-2.0 (source headers allow GPL-2.0-or-later) | TypeScript/JavaScript port of Visual Pinball's custom collision and rigid-body dynamics, with a Three.js rendering adapter. It includes swept hit times, quadtree/KD broad phase, dedicated movers, and element-specific hit shapes. Valuable as evidence of architecture and complexity, but not a clean-code source for a non-GPL game. Its latest inspected commit was from 2020, so it is also not a current library choice. [README physics section](https://github.com/vpdb/vpx-js#physics), [license](https://github.com/vpdb/vpx-js/blob/master/LICENSE) |
| [freezy/VisualPinball.Engine](https://github.com/freezy/VisualPinball.Engine) | GPL-3.0 at current head; README notes earlier history under GPL-2.0 | Unity/C# toolkit that ports Visual Pinball's physics rather than relying on Unity's general-purpose dynamics for gameplay. It reinforces the value of dedicated pinball element logic layered around collision math, but it is much too heavy and license-incompatible as an implementation base here. [README](https://github.com/freezy/VisualPinball.Engine#readme), [license](https://github.com/freezy/VisualPinball.Engine/blob/master/LICENSE) |
| [h4k1m0u/pinball](https://github.com/h4k1m0u/pinball) | MIT | Browser JavaScript with p5.js and Planck.js. The README explicitly says Planck was chosen over Matter because of ball/flipper tunneling. It uses a bullet ball and motorized, limited revolute joints for flippers—the core pattern recommended here. It is a small demo, not a rich ruleset. [README](https://github.com/h4k1m0u/pinball#readme), [license](https://github.com/h4k1m0u/pinball/blob/master/LICENSE) |
| [gunstein/Pinball2D](https://github.com/gunstein/Pinball2D) | Dual MIT or Apache-2.0 | Rust/Bevy/Rapier 2D, deployable to WebAssembly. The inspected implementation uses kinematic position-based flippers and launcher movement with time-based angle/position clamping. Useful evidence that prescribed kinematic flippers can feel acceptable in a lightweight game, though it is not a TypeScript stack. [README](https://github.com/gunstein/Pinball2D#readme), [license](https://github.com/gunstein/Pinball2D/blob/main/LICENSE) |
| [lluckymou/simple-pinball](https://github.com/lluckymou/simple-pinball) | MIT | Unity 2020.3 physics project with plunger/flippers plus 12 power-ups and achievements. Its lesson is primarily game-design: even basic physical geometry gains depth from layered goals and rewards. Unity/WebGL is far heavier than needed for this platform. [README](https://github.com/lluckymou/simple-pinball#readme), [license](https://github.com/lluckymou/simple-pinball/blob/main/LICENSE) |
| [cr-ziji/PinballMachine](https://github.com/cr-ziji/PinballMachine) | GPL-3.0 | Small browser game based on Matter.js. It shows that Matter can produce a simple pinball/pachinko experience, but does not establish reliable fast flipper collision or a deep table. [README](https://github.com/cr-ziji/PinballMachine#readme), [license](https://github.com/cr-ziji/PinballMachine/blob/main/LICENSE) |
| [igorski/pinball-schminball](https://github.com/igorski/pinball-schminball) | **Repository-level licensing is ambiguous**: no root LICENSE was present, while inspected TypeScript implementation files carry MIT headers. Treat assets and any unmarked files as unlicensed unless clarified. | TypeScript/Vue/zCanvas with Matter.js. It uses static SVG-derived table bodies, very high solver iteration counts, speed caps, sensor-driven “poppers,” custom attractor-based flipper movement, trigger groups, multipliers, and multi-ball. This is a useful catalog of Matter workarounds and rule architecture, but not a source to copy. [README](https://github.com/igorski/pinball-schminball#readme) |
| [Planck.js Pinball example](https://github.com/piqnt/planck.js/blob/master/example/Pinball.ts) | MIT as part of Planck | Official testbed example: static chain boundary, dynamic rectangular flippers, revolute motors/limits, and a bullet circle. It is proof that Planck directly supports the required physical skeleton, not a complete table design. [Planck README](https://github.com/piqnt/planck.js#readme), [license](https://github.com/piqnt/planck.js/blob/master/LICENSE.txt) |

### Licensing boundary for an original game

- Learn from **mechanics, published behavior, physical principles, and library documentation**.
- Do not translate GPL Visual Pinball/vpx-js functions, constants, table data, scripts, art, or sounds.
- Do not reuse public GitHub code or assets that have no applicable license.
- If Planck is shipped, include its MIT notice in the product's third-party notices.
- Create a new table geometry, scoring economy, names, visual theme, rules, effects, and audio. A familiar physical element such as a bumper or spinner is an idea/mechanism; a specific authored table layout, artwork, script, or code expression should not be copied.

This is engineering guidance, not legal advice.

---

## 2. Matter.js vs Planck.js vs a custom engine

### Matter.js

**Strengths**

- Small and approachable JavaScript API.
- Good support for circles, polygons, compounds, constraints, collision filters, sensors, restitution, and events.
- Complete inspected minified build: approximately 26 KB gzip.
- MIT license and broad browser adoption.

**Pinball-specific weaknesses**

- Matter's own open issue says it currently has **no CCD**; fast bodies can pass through geometry. Its recommended mitigations are multiple updates per frame, thicker physical walls, a speed limit, short timesteps, or a velocity ray cast. See [Matter issue #5](https://github.com/liabru/matter-js/issues/5).
- Pinball concentrates worst-case motion at exactly the problematic interface: a small ball and a fast, thin rotating flipper.
- More position/velocity iterations improve penetration/constraint resolution but do not turn a discrete detector into a swept detector.
- Reliable flippers tend to require custom constraints, attractors, manual angular motion, extra-thick invisible collision shapes, or manual sweep tests.

**Verdict:** acceptable for a simple pachinko-like or deliberately slow arcade game. Not the preferred base for a deep table unless the team accepts manual anti-tunneling work.

### Planck.js

**Strengths**

- A TypeScript/JavaScript rewrite of Box2D, MIT-licensed. [Repository](https://github.com/piqnt/planck.js)
- Default swept CCD prevents dynamic bodies tunneling through static bodies; marking the ball as a bullet extends CCD to dynamic bodies such as flippers. [Body/CCD documentation](https://github.com/piqnt/planck.js/blob/master/docs/pages/body.md#bullets)
- Revolute joints supply a hinge, limits, a motor speed, and maximum motor torque. [Revolute-joint documentation](https://github.com/piqnt/planck.js/blob/master/docs/pages/joint/revolute-joint.md)
- Begin/end, pre-solve, and post-solve events; sensor fixtures; contact normals and impulses. [Contact documentation](https://github.com/piqnt/planck.js/blob/master/docs/pages/contacts.md)
- Natural support for multi-ball and physically moving gates/spinners/targets.

**Costs**

- Complete inspected minified build is approximately 55 KB gzip—larger than Matter, but still lightweight relative to game assets.
- Requires disciplined physics units and a fixed step.
- The world is locked during contact callbacks; buffer semantic events and mutate after `step`.
- General Box2D behavior still needs pinball-specific impulses and state machines. A bumper powered only by restitution will feel weak and speed-dependent.

**Verdict:** best default for this game.

### Custom purpose-built engine

A credible minimal engine would need all of the following:

1. Fixed-step integration and deterministic event ordering.
2. Broad phase over static segments/circles plus dynamic balls/flippers.
3. Swept circle-vs-segment (including endpoints) and swept circle-vs-circle TOI.
4. A rotating capsule/flipper sweep or conservative advancement.
5. Earliest-hit iteration over the remaining fraction of a time step.
6. Penetration correction and stable handling of repeated/resting contacts.
7. Normal and friction impulses, ball-ball momentum, and flipper angular momentum or a documented kinematic approximation.
8. Sensors, one-way gates, collision layers, ramp layers, disabled/drop states, and element cooldowns.
9. Adversarial tests: high-speed wall impact, flipper tip impact, seam/endcap impact, two simultaneous walls, trapped ball, multi-ball, low-frame catch-up, and deterministic replay.

This can outperform a general engine because only balls truly need full dynamics, but the rotating-flipper and multiple-contact edge cases dominate implementation time. Choose it only when avoiding all physics dependencies is a hard requirement and budget a separate physics milestone before table production.

---

## 3. Recommended simulation architecture

### World and timing

- Keep physics outside React state. React owns loading, HUD, menus, and lifecycle; a client-only game controller owns the simulation and renderer.
- Dynamically import the game on the client so Planck and canvas code never execute during SSR.
- Use a logical render space such as **1000 × 1800**, converted to a physics world roughly **10 × 18 units**. Scale only in the renderer; never feed CSS pixels to the solver.
- Use a fixed **1/120 s** step. Accumulate real frame time, cap a single frame's contribution (for example after tab restoration), and allow a bounded number of catch-up steps. Interpolate visual transforms if necessary.
- Make every active ball a dynamic circle with `bullet` enabled. Disable sleeping for balls in play. Use very low linear damping and low rolling/contact friction; tune the playfield's downward gravity rather than faking a constant velocity.
- Use one seeded PRNG for any deliberate “scatter.” Never use unseeded randomness in collision response if replays/tests should be deterministic.
- Place semantic metadata on fixtures (`kind`, `id`, `layer`, `scoreTag`) and keep mutable game state in owned TypeScript objects, not in ad hoc fixture properties.

### Separation of concerns

1. **Physics adapter** — creates/destroys bodies and fixtures, steps the world, exposes positions, buffers raw contacts.
2. **Table definition** — original data-only geometry and element parameters in normalized/logical coordinates.
3. **Element controllers** — flipper, bumper, target bank, gate, spinner, scoop, ramp, plunger.
4. **Rules engine** — consumes semantic events (`bumperHit`, `laneCompleted`, `ballLocked`, `spinnerTick`) and updates score/modes/multiplier.
5. **Renderer/audio/effects** — observes state and events but does not decide physics.
6. **Session controller** — balls, ball save, tilt, pause, game over, deterministic reset/cleanup.

Buffer contacts during Planck callbacks, deduplicate by `(ballId, elementId, contactPhase)`, then process immediately after the step. This follows Planck's documented world-lock constraint and prevents contact callbacks from destroying bodies currently being solved.

### Collision categories

Use explicit bit categories, for example:

- balls;
- solid playfield;
- flippers and moving mechanisms;
- gates/targets;
- scoring sensors;
- lower-ramp layer;
- raised-ramp layer.

A ramp is best implemented as **2.5D state**, not fake 3D rigid-body physics: an entrance sensor switches the ball to a raised collision layer, rendering animates a height value along the ramp path, and an exit sensor restores normal playfield collisions. This permits crossovers without letting the ball collide with geometry visually below it.

---

## 4. Element mechanics

### Ball and walls

- Build walls from static convex fixtures, edge/chain segments, and round posts. Avoid one giant concave polygon unless it is intentionally decomposed and tested for seams.
- Use low wall restitution for ordinary guides and higher restitution only for rubberized posts/rails.
- Add a small amount of tangential friction. Excess friction makes wall glances die; zero friction makes every surface feel like ice.
- Use emergency speed clamping only as a final safety bound, not as the primary anti-tunneling strategy.

### Flippers

Recommended Planck model:

- A dynamic compound “capsule-like” body: a slim central polygon plus rounded base/tip fixtures.
- A revolute joint to a static anchor, with lower/upper angle limits.
- On press: high motor speed toward the raised limit and finite high torque.
- Near end-of-stroke: reduce to hold torque so a trapped ball does not cause chatter or explosive energy.
- On release: lower return speed and lower torque; real flippers return more softly than they fire.
- Keep left/right input independent. Support both keyboard and pointer/touch without routing high-frequency motion through React.

A dynamic motor lets the ball slow the flipper slightly and produces more natural catches. A kinematic flipper gives consistent shots but acts as infinite mass and can inject excessive energy. If kinematic control is chosen, cap its angular speed and calculate collision relative to the moving surface, not a stationary wall.

### Pop bumpers

- Static circular collider plus a visual skirt/cap.
- On a new inward contact above an approach-speed threshold, first let the ordinary collision solve, then apply a one-shot outward impulse along the center-to-ball normal.
- Keep a short per-ball/per-bumper cooldown or require contact separation before rearming. Otherwise persistent contact awards and kicks every step.
- Drive ring compression, flash, sound pitch, score, and nearby light inserts from the same semantic hit event.

### Slingshots

- Rubberized line/capsule along each lower triangular wall.
- Trigger only when relative normal velocity is inward and above threshold.
- Add an outward impulse; optionally scale it so the center of the rubber is strongest and the ends are weaker.
- Rearm on end-contact or after a short cooldown. Pair with a brief animated rubber deflection.

### Stand-up and drop targets

- **Stand-up:** solid thin target; score once on a contact impulse threshold, flash, and remain active.
- **Drop target:** start solid; on qualifying impact, buffer a “drop” action, disable/remove its blocking fixture after the step, and animate it below the playfield. Do not shrink or teleport it inside the callback.
- A bank controller tracks all targets. Completing the bank awards progress, starts a mode or multiplier, then resets after a telegraphed delay.
- Use the post-solve normal impulse or approach speed to reject grazing/resting contacts.

### Plunger

Two useful fidelity levels:

- **Controlled arcade model (recommended initially):** while input is held, accumulate normalized pull distance; animate a plunger body along one axis. On release, if a ball is in the shooter-lane sensor, apply an upward impulse whose magnitude is proportional to pull distance. This is predictable and easy to tune.
- **Physical model:** a dynamic plunger constrained by a prismatic joint. Pull changes displacement; on release a spring-damper force acts along the lane. Spring energy is `E = 1/2 k x²`, so ideal release speed is proportional to pull distance: `v = x sqrt(k/m)`. Let the rod collide with the ball and transfer momentum. Add travel stops and prevent the rod from numerically overtaking the ball after impact.

The controlled model can still preserve the correct energy relationship while avoiding solver-specific launcher behavior.

### Gates and spinners

- **One-way gate:** small bar on a revolute joint with limits and weak return torque. Use collision filtering or pre-solve to reject contact from the allowed side. Never infer side from screen coordinates alone; use contact normal and relative position.
- **Spinner:** low-inertia bar on a free revolute joint with mild angular damping. Award ticks when its unwrapped angle crosses fixed increments, with a maximum count per step to prevent a single numerical jump from generating an absurd score.

### Rollovers, lanes, scoop, locks, kickers

- Rollovers and lane switches are sensors; a lamp-bank controller tracks completion and resets/advances multiplier.
- A scoop/saucer sensor captures a ball by zeroing/freezing it after the step, starts a mode, and ejects it after a short presentation delay.
- A lock removes or parks a captured ball and tracks lock count. Starting multi-ball spawns/releases pooled balls with small separated positions and controlled impulses.
- A kicker/VUK is a sensor plus delayed ejection impulse. It should visibly and audibly telegraph capture/eject so it does not feel like teleportation.

### Ramps and orbits

- Give each major ramp/orbit a clear, repeatable entrance from a flipper shot.
- Use entrance/exit sensors and collision layers for raised ramps. Render height and shadow separately from the 2D solver.
- Add a one-way gate at an orbit exit if backflow would break the intended shot.
- Combos should be temporal rules over completed shots, not extra collision behavior.

### Nudge and tilt

- Nudge applies a small, global lateral impulse to active balls and optionally a tiny displacement to hanging mechanisms.
- Maintain a tilt meter that increases per nudge, decays over time, gives a warning, then disables flippers/scoring when tripped.
- Rate-limit input so key repeat cannot bypass tilt.

---

## 5. Collision mathematics

Notation:

- Vectors are 2D; `·` is dot product.
- `cross(a,b) = a.x b.y - a.y b.x` is the scalar 2D cross product.
- `ω × r = ω(-r.y, r.x)` converts scalar angular velocity to point velocity.
- `e` is restitution in `[0,1]`; `μ` is friction.
- Apply impulses only when objects are approaching along the normal.

### 5.1 Circle versus finite line segment

Let the circle center be `C`, radius `r`, and segment endpoints `A`, `B`.

1. Segment vector: `d = B - A`.
2. Closest-point parameter:

   `t = clamp(((C - A) · d) / (d · d), 0, 1)`

3. Closest point: `Q = A + t d`.
4. Separation vector: `s = C - Q`; distance `D = |s|`.
5. Collision exists when `D < r` (or `D ≤ r + slop` for a tolerance).
6. Contact normal, segment toward circle: `n = s / D`.
7. Penetration depth: `p = r - D`.

Degeneracies:

- If `d · d` is nearly zero, treat the segment as a point.
- If `D` is nearly zero, derive a perpendicular normal from the segment and orient it against relative velocity; do not divide by zero.
- Correct position along `n` before the next detection pass, but use a small slop/percentage rather than moving the entire penetration in one violent jump.

For an immovable wall with velocity zero and a frictionless ball velocity `v`, reflection is:

`v' = v - (1 + e)(v · n)n`, only if `v · n < 0`.

With a moving surface, replace `v` by relative contact velocity, solve the impulse, and then transform back.

#### Swept circle versus segment (custom-engine anti-tunneling)

For center motion `C(t) = C₀ + v t` over `0 ≤ t ≤ h`:

- For the segment's interior, take a unit segment normal `n` and solve the two offset-line equations
  `(C(t) - A) · n = +r` and `= -r`.
- Each candidate has `t = (±r - (C₀-A)·n) / (v·n)`. Accept only candidates in the step whose projected closest point lies between `A` and `B` and whose relative normal motion is inward.
- Test both endpoints separately with swept circle-vs-circle quadratics and choose the earliest valid time.

This split—interior strip plus two endpoint circles—is essential; checking only the infinite line misses tip impacts.

### 5.2 Circle versus circle

For centers `C₁`, `C₂`, radii `r₁`, `r₂`:

1. `d = C₂ - C₁`, combined radius `R = r₁ + r₂`.
2. Collision exists when `d · d < R²`.
3. `D = |d|`, normal from body 1 to 2: `n = d / D`.
4. Penetration: `p = R - D`.

For inverse masses `w₁ = 1/m₁`, `w₂ = 1/m₂`, separate proportionally:

- `C₁ -= n p w₁/(w₁+w₂)`
- `C₂ += n p w₂/(w₁+w₂)`

Let relative velocity be `v_rel = v₂ - v₁` and `v_n = v_rel · n`. If `v_n ≥ 0`, they are already separating; do not add a bounce impulse.

Normal impulse magnitude:

`j = -(1 + e) v_n / (w₁ + w₂)`

Velocity updates:

- `v₁' = v₁ - w₁ j n`
- `v₂' = v₂ + w₂ j n`

For a static bumper, `w₁ = 0`; an *active* bumper then adds a separate game-tuned outward kick after this passive collision response.

#### Swept circle versus circle

Let relative position `p = C₂₀ - C₁₀`, relative velocity `v = v₂ - v₁`, and combined radius `R`. Solve:

`|p + vt|² = R²`

which gives:

- `a = v·v`
- `b = 2(p·v)`
- `c = p·p - R²`
- discriminant `Δ = b² - 4ac`
- earliest candidate `t = (-b - sqrt(Δ)) / (2a)`

Reject if `a` is nearly zero, `Δ < 0`, the bodies are moving apart, or `t` lies outside the remaining step. If `c ≤ 0`, they already overlap and need penetration handling rather than a future TOI.

### 5.3 Rotating flipper collision response

Approximate a flipper as a capsule whose center segment starts at pivot `P`, points along `u = (cos θ, sin θ)`, has length `L`, and physical radius `r_f`. The ball has center `C`, radius `r_b`.

1. Find the closest point `Q` on segment `[P, P + Lu]` using the circle-segment projection above.
2. Treat collision radius as `r_b + r_f`.
3. Normal: `n = normalize(C - Q)`, from flipper toward ball.
4. Flipper lever arm: `r_fq = Q - P`.
5. Flipper surface velocity at contact:

   `v_f = v_P + ω_f × r_fq`

   For a fixed pivot, `v_P = 0`, so `v_f = ω_f(-r_fq.y, r_fq.x)`.

6. Ball contact velocity including spin:

   `v_b,c = v_b + ω_b × (-r_b n)`

7. Relative velocity: `v_rel = v_b,c - v_f`; approach speed `v_n = v_rel · n`.

If `v_n < 0`, apply a normal impulse. For a ball of mass `m_b`, moment of inertia `I_b`, and a pivoted flipper with rotational inertia `I_f`:

`j_n = -(1+e)v_n / [1/m_b + (cross(-r_b n,n)²/I_b) + (cross(r_fq,n)²/I_f)]`

The ball's normal lever term is zero for a perfect circle because `-r_b n` is parallel to `n`, but retaining the general expression makes the derivation clear.

Updates for a dynamically responding flipper:

- `v_b += (j_n/m_b)n`
- `ω_b += cross(-r_b n, j_n n)/I_b` (zero for the pure normal impulse)
- `ω_f -= cross(r_fq, j_n n)/I_f`

The motor then supplies torque on subsequent solver steps. This allows a hard ball hit to slow the flipper rather than treating it as infinite power.

For a kinematic/infinite-authority flipper, omit the flipper inertia term and do not alter `ω_f`; the ball still responds to the moving-surface relative velocity. This is simpler but can create energy, so keep angular speed bounded.

#### Tangential friction and ball spin

Let tangent `t = (-n.y, n.x)`. Compute tangential relative speed `v_t = v_rel·t` and the corresponding effective-mass denominator (including ball and flipper rotational lever terms). The unconstrained tangential impulse is `j_t = -v_t/K_t`, clamped to Coulomb friction:

`|j_t| ≤ μ |j_n|`.

Apply `j_t t` to linear/angular velocities. This produces post contact and flipper-rubber grip without inventing a sideways force unrelated to contact.

#### Rotating-flipper CCD

A closest-point overlap test at the end of a frame is not enough. During the step, every flipper point follows an arc and the tip can cross the ball without ending overlapped.

Preferred options, in order:

1. Let Planck solve it with the ball marked as a bullet and the flipper represented as a dynamic motorized body.
2. In a custom engine, use conservative advancement: evaluate capsule distance and relative closing speed, advance by a safe fraction of `distance/closingSpeed`, and iterate to contact.
3. As a simpler approximation, subdivide based on maximum tip travel so neither ball nor flipper tip moves more than a chosen fraction of ball radius per substep. This is less robust than TOI and should have a hard substep cap.

---

## 6. What makes the table rich rather than merely busy

Implement physical variety, shot variety, and rule progression together.

### Physical interaction set

Minimum rich v1:

- two main flippers plus optional upper flipper;
- plunger and shooter lane;
- two slingshots;
- three pop bumpers;
- four-bank drop targets;
- three stand-up targets;
- four top rollover lanes;
- left and right inlanes/outlanes;
- one spinner;
- one one-way gate;
- one scoop/saucer;
- one raised ramp with a return lane;
- one full orbit and one shorter loop;
- one ball lock and 3-ball multi-ball;
- drain, trough, ball save, nudge, and tilt.

Good second-wave elements:

- vari-target or captive ball;
- pop-up post/magna-save;
- second ramp/crossover;
- kickback in one outlane;
- timed hurry-up shot;
- mystery award;
- extra ball and replay/achievement targets.

### Rules depth

- Lane completion advances a playfield multiplier.
- Drop-bank completion lights the lock or starts a timed mode.
- Spinner builds a meter; a ramp cashes it out.
- Consecutive distinct major shots form a combo with a short timer.
- Lock two balls, then hit the scoop/ramp to start multi-ball.
- Multi-ball has a clearly lit jackpot shot and a super-jackpot qualification sequence.
- End-of-ball bonus totals lanes, targets, modes, and multiplier.
- Early drain gets a visible timed ball save; do not silently respawn.
- Modes should change lights, scoring priorities, music layers, and callouts—not only multiply all points.

A rich game continually presents one obvious immediate objective and one longer-term objective. Flashing every insert equally produces noise, not depth.

---

## 7. Suggested original table layout

Use normalized coordinates with `x = 0..1` left-to-right and `y = 0..1` bottom-to-top. These are design anchors, not copied geometry.

### Lower playfield

- Drain centered below `y = 0.08`; trough is outside the playable collision area.
- Main flipper pivots near `(0.34, 0.15)` and `(0.66, 0.15)`, with a deliberate center gap.
- Slingshot triangles occupy approximately `x = 0.18..0.38` and `0.62..0.82`, `y = 0.18..0.29`.
- Inlanes run just outside the slings; outlanes hug the side walls. Make one outlane slightly more dangerous and give it a kickback award.
- Right shooter lane occupies `x = 0.90..0.98`, from the plunger at `y ≈ 0.08` to a curved top feed at `y ≈ 0.88`.

### Middle playfield: three readable shots

- **Left orbit entrance** around `(0.14, 0.40)`, curving around the top and optionally exiting right.
- **Center ramp entrance** around `(0.48, 0.36)`, rising diagonally to the upper right and returning to the left inlane. Its entrance should be reachable by a clean right-flipper shot.
- **Right spinner/loop entrance** around `(0.78, 0.44)`, reachable by the left flipper.
- Put a four-target bank diagonally at `x = 0.19..0.34`, `y = 0.50..0.64`; it should be shootable but not block the orbit.
- Put the scoop at roughly `(0.70, 0.58)`, shielded by one post so capture is intentional rather than accidental.
- Add an upper-right flipper around `(0.72, 0.53)` to shoot a short upper-left loop or lock lane.

### Upper playfield

- Three pop bumpers in a loose triangle centered near `(0.50, 0.72)`, with enough exit gaps that the ball does not rattle indefinitely.
- Four rollover lanes across `x ≈ 0.30..0.70`, `y ≈ 0.91`, fed by the shooter lane and orbit.
- Put a lock lane behind the upper-left loop around `(0.24, 0.78)`.
- Use stand-up targets and lit posts around the bumper nest to guide exits toward major shots.

### Flow checks before art lock

- Every major shot must have at least one flipper origin and a clean centerline.
- A failed ramp shot should return to a controllable area, not fall straight down the middle every time.
- Bumper exits should distribute among lanes, flippers, and orbits rather than repeat one dominant drain path.
- Avoid nearly ball-width gaps and acute concave corners; they create jams and solver stress.
- Ensure the shooter lane cannot leak into the drain before crossing its one-way gate.
- Test left-only and right-only play so neither flipper becomes a spectator.

---

## 8. Practical implementation order and acceptance tests

### Build order

1. Fixed-step controller, scale conversion, one bullet ball, static wall/post fixtures, drain sensor.
2. One motorized flipper; tune catches, tip shots, and end-of-stroke behavior before adding a table.
3. Second flipper, slings, plunger, trough/ball lifecycle, nudge/tilt.
4. Bumpers, rollovers, stand-ups, drop-bank controller.
5. Spinner, gate, scoop, orbit, ramp layer system.
6. Locks, ball pool, multi-ball, ball save, jackpot state machine.
7. Rule modes, scoring balance, deterministic replay tests, audio/lighting polish.

### Physics acceptance tests

- Ball cannot tunnel through a normal wall at maximum allowed launch speed.
- Ball cannot tunnel through either a resting or fully powered flipper tip.
- Segment endpoint/post seams do not trap or teleport the ball.
- A ball resting on a raised flipper can be cradled without perpetual jitter.
- A live catch and a fast flip produce different, plausible outcomes.
- Bumper/slingshot kicks fire once per impact and rearm after separation.
- Drop targets never change world structure during a contact callback.
- One-way gates pass from the allowed side and block from the other at low and high speed.
- Multi-ball collisions conserve plausible momentum and never duplicate score events per solver contact.
- Physics result is unchanged by rendering at 30, 60, or 144 Hz for the same fixed-step input timeline.
- A long browser-tab pause does not run an unbounded catch-up loop or explode ball speed.

### Gameplay acceptance tests

- A new player sees an obvious lit shot within one second of launch.
- At least three major shots are repeatable from controlled flipper states.
- One short-term goal can be completed in the first minute; multi-ball is achievable but not automatic.
- Rules events, score, lamp state, audio, and animation derive from the same semantic event stream.
- A full game reaches a real game-over state, allowing the platform to emit a genuine completion event rather than only session end.

---

## 9. Source and method notes

### Inspected primary sources

- Visual Pinball repository, README, license, and representative physics architecture: <https://github.com/vpinball/vpinball>
- VPX-JS README/license and representative player/flipper/plunger/bumper/slingshot physics files: <https://github.com/vpdb/vpx-js>
- Visual Pinball Engine README/license: <https://github.com/freezy/VisualPinball.Engine>
- Planck repository, current package metadata, body/CCD docs, contacts docs, revolute-joint docs, and official pinball example: <https://github.com/piqnt/planck.js>
- Matter repository, current package metadata, features/license, and maintainer CCD issue: <https://github.com/liabru/matter-js>, <https://github.com/liabru/matter-js/issues/5>
- Browser/game project repositories linked in the census.

### Verification scope

- Ten repositories/libraries were shallow-cloned and inspected locally at their 2026-08-18 reachable heads.
- Current npm metadata checked: `matter-js` 0.20.0 and `planck` 1.5.0, both MIT.
- Bundle-size figures are direct byte/gzip measurements of the full minified artifacts checked into the inspected repositories, not claims about a particular Next.js tree-shaken chunk.
- Repository recency was used only as a maintenance signal; no claim is made that every project is production-ready.
- All collision formulas and implementation recommendations in this report are newly written explanatory guidance. No surveyed source code is reproduced.
