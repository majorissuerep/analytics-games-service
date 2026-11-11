# Developer guide — indexed integration manual

11 November 2026. Scope: `/develop`, `app/develop/**` only.

## Task and friction

The reader needs to host a browser game, connect the bridge, register its strict
manifest, then adopt app styling. They need to return directly to a step later.
The old marketing hero delayed the contract; four differently colored overview
cards competed with the actual integration instructions; code and registration
had no task anchors or explicit relationship to authentication and validation.
Preserve external origin/bridge v1 semantics, registration requirements, game
instructions, shared theme URL, internal/external distinction and repository
references. No registration request is made by this page.

Read AGENTS.md, APPLICATION_DESIGN.md, APP_PERSONALITY_BRIEF.md,
DESIGN_SYSTEM_RESEARCH.md, route/CSS, SDK source, strict manifest schema,
registration route and design browser tests. Read the installed Next server/client
component guide; the page stays a static Server Component with native anchors.

## Direct sources inspected

- [Dash official user guide](https://kapeli.com/dash_guide): fetched and read the
  numbered section index, docset search profiles/keywords, current-page TOC and
  integration scheme sections. Adopt a persistent desktop contents rail with
  explicit task numbering. Do not copy global shortcuts or search profiles:
  this guide has only four tasks and no documentation corpus to search.
- [Stripe API reference](https://docs.stripe.com/api): fetched/read the rendered
  reference content, Introduction, Authentication and Errors, including adjacent
  authenticated request snippets and resource navigation. Adopt explicit endpoint
  treatment and nearby authorization/response details. Avoid its very large
  resource navigation and personalized executable examples; there is no safe
  client-side administrator registration workflow here.
- [DevDocs official README](https://github.com/freeCodeCamp/devdocs/blob/main/README.md)
  ([raw source](https://raw.githubusercontent.com/freeCodeCamp/devdocs/main/README.md)):
  read the app summary, linked contents, Quick Start, commands and installation
  structure. Adopt task-first navigation and a compact technical reading surface.
  The hosted help URL returned HTTP 403, so no claim of inspecting the live app
  interaction is made. Search/offline installation are inappropriate additions
  to a short static integration guide.
- [W3C Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html):
  directly fetched/read keyboard focus guidance. Preserve shared focus outlines,
  provide a skip link and make overflow code keyboard-focusable. This is guidance,
  not a claim of whole-product accessibility certification.

These are observed source patterns, not measured usability results.

## Three directions and choice

1. **Indexed technical manual (chosen):** compact frosted navigation rail, one
   continuous editorial reading column, numbered sections and stable code wells.
   Supports both first-time sequence and returning directly to a contract.
2. **Split code workbench:** permanent prose/code columns and message lifecycle
   diagram. Strong for comparison, but would waste width for host/registration
   steps and force substantial rearrangement at 320px.
3. **Guided integration checklist:** sequential panels with completion toggles.
   Helps a one-time setup but invents persistence/state and misleading completion
   signals without inspecting a developer's game. Rejected as speculative UX.

## Personality contract

Character: precise, restrained, browsable technical manual; no marketing cards.
Palette: warm off-white, white code, graphite type and small grey ramp; pink is
its sole decorative family for task numbers, endpoint method, navigation and
links. No extra syntax rainbow. Semantic game content remains a domain exception.
Material: a single bounded frosted task index; code and references have stable
opaque backing. Shared material preference removes transparency. Hierarchy:
compact platform header → task index/title → numbered steps → reference rows and
code. Signature interaction: native anchor navigation with scroll margin, sticky
on desktop and an inline compact index on phones. Code preserves whitespace and
scrolls inside its own region. Shared focus and reduced-motion engine remain.

## Implementation

Replaced four decorative cards with a real ordered contents index and sections.
Scoped every platform header rule to `.developer-shell` so this route cannot
restyle another app. Preserved all main navigation links on narrow phones.
Added HTTPS/origin and runtime reference rows, explicit registration endpoint,
actual authorization/validation/response facts from source, and server-side token
handling. The code example now installs its listener before readiness and checks
source, origin, protocol and version; exit is inside a leave-handler example,
not run immediately after readiness. No runtime/API/schema change was made.
Updated Prism prose to shared accessibility/interaction behavior, local scoped
`--ui-*` overrides, two decorative families maximum and semantic exceptions.

## Verification

- `npx eslint app/develop/page.tsx --max-warnings=0` passed.
- Playwright Chromium against `http://localhost:3131/develop`: 1280, 390 and 320px
  document widths equal viewport widths; all four index targets exist.
- Narrow code client/scroll widths: 390px viewport, 324px/558px bridge and
  324px/709px theme; 320px viewport, 254px/558px and 254px/709px. Long lines remain
  inside independently scrollable code, with no page overflow.
- Clicked bridge task: location `#bridge`, section top ~24px. Tabbed navigation
  and explicitly focused code: solid visible focus outlines. Shared home,
  `/design-system` and `/#games` hrefs preserved; no POST request issued.
- Persisted `data-ui-material=solid`: index white `rgb(255,255,255)`, filter `none`.
  Reduced-motion emulation matched and shared fallback is retained; page adds no
  animations. Forced-colors and reduced-transparency CSS inspected.
- Visually inspected full-page 390px and desktop screenshots at
  `/tmp/developer-guide-390.png` and `/tmp/developer-guide-desktop.png`; 320px
  screenshot captured at `/tmp/developer-guide-320.png`. Initial mobile capture
  includes the existing consent prompt; desktop capture follows declining it.
- No builds or global test run in this isolated app pass; coordinator runs shared
  application design and integration checks. No live external registration or
  cross-origin host handshake attempted; their server/SDK contracts were read.
