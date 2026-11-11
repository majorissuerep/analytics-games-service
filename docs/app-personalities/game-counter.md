# Game Counter: quiet inventory mark

Research and implementation: 11 November 2026. Scope: the `session-meter`
tray plugin, which reports installed playable games. Its package name is historical;
it does not measure play time. XP owns its surrounding tray, colors, type size,
spacing, background and responsive policy. No Prism surface is attached to chrome.

## Task and friction

The primary task is reading the installed count at a glance. The only control is
the existing Game Counter checkbox in Plugins. `DesktopShell` supplies
`playableGames.length`, filtering `status === 'coming-soon'` out of that list.
There is no asynchronous work, loading state, timer, or plugin-specific window.

Three consequential issues in the previous emoji-plus-number rendering:

1. Platform emoji rendering introduces variable color, shape and baseline into
   an otherwise tightly constrained native-style tray.
2. Proportional digits and unreserved number space make the inventory mark less
   stable as the count changes. The value now uses tabular figures and a two-digit
   minimum width; larger counts grow naturally rather than truncating data.
3. The terse number does not explain what is counted. Its accessible name now
   handles zero and singular correctly, and a separate accessible description
   explains that upcoming games are excluded. A native title supplies the same
   supplementary explanation for pointer users; essential meaning is in the name.

## Direct references inspected

These are primary maintained guidance or implementation sources, fetched and
read directly. This was a source/code inspection, not a usability study or a
claim of rendering those desktop applications locally.

| Reference and inspected section | Useful pattern | Rejected transfer |
| --- | --- | --- |
| [Apple HIG: The menu bar, Menu bar extras](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar.md#menu-bar-extras) | Small symbols adapt to the system bar's ink; users choose whether extras are shown; secondary status must tolerate being hidden. | macOS 24pt sizing, SF Symbols and click menus are platform specifics. This read-only XP inventory has no menu actions to expose. |
| [KDE KStatusNotifierItem maintained API source](https://github.com/KDE/kstatusnotifieritem/blob/master/src/kstatusnotifieritem.h), class introduction, `ItemStatus`, tooltip API | The host owns actual tray representation. Theme-compatible symbols and separate descriptive titles support compact indicators. Passive information need not request attention. | No animated attention icon, urgency colors, embedded widgets or added context menu for a static inventory. |
| [KDE Dolphin maintained statusbar implementation](https://github.com/KDE/dolphin/blob/master/src/statusbar/dolphinstatusbar.cpp), constructor, `updateWidthToContent`, `updateLabelText` | Plain status text has explicit accessibility support; compact text and controls share stable geometry; extra information belongs in distinct status roles. This focused desktop utility is a useful inventory/status analogue. | Its selectable status text, zoom controls, space information and progress controls would turn a single count into an unnecessary dashboard. |
| [GNOME HIG: Tooltips](https://developer.gnome.org/hig/patterns/feedback/tooltips.html), When to Use | Supplementary content can explain otherwise terse UI, but essential information cannot depend on hover, especially on touch. | No custom floating tooltip, additional keyboard stop, or hover-only essential definition. |

Initial guessed KDE documentation URLs and Apple's former `menu-bar-extras`
URL returned 404. Those pages are not evidence; the current Apple menu-bar
document and maintained KDE source files above were successfully inspected.

## Three directions and decision

1. **Quiet inventory mark — chosen.** A small original outline controller in
   inherited tray ink plus a stable tabular count. Name and description carry
   precise inventory meaning. This is the smallest useful intervention within
   protected chrome and needs no additional interaction.
2. **Explicit text register.** Replace the glyph with “Games: 4”. Clear visible
   semantics, but significantly wider text competes with the clock and other tray
   entries. A normal app toolbar could support this; this tray should stay compact.
3. **Expandable inventory summary.** Click the mark to open a list/card with
   installed and upcoming totals. This changes a passive indicator into a new
   navigation surface, duplicates existing Library/Plugins responsibilities and
   adds unsupported state. A pink floating card or extra window would also breach
   the protected-chrome brief. Rejected rather than implemented speculatively.

## Personality contract and implementation

- Character: precise, unobtrusive inventory punctuation.
- Palette: no app decorative chromatic family. Inherit native tray ink, including
  system colors under forced colors. No pink patch, badge backing or color meaning.
- Material: the existing XP tray only; no glass, shadows, opaque card or animation.
- Hierarchy: readable controller silhouette, then a right-aligned number. The
  two-digit minimum reserves a modest numeric field without changing parent tray
  dimensions, gaps or mobile policy. This is a minimum, not a capped total.
- Interaction: existing Plugins checkbox shows/hides the entire mark. The status
  itself stays passive and out of the tab order; no fake action or timer.
- States: `0` / “No games installed”; `1` / “1 game installed”; plural names
  retain the tested exact “4 games installed”. The description says installed
  games are available to play and upcoming entries are not counted.
- Accessibility: original SVG is hidden from assistive technology, parent has an
  image role and explicit name, and `useId` connects a hidden explanatory string
  with `aria-describedby`. Numbers are not redundantly spoken. No color-only cue.

Only `plugins/session-meter/src/index.tsx` changes. The host's data filter,
telemetry, enabled-plugin persistence and shared desktop CSS remain untouched.

## Verification and limits

Checked with local Chromium/Playwright against `http://localhost:3131`:

- At 1280×900, the exact “4 games installed” mark is visible; its inherited ink
  is `rgb(255, 255, 255)`, value uses `tabular-nums`, and its bounds are approximately
  29×16.5px. Visually inspected the actual tray screenshot at
  `/tmp/game-counter-check/tray.png`: small white controller/count aligns with
  neighboring tray items and clock without a new surface.
- Opened Plugins, unchecked Game Counter and verified the mark disappeared,
  checked it and verified it returned. Checkbox accepts keyboard focus.
- At both 390px and 320px, the existing shell policy hides the tray mark and keeps
  the clock visible. This plugin provides no essential action that becomes lost.
- With reduced motion, forced colors and the persisted opaque-material root
  attribute, the mark stays visible; computed animation/filter are `none` and ink
  becomes the system black. It has no material or motion of its own.
- Server rendering of the actual component passed name checks for 0, 1, 4 and 12.
  The zero/singular states were simulated component inputs, not claimed as a real
  catalog installation flow. The live default catalog remains four playable games.
- Plugin TypeScript check and targeted ESLint pass. Existing tests' count selector
  is retained. The coordinator owns full-platform/e2e release checks.

No user study, operating-system native rendering, or whole-platform accessibility
certification is claimed. No screenshots of the external references were rendered
locally. Scope is deliberately proportional to a passive single-value plugin.
