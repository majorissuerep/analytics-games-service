# Prism app personality brief

11 November 2026. This brief supersedes the earlier requirement that every app
use the same four category hues and decorative treatment. XP desktop, taskbar,
Start menu, window chrome and native controls remain XP. App content is personal.

## Shared engine, individual expression

Current normative direction: [experience/VISION.md](experience/VISION.md).
Use elementary OS and Zorin OS as forced references for task hierarchy and rounded
material care, while preserving XP chrome. Read the current request and app contract
before implementation. Historical app dossiers are evidence of prior decisions,
not acceptance of the current release. An independent agent reviews actual viewport
captures and interactions through the three gates in the experience workflow.

The shared engine owns contrast, typography roles, spacing rhythm, keyboard and
pointer behavior, focus, semantic states, scoped loading, recovery, reduced
motion/transparency and responsive containment. Apps own composition, density,
surface temperature, signature shapes, bounded gloss, tool placement and voice.

Each app has a strict decorative color budget: at most two chromatic families
(normally pink for intent plus one app identity), supported by a small neutral
ramp. A family may have ink, fill and edge variants. A one-family app is valid.
Semantic warning/error/success and essential domain colors (paint, chess loss,
native table art) are exceptions with fixed meaning, never extra decoration.
No rainbow of unrelated cards. Pink is a deliberate signature, not a mandatory
background. Avoid dull universal grey, vast color washes and gratuitous garnish.

App roots may override shared `--ui-*` tokens for canvas/surfaces/material/shape,
and remap unused category tones into the identity family. Changes must be scoped
to that app. Shared primitives remain the source of control behavior and safety.
Dense content has stable opaque backing. Glass is a bounded layer with a reason.

## Per-app research and implementation seed

1. Read AGENTS.md, APPLICATION_DESIGN.md, DESIGN_SYSTEM_RESEARCH.md, this brief,
   existing implementation, tests and actual user flows. Identify task hierarchy,
   the three most consequential friction points, and what must not regress.
2. Research at least three relevant references: maintained niche tools/games with
   focused UI plus authoritative platform interaction guidance. Use direct sources
   and specific screens/workflows, not generic inspiration galleries. Record URLs,
   what was actually inspected, useful patterns and unsuitable patterns. Do not
   invent usability results or claim clinical eye safety.
3. Generate three meaningfully different directions (composition/material/workflow,
   not three palette swaps), choose one based on the app's task and density, and
   explain the tradeoff. Document a compact personality contract: character,
   palette budget, surface/material, hierarchy, signature interaction and exceptions.
4. Implement the selected direction for this app only. Improve real UX, navigation,
   alignment, density, empty/disabled/error/loading states and narrow layouts. Keep
   existing semantics, algorithms, runtime, telemetry and tested selectors where
   possible. No new infrastructure, no speculative features, no copied art.
5. Verify desktop and 390/320px narrow states, keyboard focus, reduced motion,
   reduced transparency and real interactions. Visually inspect screenshots when
   possible; report evidence and limitations. Avoid declaring polish by CSS alone.
6. Write `docs/app-personalities/<app>.md` with sources, alternatives, decision,
   implementation and checks. Do not commit/push: the coordinator integrates and
   tests the whole platform. Do not edit shared files outside assigned ownership.

Quality means deliberate construction comparable in care to maintained desktop
apps; it does not mean claiming platform-native rendering or copying an OS skin.
