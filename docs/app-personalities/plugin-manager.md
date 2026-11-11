# Plugin Manager — considered preferences

11 November 2026. Scope: Plugin Manager content only; XP window, persistence and plugin runtime remain shell-owned.

## Task and friction

The task is choosing which of four installed desktop extras should appear. The previous interface gave build-time implementation details priority, used three unrelated row hues, and offered no overview or written enabled state. Users should scan names/descriptions, change one setting, and immediately understand its effect. Preserve registry IDs, versions, checkbox semantics, existing `.plugin-row` and heading selectors, and the `setPlugin` callback. Installation, updates and new settings are outside this app's capabilities.

## Direct reference research

Inspected direct maintained sources on 11 November 2026:

- [GNOME Extensions](https://apps.gnome.org/Extensions/): official application listing, current release information, Main Window / Available Updates / Search View screen inventory and management description. Adopt a focused installed-extension utility rather than a marketplace. Do not imply updates, removal or preferences that our runtime cannot provide. Source page inspected; screenshots listed there were not separately visually inspected.
- [Obsidian core plugins](https://github.com/obsidianmd/obsidian-help/blob/master/en/Plugins/Core%20plugins.md) and [community plugin controls](https://github.com/obsidianmd/obsidian-help/blob/master/en/Extending%20Obsidian/Community%20plugins.md): read maintained raw help files after help.obsidian.md returned HTTP 403. Core plugins are included but may be disabled; community documentation distinguishes installed from enabled and explicitly describes toggling without uninstalling. Adopt that distinction and concise one-sentence descriptions. Omit their search, author/funding and management icons for this four-item registry.
- [Firefox Add-ons disabling workflow](https://support.mozilla.org/en-US/kb/disable-or-remove-add-ons): inspected enable/disable instructions, including persistent list placement, colored enabled toggle and separation of disabling from removal. Adopt stationary rows and reversible toggles, with written state alongside pink. Avoid their separate overflow removal action because removal is not supported here.
- [GNOME HIG switches](https://developer.gnome.org/hig/patterns/controls/switches.html): inspected binary feature guidance, noun labels, target size and unavailable-state advice. Immediate binary features fit a switch shape; native checkbox semantics are retained for keyboard and existing tests. There are no asynchronous or unavailable states in the current props contract.

These are design precedents, not measured evidence of this interface's usability.

## Three directions and decision

1. **Boxed preferences ledger (selected):** a compact summary cap over one stable list. Name and explanation occupy the left; aligned toggle and written state occupy the right. Calm neutral material and clear separators suit four independent settings and fit narrow windows.
2. **Desktop anatomy:** preview desktop with annotated overlay/tray/Start locations, settings beneath. Better spatial explanation, but consumes scarce window height and duplicates desktop artwork for a small task.
3. **Enabled / disabled shelves:** two sections with large utility cards. Strong state overview, but toggling would move the target and make rapid comparison harder. More surface area than these settings require.

The ledger sacrifices a visual desktop preview in exchange for stable control locations and readable descriptions.

## Personality contract and implementation

Character: quiet, purposeful preferences console. One chromatic family: dark pink for enabled intent, enabled count and focus. Neutral ramp is warm charcoal, muted grey-green ink, white list, light grey canvas. No category coloring or semantic exceptions. Stable opaque content requires no transparency fallback; no decorative motion or glow.

A small uppercase context label sits above the retained heading. A bounded summary reports enabled count and immediate application. Rows expose name, description, subordinate version and explicit Enabled/Disabled text. Pink toggle fill and knob position reinforce state. Whole-row labels increase the click area while accessible checkbox names remain concise; descriptions use `aria-describedby`. The count is a polite status region. A footer explains browser persistence and installed-versus-disabled behavior. Pip's internal implementation description is replaced with its useful desktop task. Scoped styles explicitly defeat legacy XP label typography and inherited decorative canvas image.

## Verification

- Component ESLint passes (`npx eslint components/desktop/apps/PluginManagerApp.tsx --max-warnings=0`).
- Playwright Chromium against `http://localhost:3131`: Game Counter unchecked removes tray counter, checked restores it; unchecked state survives reload; enabled summary changes to 3 of 4. Sticky Note, Pip Assistant and Game Shuffle checkbox off/on interactions pass.
- Keyboard focus produces a visible 3px pink row outline. Accessible checkbox roles and names retained. Forced-colors emulation restores `appearance: auto`.
- 1280px desktop and constrained 390/320 viewport screenshots inspected. At narrow sizes the content root was deliberately constrained to 374/304px to exercise the app independently of desktop window sizing; scrollWidth equals clientWidth (374/374 and 304/304). Header and summary wrap, descriptions remain legible, controls remain aligned. XP window mobile layout is coordinator-owned. Pip's independent overlay may cover the bottom of screenshots.
- Reduced-motion emulation suppresses useful-duration knob transition (computed 0.00001s shared reduced-motion override). All materials are opaque, so reduced-transparency preferences do not change legibility or depend on backdrop support.
- Evidence: `/tmp/plugin-manager-evidence/desktop.png`, `390.png`, `320.png`. Visual review caught and corrected XP label-font inheritance and a shared canvas-image wash before final captures.

Full application/regression suite and final shell-level checks are coordinator-owned; no build, commit or push performed.
