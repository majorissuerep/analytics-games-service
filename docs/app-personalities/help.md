# Platform Help — pocket field guide

11 November 2026. Ownership: `HelpApp.tsx` and `help-app.css`. XP window controls remain shell-owned.

## Tasks and friction

The first task is finding out how to open, arrange, return to, and close an app. Keyboard instructions and a readable appearance come next. Game integration is a specialist handoff. The old panel inverted that hierarchy: it led with bridge messages, offered no desktop instructions, and had no way to jump among topics. Preserve the material preference, `/develop` and `/design-system` links, and native shell window behavior. Shell source confirms double-click/Enter/Space icon opening, title-bar double-click maximize, minimize/taskbar return and Close; no invented global shortcuts are documented.

## Direct research

Read AGENTS.md, APP_PERSONALITY_BRIEF.md, APPLICATION_DESIGN.md, DESIGN_SYSTEM_RESEARCH.md, Next's installed CSS guide, existing Help/MaterialPreference components, DesktopShell handlers, and application-design/platform browser tests.

- [GNOME Help: Windows and workspaces](https://help.gnome.org/users/gnome-help/stable/shell-windows.html.en), fetched directly: inspected task headings, short topic descriptions, window arrangement and return-to-window guidance. Borrow the everyday task-first vocabulary and compact reference entries. Do not copy GNOME's Activities/workspace shortcuts, which this shell does not implement.
- [Dash User Guide](https://kapeli.com/dash_guide), fetched directly: inspected numbered table of contents, documentation-set instructions, current-page contents and integration section. Borrow a persistent local index and direct section links. Reject the guide's long technical hierarchy and search-profile concepts for a four-topic desktop guide.
- [GNOME HIG: Utility panes](https://developer.gnome.org/hig/patterns/containers/utility-panes.html), fetched directly: inspected guidance distinguishing a subordinate pane from navigation, placement hierarchy and adaptive treatment. Our left rail is navigation; supporting instructions remain in the main view. On narrow content widths the rail becomes an inline two-column index rather than consuming reading width. Do not copy F9 or flap behavior without implementing it.
- [Panic Nova Help](https://help.nova.app/) and [Nova](https://nova.app/) were attempted directly but returned HTTP 403. These are seed references only; no claim of inspecting their onboarding screens or deriving findings from unavailable content.

The three successful sources above include two maintained focused help/documentation tools and authoritative interaction guidance. Findings are design guidance, not measured usability results.

## Three directions

1. **Indexed pocket manual, selected:** numbered topic rail, warm neutral paper, compact definition rows, a corner-shaped reference card. Supports scanning and direct return without hiding content. Cost: more vertical reading than a single-screen launcher.
2. **Question accordion:** a list of common questions with only one answer visible. Compact initial view, but adds opening/closing work and makes keyboard plus appearance information harder to scan together.
3. **Guided first-run walkthrough:** one task per step, large next/back actions and window diagrams. Strong introduction, but repeated visits require unnecessary sequencing and additional state. This is a reference app, not a setup process.

## Personality contract and implementation

Character: concise everyday field guide. One decorative chromatic family, pink, plus a small warm-neutral ramp. Pink marks the numbered index, focus, hover, and developer handoff. Solid paper supports all prose; no glass, decorative motion, shadows on every row, or rainbow categories. Slightly square card spines distinguish this app from rounded dashboards. All selectors and tokens are app-scoped.

Hierarchy: desktop → keyboard → appearance → build a game. Signature interaction: numbered native anchor index with an always-visible left rail at desktop content widths; a compact inline index below 440px. Cards use named actions aligned against concise explanations. Keyboard labels use small physical key shapes. MaterialPreference remains the shared control and saves browser preference. Developer details move behind their existing guide link; no everyday instruction uses bridge jargon. No asynchronous work or new loading state is introduced.

## Verification

Chromium via Playwright at `http://localhost:3131`, real shell, 1280/390/320px viewports. App client/scroll widths respectively 612/612, 382/382, 312/312px: no internal horizontal overflow. Screenshots `/tmp/help-evidence/help-{1280,390,320}.png` captured and desktop/320px inspected visually. Index layout adapts to its content width, text wraps, and the XP chrome remains intact. Pip can overlap the lower Help content on phone; this is an existing shell overlay outside this app's ownership.

- Opened Help through a focused desktop icon with Enter.
- Clicked Appearance index link; measured content scrollTop 666 and target in visible region.
- Checked Reduce transparency; root material and persisted storage both became `solid`; unchecked successfully.
- Tab from Keyboard index reached Appearance with a visible solid outline (screenshot shows pink focus).
- Both route destinations remain exactly `/develop` and `/design-system`.
- Forced-colors plus reduced-motion screenshot captured as `/tmp/help-evidence/help-forced.png`. This app uses opaque surfaces and no transitions/animations, so reduced transparency/motion do not require a separate visual treatment; material choice still propagates via shared control.
- Scoped ESLint passed for HelpApp.tsx.

Scope limits: no full release build or cross-app regression suite run by this app agent; coordinator owns integration checks. Links were inspected for destinations; their target pages are outside Help ownership. No claims of native OS rendering or whole-product accessibility certification.
