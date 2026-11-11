# Prism application design system

Version 2, 11 November 2026. [Research and source assessment](DESIGN_SYSTEM_RESEARCH.md).
Live reference: `/design-system`.

Prism is a shared perceptual and interaction engine. Apps have individual
personalities: different composition, surface temperature, density, signature
shapes and bounded gloss. They share readable contrast, predictable controls,
focus, feedback, spacing rhythm and accessible fallbacks. Pink is a signature,
not a requirement to paint every surface alike.

[App personality brief](APP_PERSONALITY_BRIEF.md) defines the per-app research and
implementation process. [Individual dossiers](app-personalities/) record direct
references, rejected alternatives, chosen personality and verification.

## Boundary and ownership

Preserve the XP wallpaper, icons, Start menu, taskbar, outer window borders,
title bars, and window controls. Content inside those boundaries uses Prism.
Pip's outer chat header remains XP; its conversation and controls use Prism.

`public/styles/app-theme.css` owns reference values, semantic tokens, and shared
primitives. App CSS maps game components to these roles and owns game geometry.
Next.js imports the theme globally; Pinball links it; Cosmic Forge copies it at
workbench assembly. A shared script applies persisted material preferences.

## Color budget and ownership

Every app declares a small neutral ramp and **at most two decorative chromatic
families**, normally pink intent plus one subdued identity. Ink, fill and edge
variants of a family are allowed. Semantic feedback and essential domain colors
are separately justified exceptions; they never become decorative card colors.
A one-family app is welcome. The shared palette is a library of options, not a
checklist to display every hue at once.

| Role | Contract |
| --- | --- |
| Pink intent | Primary action, active selection, restrained brand signature |
| App identity | One optional family, chosen for the app and fixed by meaning |
| Neutrals | Small coherent ramp for canvas, stable content, recessed groups and text |
| State | Positive/warning/negative/info only when those states occur; explicit labels |
| Domain | Drawing pigments, native table artwork, chess quality and board information retain their data meaning |

`public/styles/app-theme.css` provides defaults and primitives. Each app scopes
`--ui-*` values to its own `app-surface` root. Use `data-tone="identity"` for
app identity, or remap existing named categories into that family. Do not leak
app variables into `:root`, XP chrome or another app. Compatibility aliases are
rebound at each app root so local ink/material values reach legacy components.

Useful content receives intentional color through selected tools, values,
identity, meaningful edges and states. Other content stays legible and calm.
No default rainbow of cards; no monochrome treatment that removes useful cues.

Chess move quality uses fixed loss-from-best thresholds: best is 0.00/green,
−0.10 remains greenish, and −0.50 or worse saturates red. The overall position
balance is separate; color is never stretched to candidate count or worst listed
move. Mate changes use explicit labels rather than invented pawn equivalents.
Teams keep stable identities;
paint swatches keep drawing colors. Minefield states retain distinct contrast,
shape, and labels. Essential playfield artwork and geometry remain game-owned.

## Material and elevation roles

| Material / primitive | Definition | Use |
| --- | --- | --- |
| Canvas | App-specific neutral foundation; optional restrained stationary light | Foundation, never the only colored area |
| Solid / `ui-card` | Opaque backing, quiet edge | Dense content, code, metrics, playfields |
| Frost / `ui-glass` | White at 76% alpha, 18px blur, highlight edge, short soft shadow | Control bars, app navigation, floating groups |
| Strong frost | White at 90% alpha, bounded blur | Text-rich floating/overlay panels |
| Recessed | Solid pale neutral or named category fill | Grouped controls and data |
| Overlay | Floating shadow plus separate scrim | Modal or floating assistant |

Background alpha never reduces text opacity. Prefer a single material boundary
around a group; avoid nested blur and per-cell filters. No distortion, moving
light, or shadow on every data row. Fine highlights communicate a material edge.

Solid is the baseline; `@supports` enables backdrop blur. Reduced transparency,
increased contrast, and the persisted “Reduce transparency” preference restore
opaque materials. Forced-colors mode uses system colors and preserves focus and
selection outlines. Same-origin embedded apps share the persisted preference.

Desktop materials must actually composite the wallpaper: the XP frame paints its
blue edges, the window body owns the desaturated backdrop blur, and embedded
HTML/body/iframe layers are transparent. Apps select `--ui-embedded-fill`; the
default is the normal frost backing. Apps using a lighter fill must check their
unbacked text against the darkest composed wallpaper. System panels use strong
frost for their existing support copy. Playfields and dense content stay opaque.
`--ui-glass-sheen` supplies one stationary highlight, removed in solid/contrast
modes. An alpha token over an opaque document does not count as visible glass.

The default decorative tone aliases share a neutral family; an app must explicitly
opt into an identity. Mode choices are neutral until selected. Do not assign an
unrelated hue to every category simply because a token exists.

## Typography, space, shape, density

- Interface: Segoe UI/system sans; moves/codes/numbers: Consolas/system mono.
  Use tabular numerals for changing values; no remote font dependency.
