# Privacy — a considerate permissions card

11 November 2026. Scope: `AnalyticsProvider.tsx` and `analytics.css` only.

## Task and friction

People need to understand optional analytics, make an equally reachable yes/no choice, and change it later without leaving a game. The previous wide banner had a long undifferentiated paragraph, a stronger accept treatment, and no way to defer a choice. Preserve explicit opt-in, storage keys, analytics events, top-level-only rendering and existing accessible button/dialog names.

## Direct references inspected

- [Firefox settings documentation](https://support.mozilla.org/en-US/kb/firefox-options-preferences-and-settings): inspected the Privacy & Security and Permissions and data descriptions, including tracking protection and data collection controls. Useful: recognizable privacy entry point and plain descriptions grouped by data purpose. Unsuitable: importing an entire browser settings hierarchy for one permission. Documentation reviewed directly; no running Firefox settings screen was tested.
- [Plausible data policy](https://plausible.io/data-policy): inspected the “What we collect,” data-point table and browser behavior sections. Useful: concrete data categories and explicit collection boundaries. Unsuitable: copying Plausible's cookieless, no-persistent-identifier or EU infrastructure promises; this app's runtime has an anonymous local identifier and its own relay. This is a content reference, not a claim that Plausible runs here.
- [GNOME HIG dialogs](https://developer.gnome.org/hig/patterns/feedback/dialogs.html): inspected alert/action dialog guidance, button order, specific imperative labels, initial keyboard focus and Escape dismissal. Useful: decline-before-accept ordering and explicit dismissal. Unsuitable: a blocking modal; analytics is optional, so the platform remains usable and no focus trap or scrim is introduced. Initial unsolicited prompt does not steal focus; explicit reopening focuses Close and dismissal returns focus to Privacy.

These are direct source inspections, not usability experiments or evidence of medical comfort.

## Three directions

1. **Permissions card (chosen):** small right-aligned floating panel, a clear data summary, paired equal-size controls and a persistent Privacy entry. Bounded strong frost explains the temporary layer; the data summary has solid backing.
2. **Full privacy sheet:** centered modal with detailed policy sections and a large status overview. Offers more explanation but interrupts play and overstates the complexity of one optional permission.
3. **Minimal consent strip:** one-line message plus actions across the bottom. Leaves more playfield visible but loses the readable shared/excluded explanation and wraps poorly at 320px.

The card trades some phone screen area for an immediately readable choice. A visible close control defers without granting or denying, and Escape works while the card has keyboard focus. A short viewport scrolls the card rather than hiding the decision controls. The taskbar and window controls remain reachable.

## Personality contract

- Character: calm, candid, modest; concise factual copy without “privacy-safe” certification language.
- Palette: pink intent ink/fill/edge, warm white and a small neutral ink/edge ramp. No second decorative hue or domain exceptions.
- Material: one bounded strong-frost floating panel; opaque data summary; 16px outer and 8–10px inner radii. Existing shared solid-material, reduced-transparency and forced-color mechanisms remain authoritative.
- Hierarchy: privacy eyebrow with current on/off/no-choice state, short heading, purpose, shared/excluded definition list, equal-size explicit decisions, device-local choice reminder.
- Signature interaction: defer safely, then return through Privacy; clear 3px keyboard focus. No continuous animation.

## Implementation boundaries

The consent controller, initialization, storage keys, endpoint, identity, event taxonomy and top-level gate are unchanged. Dismissal is ephemeral component UI state: unknown consent stays unknown, so tracking stays off. Accept and decline call the existing consent setter. Existing accessible names are preserved, including Analytics privacy settings, Accept analytics, Decline analytics, Close privacy settings and Privacy.

The checked-in runtime currently posts to `/api/analytics/events`, despite older Mixpanel instructions in AGENTS.md. The UI therefore avoids asserting an SDK, external processor or hosting region. The old “self-hosted” and “privacy-safe” marketing sentence becomes a concrete event/category summary; no new privacy promises are introduced.

## Verification

Automated Playwright against `http://localhost:3131` and screenshots inspected at 1280×800 and 320×800; 390×800 also captured. Panel bounds: desktop 440px wide, 390 phone 374px, 320 phone 304px; no horizontal card overflow. At 320px the card remains above the taskbar with visible Close and both choices; underlying top window controls remain accessible. Close allows immediate return to the underlying content. Checked 320×480 for viewport containment and reachable decline (388px content height); the CSS provides internal scrolling for shorter viewports.

Observed pre-choice silence, Close leaves stored consent absent, reopen works, Escape dismisses, decline stores denied with no events, accept stores granted and produces platform_viewed. Tab after explicit reopen focuses Decline analytics with a 3px outline; dismissal returns focus to Privacy. Persisted solid material gives opaque rgb(255,253,253) backing and no backdrop filter; reduced motion and forced-colors modes were exercised.

Targeted ESLint passed. Seven targeted analytics controller, event-contract and internal-relay unit tests passed. Final integration checks are owned by the coordinator. Screenshots and local scripts live in `/tmp/privacy-personality/`, outside the repository. No production build, SDK change, shared-theme edit, commit or push performed.

Limits: media-query reduced transparency itself was not browser-emulated; the equivalent persisted solid-material path was checked. This is focused UI verification, not a complete accessibility certification, backend privacy audit or full game-session regression run.

## Follow-up: keep page actions clear

The persistent launcher now follows content in normal document flow on internal game and documentation pages. It uses a compact glossy button with ordinary margins, without a persistent toolbar or overlay on Play, board controls or document text. This may add a small amount of document height; it does not shrink game content. The viewport-owned XP desktop and standalone external-game cabinet retain the fixed entry, including the cabinet's existing reserved bottom-strip placement.

Checked the changed source stylesheet by injecting it into the existing production server at `localhost:3132`, without running a concurrent build or dev server. At 320×900, standalone Chess places Privacy below its content (content bottom 1031.5px, entry top 1039.5px), documentation uses normal flow, and the desktop retains fixed placement with a 900px document height. Standalone Pinball retains fixed placement at y862–894 in its reserved strip with a 900px document height (no added scrolling). Opening settings and closing it remains functional. This injection verifies layout behavior; the coordinator must rebuild the production bundle and run the final Chess and Pinball regressions. Local follow-up evidence: `/tmp/privacy-personality/flow-*.png` and `flow-check.cjs`.

## Follow-up: viewport-owned utility footer

The latest app requirement replaces the previous extra document-height allowance. The privacy stylesheet now publishes `--ui-app-height: calc(100svh - 52px)` and `--ui-utility-height: 52px` on the top-level body when its provider renders either the launcher or the consent panel. Viewport-owned app roots consume the height token; a shared fallback keeps embedded apps at full viewport height. The selector excludes the XP desktop and standalone cabinet. Actual embedded frames render neither privacy surface and receive no reservation. The same token applies while settings are open, preventing a layout jump. The compact 32px launcher and its 8px/12px vertical margins occupy the reserved 52px without an added toolbar, overlap or hidden entry point.

Verified live development server `http://localhost:3132` at 320×640 after app roots adopted the token: Chess and Minefield both have app bounds y0–588, Privacy y596–628, and document height640. Opening settings preserves the588px app height, and closing restores launcher access. Desktop remains640px high with fixed Privacy y560–592; Pinball remains640px high with fixed Privacy y602–634 in its reserved strip. No tested page adds document scroll. Screenshots inspected for Chess and normal Minefield; evidence `/tmp/privacy-personality/viewport-*.png`, script `viewport-check.cjs`. No Next build, server launch, commit or push performed. App owners retain responsibility for internal section scrolling and game-control geometry; final integrated production regression belongs to the coordinator.

## Follow-up: committed keyboard focus

Candidate-2 CI exposed intermittent Escape dismissal failure after explicit reopening. The previous animation-frame callbacks could run before React committed the new dialog or launcher, leaving focus on the body. Focus now follows the committed DOM in a layout effect: explicit opening focuses Close, and dismissal returns focus to the rendered Privacy button, including its desktop taskbar portal. The unsolicited optional-consent card still leaves existing focus alone. The heading is now the task name, “Usage analytics,” in accordance with the current experience constitution. Consent storage, initialization and tracking behavior are unchanged.

Added `tests/e2e/privacy-focus.spec.ts`: eight repeated open/Escape/return-focus cycles at the desktop and standalone developer guide, with 4× Chromium CPU throttling and an assertion that denied consent remains unchanged. Targeted ESLint and TypeScript checks passed. This test definition has not yet run against the changed bundle: the existing production server contains candidate 2, and the coordinator owns the frozen candidate-3 rebuild and browser proof. Earlier screenshots above remain historical evidence, not verification of this focus fix.
