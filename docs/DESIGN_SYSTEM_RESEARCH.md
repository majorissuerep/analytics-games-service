# Prism: research and design decisions

Research date: 11 November 2026. Scope: all platform-owned app content, including
dense games, desktop tools, static cabinets, and developer documentation.

The brief is a modern, coherent system with glass and opacity, a strong pink
identity, and useful colored content. The XP desktop and window controls remain
XP. White and grey are valid background materials. Color should explain the
foreground rather than merely recolor the page behind monochrome content.

## Sources and their practical implications

| Source checked directly | Finding or guidance | Product decision |
| --- | --- | --- |
| [Apple HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials.md), current guidance | Distinguishes glass controls/navigation from content; cautions against excessive glass and accounts for transparency preferences. | Frosted toolbars and floating panels; stable content and opaque playfields. No refraction of numbers, squares, or text. |
| [Fluent 2: Material](https://fluent2.microsoft.design/material) | Separates solid surfaces, translucent acrylic, opaque tinted mica, and modal scrims. | Define several material roles. Our CSS frost is not a native Apple/Windows material implementation. |
| [Fluent 2: Color](https://fluent2.microsoft.design/color) | Separates neutral, brand, shared, and semantic palettes; promotes consistent tokens and redundant state cues. | Neutral foundations, pink brand, named content categories, and separate feedback roles. Keep visible labels with color. |
| [Material 3 color roles](https://m3.material.io/styles/color/roles) and [official implementation guide](https://developer.android.com/develop/ui/compose/designsystems/material3) | Uses paired container/foreground roles plus type and shape systems. | Give every content tone readable ink. Define type, shape, spacing, and states alongside color. |
| [Atlassian: Elevation](https://atlassian.design/foundations/elevation/) | Models sunken, default, raised, and overlay surfaces with appropriate shadows. | Four elevation roles. Shadows signal lift; spacing and borders organize dense rows. |
| [Carbon: Visualization palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes) | Distinguishes categorical, sequential, and alert color. | Stable category identities, fixed quantitative scales, separate alerts. Pink never replaces chess best-to-worse move quality meaning. |
| Putkonen et al., [Understanding visual search in graphical user interfaces](https://research.aalto.fi/en/publications/understanding-visual-search-in-graphical-user-interfaces/), IJHCS 199 (May 2025), DOI 10.1016/j.ijhcs.2025.103483 | Eye tracking with 84 people across 900 GUIs found GUI type, cue type, and target presence affected search time more than complexity. Describes a guess–scan–confirm pattern. | Predictable context/action positions and explicit labels matter. Removing color alone is not evidence of better usability. This is not a glass or eye-health study. |
| Pei et al., [Interface complexity and luminance contrast in digital museums](https://doi.org/10.1002/hfm.70060), 9 September 2026 | Accessible abstract reports interacting density, layout, and contrast effects on search time and pupil measurements. | Review dense states and rendered contrast together. Only the abstract was available; this context-specific study does not establish a universal palette, blur, or medical eye-safety claim. |
| [WCAG text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | Defines contrast requirements and alternatives to color-only meaning. | Target 4.5:1 normal text, 3:1 large text/essential control cues. Evaluate composited materials; retain labels, shape, numbers, and outlines. No whole-product certification claim. |
| [WCAG target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 24 CSS-pixel minimum with exceptions; larger targets are encouraged where practical. | Regular controls target 40px height, 44px on coarse pointers. Preserve essential game geometry and explicit zoom. XP controls retain their geometry. |
| [MDN backdrop-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter) | Backdrop blur needs partial surface transparency; older browsers may not support it. | Alpha on backgrounds, fully opaque text, bounded blur on grouped surfaces, solid fallback. Never blur individual cells. |
| [MDN reduced transparency](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-transparency) | Device preference can improve readability; browser support remains limited. | Honor the query and expose persisted “Reduce transparency” control across same-origin windows/frames. |
| [DTCG Format 2025.10](https://www.designtokens.org/tr/2025.10/format/) | Stable community token interchange specification; not a W3C Recommendation. | Separate reference values, semantic aliases, and component use. CSS remains executable truth; no claim that CSS is a DTCG exchange file. |

## Synthesis and explicit choices

Version 2 tightens the decorative palette to two families per app. Pink anchors
intent, with one optional app-specific identity. The earlier four-category
palette is a source library, not a required appearance. Semantic signals remain
fixed and distinct from identity. Useful content receives color through
mode cards, metrics, room identities, selected tools, status chips, and values.
Body prose remains dark on readable surfaces. Backgrounds may be neutral.

Glass explains layering through alpha, blur, a highlight edge, and a soft shadow.
It belongs on control bars and floating panels. Dense move lists, clues, code,
canvases, boards, and arcade artwork retain stable backing. Text stays opaque.
No moving blobs, endless shimmer, refraction, or repeated cell-level blur.

Type hierarchy, spacing, radius, elevation, density, and interaction states are
defined together. A page-wide tint alone does not implement this system.

## Evidence limits and acceptance

Vendor design guidance is practice guidance, not experimental proof that glass
improves task performance. The studies inform search cues, grouping, density, and
contrast; neither validates this exact product. Pink is a user/brand preference.
Our alpha, blur, radius, and spacing are design choices requiring rendered review.

Acceptance covers desktop/narrow phones; human/free/arena
chess; late-game expert Minefield; drawing/export; Pinball; keyboard focus;
material preference across frames; reduced motion/transparency; forced colors;
and final alpha-composited contrast. Review actual useful content for color,
hierarchy, clipping, and legibility. Gameplay algorithms and fixed evaluation
scales are outside the design migration.

Implementation: [APPLICATION_DESIGN.md](APPLICATION_DESIGN.md).
Live reference: `/design-system`, using the actual shipped tokens and primitives.


## Version 2: personality within a shared engine

The user's November 11 clarification requires individual design solutions for
all apps. A two-family decorative budget is a product constraint, not a threshold
proven by a scientific paper. Each app now has its own GPT-6.1 Sol research pass,
three candidate directions, task-based selection and implementation dossier.

Additional direct sources checked for this revision:

- [GNOME design principles](https://developer.gnome.org/hig/principles.html):
  task focus, progressive disclosure, frequent actions close at hand, considerate
  recovery. We use this to define shared interaction care without copying layouts.
- [GNOME UI styling](https://developer.gnome.org/hig/guidelines/ui-styling.html):
  reuse tested variables/patterns, test custom styling under high contrast, avoid
  color-only information and flashing. Local identities therefore inherit shared
  focus, states and fallbacks instead of reinventing their control behaviors.
- The [Aalto visual-search study](https://research.aalto.fi/en/publications/understanding-visual-search-in-graphical-user-interfaces/)
  was rechecked at its primary record: GUI/cue type and target presence matter.
  Its findings support task-specific hierarchy, not a universal grey interface.

App-level references, what was directly inspected, alternative concepts and
limits are recorded under [app-personalities](app-personalities/). The final
checks evaluate distinct structures and usable tasks as well as cross-app
consistency. Desktop quality is an aspiration validated by interaction review;
this is not a claim of native OS rendering or measured clinical eye comfort.
