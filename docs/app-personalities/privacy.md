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