- Body 14px/1.5; support 12px/1.45; titles 20–28px/1.2; display 32–48px/1.1.
  Establish hierarchy with weight and space. Paragraphs target 65 characters.
- Space 4/8/12/16/24/32/48px. Labels within 8px of controls; groups separated
  by 16–24px. Dense data remains compact, aligned, and independently scrollable.
- Default radius: 10px controls, 16px panels, 24px feature/overlay. Apps may select
  a coherent smaller set appropriate to their tools and density. Pills are reserved
  for badges, identity marks, and segmented containers. Board cells stay square.
- Elevation: default edge; raised short shadow; floating deeper shadow; overlay
  scrim plus floating surface. Elevation communicates actual hierarchy.
- Standard controls target 40px height; coarse pointers 44px. Palettes/boards
  retain functional geometry, visible focus, and their own zoom/scroll controls.

## Components and states

| Component | Appearance and behavior |
| --- | --- |
| Primary action | Pink fill/contrasting label; darker hover/pressed; 3px focus; explicit disabled state |
| Secondary action | Light backing/readable edge; pink hover; no moving target or layout shift |
| Category/mode card | App identity or neutral icon and tint; selected edge/inset cue, label, and weight |
| Input/select/textarea | Stable backing/visible boundary; external focus; invalid state with explanatory text |
| Metric/status | Colored value, explicit label/unit, fixed meaning, tabular number |
| Segmented control | Quiet group; selected pink segment plus structural cue; keyboard focus visible |
| Modal/popover | Strong material over scrim; text legible; game-owned interaction behavior preserved |
| Dense data row | Stable backing; hover edge/selection; continuation fits; internal scroll without clipping |

Feedback uses 140–200ms color/edge/shadow transitions. No continuous decorative
motion. Reduced-motion mode suppresses transitions/entrances. Progress remains
understandable. Dense targets never move under the pointer on hover.

## Responsive and accessible behavior

Stack groups below 760px. Headers wrap core actions rather than hide them.
Verify 1280, 390, and 320px. Large boards use their own scroll/zoom region rather
than widen the page. XP windows own desktop sizing and dragging. Setup forms should fit the normal
window with their primary action visible. Long forms use document-edge scrolling,
not a capped setup panel floating a scrollbar over controls. Explicit data regions
may scroll independently with reserved scrollbar space. Verify actual embedded
windows as well as standalone routes.

Target normal text 4.5:1; large text and essential state/control cues 3:1. Evaluate
material compositing over light and dark backgrounds. Tone inks pair with their
own fills. Keep visible labels/numbers alongside identity and score color. Focus
is a 3px high-contrast outline. This is not a whole-product certification or a
medical eye-safety claim.

## Adoption and acceptance

Apply `app-surface` to content roots; compose `ui-glass`, `ui-card`, `ui-tone`,
`ui-badge`, `ui-icon`, `ui-metric`, `ui-primary`, and `ui-selected`. Choose primitives appropriate to the app, not identical compositions. Never attach
the theme to XP wrappers or apply form sizing to chess piece buttons.

Coverage: Chess/arena, Mafia preview, Minefield, Paintbox, Pinball cabinet, Cosmic
Forge workbench, Welcome/Help/Plugins, Sticky Note/Pip, privacy, developer guide.
Cross-origin authors opt in through public assets documented on `/develop`.

Review `/design-system` and real gameplay screenshots. Run design browser checks
and relevant regressions. Verify material preference across frames, motion and
transparency fallbacks, forced colors, contrast, focus, phone overflow, hint-row
clipping, and late-game Minefield density. A background/palette-only change is
insufficient; meaningful colored content and material hierarchy must be visible.

## Waiting, progress, and recovery

Every user-visible asynchronous operation shows feedback immediately in the
smallest affected region. Use `components/ui/LoadingState.tsx`: page for route
entry, app for opening an iframe or game module, section for model inference,
room actions or board generation, and inline for compact auxiliary work. Keep
unaffected navigation and controls usable; never cover the desktop for a model
request inside Chess. Routine background polling does not flash loaders.

Show the current stage, elapsed time, and an accessible progress bar. Unknown
work stays indeterminate with no `aria-valuenow`; never infer completion from
time or search depth. Only measured quantities with a known total (for example,
uploaded bytes) get percentages. Engine startup reports actual runtime stages;
search depth and generation attempts are activity details, not completion.
Pink identifies active work. Green means completion, amber attention, and red
failure, with explicit text as well as color. Numeric game scales remain
domain-specific; the chess loss thresholds do not define unrelated apps.

Abort stale requests on selection changes and unmount. Offer cancellation for
long local work, bound network waits, and replace failed loaders with an
explanation and retry or a useful next action. Preserve user input on failure.
Use polite stage announcements, a non-announcing elapsed timer, visible focus,
reduced-motion static progress, and system colors under forced colors.

Next route loading boundaries cover page/game navigation; desktop frames wait
for actual app readiness. Static runtimes use the shared meter styles and real
readiness callbacks. Error boundaries provide recovery when a page cannot open.
