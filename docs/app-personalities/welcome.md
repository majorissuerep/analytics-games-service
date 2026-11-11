# Welcome — the launch concierge

11 November 2026. Scope: WelcomeApp and its local stylesheet. XP window and desktop remain owned by the shell.

## Task and friction

Welcome's task is to get someone into a game with one click. The previous large logo, generic team-game claim and infrastructure explanation competed with three small launch buttons. Color implied unrelated categories without explaining a choice. On narrow windows, the icon consumed space without helping navigation. Preserve real openGame callbacks, coming-soon filtering, the three quick-launch slots, `.welcome-actions` buttons, and developer/design-system links. Do not promise recency or personalization without data.

## Direct research

The following live first-party pages were fetched and read on 11 November 2026; inspection covered their public text, not hands-on use of native products.

- [GNOME Tour](https://apps.gnome.org/Tour/): current app listing calls it a guided tour and greeter; interface presentation establishes one clear welcome context. Borrow the finite, considerate entry point. Reject compulsory onboarding slides: our user can already launch games.
- [Playnite](https://playnite.link/): library manager's unified-game interface, library imports, metadata and fast launch proposition. Borrow named destinations in one shelf independent of integration origin. Reject cover-art walls, library-management controls and account configuration for this tiny front door.
- [Things scheduling / Today](https://culturedcode.com/things/support/articles/2803579/): explicitly curates actionable work in Today while inactive items stay in Upcoming/Someday. Borrow actionable-only grouping and quiet supporting context. Reject task scheduling and fabricated “recent” games.
- [GNOME HIG principles](https://developer.gnome.org/hig/principles.html): frequent actions close at hand, short copy, simple focused views, respect attention. This supports placing resource links after launch actions and keeping descriptive copy brief. It does not prove usability improvements for this implementation.

Read AGENTS.md, APP_PERSONALITY_BRIEF.md, APPLICATION_DESIGN.md, DESIGN_SYSTEM_RESEARCH.md, the original component/CSS, manifest type and application-design selectors. Next.js local linking guidance confirms continued use of Link.

## Three directions and choice

1. Guided greeter: one featured game and stepped desktop tips. Calm but hides alternative launch choices and introduces navigation.
2. Mini library: compact cover grid, per-game metadata and category rails. Scannable at larger sizes, unnecessarily dense here; would lean on heterogeneous art/color.
3. **Launch concierge:** restrained monogram, a compact greeting, one glossy shelf containing three readable launch rows, and a separate resource footer. Selected because all existing launch choices remain visible, names lead, and narrow layouts naturally stack.

Tradeoff: no full catalog or personalization. The desktop already provides the full catalog; the shelf intentionally preserves the original first-three policy.

## Personality contract and implementation

Warm, useful host; one chromatic family (raspberry pink) with warm neutral ink/canvas. Pink marks destination symbols and interaction edges; game captions convey personality without rainbow tiles. The single bounded shelf has a subtle stationary gloss; opaque launch rows carry all dense text. Small monogram and compact heading share a desktop row. At 480px and below they stack; rows wrap titles and captions. Numbered ends supply a quiet shelf rhythm, arrows signal launching. Standard engine focus, pointer and keyboard semantics remain inherited. No new runtime, telemetry, loading, or infrastructure.

Captions: Chess invites a move, Minefield a logical sweep, Pinball another attempt. Other manifests fall back to their real eyebrow. Resource navigation has a named landmark. Empty catalogs show explicit text. No coming-soon game can become a launch button. The app owns only its local tokens and CSS selectors.

## Verification and evidence

Playwright Chromium against **http://localhost:3131**: 1280, 390 and 320px viewport checks; Welcome widths 612/382/312px, with matching scrollWidth (no horizontal overflow). Default desktop window is 401px tall; final measured scrollHeight is also 401px after spacing was tightened, so shelf and resources fit the compact frame. Narrow window has a 787px content viewport and scroll containment. Screenshots inspected at `/tmp/welcome-evidence/1280.png` and `/tmp/welcome-evidence/320.png` (temporary local evidence, not repository artifacts).

Real Minefield shelf click opened a game iframe. All three launch buttons retained explicit accessible names. Keyboard focus computed a solid 3px outline. Reduced-motion emulation introduced no app motion; the app defines no animation. Setting persisted material DOM state `data-ui-material="solid"` gave the shelf `backdrop-filter: none`; media fallbacks also specify opaque backing. Forced-colors has system-color borders and surfaces. Scoped ESLint passed.

Limits: initial screenshots included the platform's first-visit analytics prompt; final screenshots dismissed it using the real Decline control. The shell's Pip overlay can still cover phone footer content until closed; that overlay is outside Welcome ownership. No whole-product contrast or screen-reader certification is claimed. Coordinator runs full platform regressions/builds; this app pass did not modify shared tests or execute a shared build.
