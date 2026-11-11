# Game Shuffle — a small act of chance

11 November 2026. Scope: the existing Start-menu plugin, not a windowed app.

## Task and friction

The only task is to launch one playable game without choosing it yourself. The
primary action remains **Surprise me**. Three consequential friction points were
an emoji whose rendering/color varied by platform, misleading “installed” copy
for a web catalog, and an empty disabled row with no explanation. The shell
already filters `coming-soon` games before constructing plugin context; preserve
that eligibility boundary, cryptographic selection and `context.openGame`.

## Direct references inspected

- [Playnite Game Randomiser](https://github.com/Kyerstorm/Playnite-Game-Randomiser):
  fetched the repository's README directly through GitHub's API. Inspected its
  sidebar/menu entry workflow, first-wheel state, installed-game auto-launch
  boundary, and explicit explanation of reroll protection. Useful: distinguish
  eligible games and make blocked actions explain themselves. Unsuitable: wheel
  animation, winner cards, settings and history are disproportionate to this
  one-action menu contribution. This was README inspection, not a running
  Playnite session or a validation of its fairness claims.
- [Steam Labs / Play Next](https://store.steampowered.com/labs/playnext): fetched
  the official page. It currently resolves to the Labs index, where experiment
  008 is marked “Shipped!” and “Now available as a shelf in your Steam client
  library.” Useful: discovery lives near the existing library. Unsuitable: a
  recommendation shelf would add a second selection workflow. The current page
  did not expose the historical experiment screen, and no personalized library
  or recommendation algorithm was inspected. An attempted Steam News URL yielded
  a generic News Hub, so it is not evidence for a specific Play Next screen.
- [GNOME HIG: Menus](https://developer.gnome.org/hig/patterns/controls/menus.html):
  fetched and read menu-item and structure guidance: command verbs, logical
  grouping, important actions near menu edges, and avoiding nested submenus.
  Useful: keep a direct command with a short, explicit explanation. Unsuitable:
  copying GNOME menu appearance or adding a plugin-only access key without a
  shell-level collision policy. Existing HTML button keyboard behavior remains.

These sources inform proportion and interaction; none establishes measured
usability or a reason to reproduce their visual identity.

## Three directions considered

1. **Pocket die command (chosen):** retain the existing two-line native XP row,
   draw a small monochrome five-pip die, explain immediate random launch and the
   empty state. It has a recognizable chance motif without extra interaction.
2. **Recommendation shelf:** preview several candidate games with art and a
   separate launch action. This increases deliberation and needs a new surface;
   it conflicts with the instant-choice task and protected menu composition.
3. **Spinning draw:** animate a roulette or die, announce a winner, then confirm
   launch. It turns a synchronous operation into a wait, adds motion and another
   decision, and burdens keyboard/reduced-motion behavior without useful work.

## Personality contract and XP boundary

Character: concise, playful, immediately useful. Palette: no additional chromatic
family; the icon inherits `currentColor`, including native hover, disabled and
forced-color treatment. Material, typography, row spacing, selection, outline,
separator and menu placement belong entirely to the XP shell. There is no
`app-surface` wrapper because this plugin is itself part of protected Start-menu
chrome, not application content. No new CSS, glass, custom card, popup, animation
or app-level token overrides are warranted. This deliberate limit is the design
solution for a tiny action, not an incomplete application restyle.

The signature is the authored vector die paired with **Surprise me** and **Play a
random available game**. The latter describes the actual launch and eligibility
without suggesting a local installation. Empty state: **No playable games
available**, visibly present in the disabled button's accessible content. Native
`disabled` semantics block activation; the existing handler also safely ignores
an absent selection. `type="button"` makes action semantics explicit. Repeats
remain possible; skipping the last pick would change the selection policy.

## Implementation and verification

Changed only `plugins/game-shuffle/src/index.tsx` and this dossier. Preserved
`crypto.getRandomValues`, score-based selection and `context.openGame(game.id)`.
No telemetry, SDK, catalog or shell modifications.

- ESLint for the plugin passed.
- An isolated temporary TypeScript/React harness rendered empty props, verified
  disabled markup and explanatory content, invoked the empty handler safely,
  supplied deterministic cryptographic scores and verified the selected supplied
  ID reached `openGame`. The harness lives outside the repository.
- Real Chromium at `http://localhost:3131`: focused the Start button and pressed
  Enter, focused Shuffle and pressed Enter. Real Chess, Space Cadet and Paintbox
  windows opened across 1280, 390 and 320px viewports. The inherited dotted native
  focus outline was present; SVG measured 28px square. Reduced motion was enabled.
- Screenshots: `/tmp/shuffle-evidence/menu-1280.png`, `menu-390.png`,
  `menu-320.png`. Inspected the 320px screenshot directly: the die and both lines
  are readable, with visible focus and unchanged native row treatment.
- Found a shared-shell containment problem: long catalog descriptions cause the
  menu grid's content column to expand; Shuffle's inherited row measured 728px
  wide (right edge 781px) even on phones. Reported to coordinator; plugin cannot
  safely repair shell sizing within its ownership. Pointer Start activation in
  the first attempt was intercepted by a Next development portal; keyboard
  activation successfully exercised the real launch path.
- No transparency or animation is introduced, so material/reduced-transparency
  preferences do not alter this plugin's content. Forced colors were not
  separately browser-tested; the SVG uses the same inherited text color and no
  hard-coded fills. No full build or broad suite was run by this app owner.

Integrated shell review constrained Start-menu grid tracks and scrolling to the viewport; the menu row no longer expands to long catalog descriptions. The narrow-menu regression runs against the production build.
