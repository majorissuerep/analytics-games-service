# Prism application design system

Version 1, 11 November 2026. [Research and source assessment](DESIGN_SYSTEM_RESEARCH.md).
Live reference: `/design-system`.

Prism combines luminous neutral foundations, frosted control layers, expressive
colored content, and a pink signature. Foundations include materials, type,
spacing, shape, elevation, color roles, components, states, and responsive rules.

## Boundary and ownership

Preserve the XP wallpaper, icons, Start menu, taskbar, outer window borders,
title bars, and window controls. Content inside those boundaries uses Prism.
Pip's outer chat header remains XP; its conversation and controls use Prism.

`public/styles/app-theme.css` owns reference values, semantic tokens, and shared
primitives. App CSS maps game components to these roles and owns game geometry.
Next.js imports the theme globally; Pinball links it; Cosmic Forge copies it at
workbench assembly. A shared script applies persisted material preferences.

## Color roles

| Role | Foreground meaning |
| --- | --- |
| Pink: `--ui-accent`, `--ui-accent-ink`, `--ui-pink-bg` | Primary fill, darker text ink, selection and key value |
| Violet: `--ui-violet`, `--ui-violet-bg` | Analysis, second category, timer |
| Teal: `--ui-teal`, `--ui-teal-bg` | Collaboration, creation, shared session |
| Amber: `--ui-amber`, `--ui-amber-bg` | Time budget and attention category |
| Positive / warning / negative / info | Actual state feedback, distinct from category identity |
| Canvas / surface / raised / recessed | Whitish foundation, content, input, grouping |

Use `ui-tone` with `data-tone="pink|violet|teal|amber"` for meaningful content
groups. Compose `ui-badge`, `ui-metric`, and `ui-icon` for colored content accents.
`ui-primary` is the pink action; `ui-selected` adds a structural selected cue.
Category identity remains stable by role, never randomized by current ranking.

Most useful groups should show category, value, identity, or state color: mode
cards, metrics, avatars, room information, selected tools, and status chips.
Body prose stays dark and readable. Neutral backgrounds are valid. Avoid using
success/error for decoration or turning every word into a different color.

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
| Canvas | Near-white with soft stationary pink/violet light | Foundation, never the only colored area |
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

## Typography, space, shape, density

- Interface: Segoe UI/system sans; moves/codes/numbers: Consolas/system mono.
  Use tabular numerals for changing values; no remote font dependency.
- Body 14px/1.5; support 12px/1.45; titles 20–28px/1.2; display 32–48px/1.1.
  Establish hierarchy with weight and space. Paragraphs target 65 characters.
- Space 4/8/12/16/24/32/48px. Labels within 8px of controls; groups separated
  by 16–24px. Dense data remains compact, aligned, and independently scrollable.
- Radius: 10px controls, 16px panels, 24px feature/overlay. Pills are reserved
  for badges, identity marks, and segmented containers. Board cells stay square.
- Elevation: default edge; raised short shadow; floating deeper shadow; overlay
  scrim plus floating surface. Elevation communicates actual hierarchy.
- Standard controls target 40px height; coarse pointers 44px. Palettes/boards
  retain functional geometry, visible focus, and their own zoom/scroll controls.

## Components and states

| Component | Appearance and behavior |
| --- | --- |
| Primary action | Pink fill/white label; darker hover/pressed; 3px focus; explicit disabled state |
| Secondary action | Light backing/readable edge; pink hover; no moving target or layout shift |
| Category/mode card | Named colored icon and tint; selected edge/inset cue, label, and weight |
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
than widen the page. XP windows own desktop sizing and dragging.

Target normal text 4.5:1; large text and essential state/control cues 3:1. Evaluate
material compositing over light and dark backgrounds. Tone inks pair with their
own fills. Keep visible labels/numbers alongside identity and score color. Focus
is a 3px high-contrast outline. This is not a whole-product certification or a
medical eye-safety claim.

## Adoption and acceptance

Apply `app-surface` to content roots; compose `ui-glass`, `ui-card`, `ui-tone`,
`ui-badge`, `ui-icon`, `ui-metric`, `ui-primary`, and `ui-selected`. Never attach
the theme to XP wrappers or apply form sizing to chess piece buttons.

Coverage: Chess/arena, Radar phases, Minefield, Paintbox, Pinball cabinet, Cosmic
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
