# Paintbox — the paper studio

11 November 2026. Authority: APP_PERSONALITY_BRIEF.md; scope is Paintbox content only.

## Task audit

Primary loop: choose pigment and brush size → draw → undo/redo → save a PNG.
Secondary tasks: erase and start a fresh sheet. Preserve the 960 × 560 raster,
white eraser, ten semantic paint colors, pointer capture, undo snapshots, scoped
export feedback, filename and save completion telemetry.

Three consequential frictions in the previous implementation:

- A vertical toolbar consumed scarce phone width, shrinking the actual sheet.
- Size had no numerical feedback; color selection lacked pressed semantics.
- Undo had no redo recovery; mobile hid the only status announcement visually.

## Direct reference research

Inspected official source text, not an inspiration gallery or fabricated study:

| Source | Inspected workflow and useful detail | Deliberately omitted |
| --- | --- | --- |
| [Krita basic concepts](https://docs.krita.org/en/user_manual/getting_started/basic_concepts.html) | Canvas/view distinction; dockers hold tool options and color selectors while the image remains a distinct white rectangle. Separate paper from tool material; group controls by task. | Multiple windows, layers and configurable dockers exceed this small drawing tool. |
| [Pinta user guide](https://www.pinta-project.com/user-guide/) | Simple bitmap editing overview, customizable workspace and history for experimentation. Keep recovery adjacent to document actions. The guide explicitly documents version 1.6, so it is historical workflow evidence, not proof of current screen geometry. | Adjustment/effect menus, layers and full history UI are unnecessary here. |
| [Concepts official manual / getting started](https://concepts.app/en/ios/manual/tools) | Status bar carries drawing identity/export; tool wheel groups active tool, property sliders, current color, undo and redo. Expose current size and keep paint changes close to tools. | Radial wheel, configurable gestures and infinite/vector canvas would change established behavior. |
| [W3C target size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24px minimum with spacing exceptions; larger controls encouraged. Regular actions use 40px; coarse-pointer palette becomes 44px and two rows on phones. | No claim of complete WCAG certification. |

## Three directions and choice

1. **Paper studio (selected):** fixed left tool/pigment dock, quiet document strip,
   warm opaque work mat and an inset sheet; tool controls move above the paper on
   phones. Material and placement establish the hierarchy.
2. **Floating sketch pad:** edge-to-edge neutral canvas with floating brush/palette
   bar and export corner. More canvas space, but overlays obscure marks and narrow
   screens require collision handling.
3. **Print desk:** document-led page with wide paper, bottom horizontal pigment
   tray and a small inspector. Strong export emphasis but more pointer travel
   between brush and pigment and more vertical cost on phones.

Paper studio favors predictable tools and unoccluded drawing. Desktop sacrifices
178px for a stable dock; phones recover the full sheet width by moving controls.

## Personality contract

Character: approachable, precise, tactile drawing room. Decorative color budget:
one pink family for intent/selection, plus warm achromatic paper/graphite ramp.
Actual pigment colors are semantic drawing data and remain unchanged. No rainbow
category cards. Opaque backing on dock, sheet and status rail; the document strip
alone uses shared bounded frost and shared material fallbacks. Shape signature:
a small pencil mark and circular pigment wells, square paper corners. Hierarchy:
white sheet first, tool pairs second, export in pink, metadata quiet. Tool selection
has pressed semantics, edge and inset cue; changing pigment returns to Brush.

## Implementation and checks

- Rebuilt composition, paper breathing room, dock grouping, active brush preview,
  size output, document metadata, visible narrow-screen status and phone layouts.
- Added redo using the same ImageData snapshot approach; any new action clears the
  redo branch. Undo remains capped at ten saved actions. New remains undoable.
- B/E tool shortcuts and Ctrl/⌘ Z, Ctrl/⌘ Shift Z, Ctrl/⌘ Y recovery are handled
  only by events inside Paintbox. Input key handling is left to the native slider.
- Kept drawing, eraser, save filename, export feedback and completion signal.
- Scoped ESLint passed. No shared files, build, commit or push performed.
- Chromium screenshots at 1280×900, 390×844 and 320×844 visually inspected:
  sheet/tool hierarchy is visible and document scroll width equals viewport width.
  Artifacts: `/tmp/paintbox-1280.png`, `/tmp/paintbox-390.png`,
  `/tmp/paintbox-320.png`.
- Real initialized canvas pixel check: draw `[17,17,17,255]`, Undo white,
  Redo black, keyboard Undo white and keyboard Redo black. PNG download succeeds
  as `paintbox-drawing.png`. Use localhost for this dev server: 127.0.0.1 rendered
  SSR but HMR origin rejection prevented initialization during the first attempt.
- Drawing remains a spatial pointer task; keyboard controls support tool choice,
  size, recovery and export, not a new keyboard painting system.
- Touch 320px layout additionally inspected with two rows of 44px pigments and
  no horizontal overflow. Shared consent can overlay standalone screenshots.
- Limitations: direct mutation of material dataset was reset by the shared
  preference script; follow-up with persisted storage timed out waiting for the
  app. Integrated persisted material/reduced-transparency and keyboard focus
  appearance checks are left to coordinator; no material pass is claimed here.
