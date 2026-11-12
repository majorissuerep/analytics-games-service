# Pip — the desktop concierge

11 November 2026. Scope: the Paperclip Assistant plugin only. XP chat header and original paperclip image remain intact.

## Task and friction

Pip helps someone ask a game/repository question, follow an answer, and recover when a provider stalls. The initial conversation must explain its purpose without an extra onboarding step. Three consequential problems in the old implementation were truncated, horizontally scrolling suggested questions; continuous smooth scrolling that pulled someone away from earlier messages; and an icon-only composer without an explanation of Enter versus Shift+Enter. Failed requests also discarded the submitted draft. The existing SSE protocol, model indicator, ZDR label, 14-day retention disclosure, bounded request, cancellation, blocked response and tool progress must survive.

## Direct reference inspection

Sources were fetched directly on the research date, rather than inferred from an inspiration gallery. HTML/text and source inspection informed workflow; this is not a claim of hands-on use of the native products.

| Source | Inspected and useful | Not adopted |
| --- | --- | --- |
| [Raycast AI](https://www.raycast.com/core-features/ai) | Current Quick AI, AI Commands, contextual suggested tasks, model and privacy sections. Specific task prompts lower the burden of starting; the assistant can remain a compact utility. | Projects, agent schedules, integrations, model chooser and marketing claims would exceed this app's actual capabilities. |
| [Signal Desktop composition implementation](https://github.com/signalapp/Signal-Desktop/blob/main/ts/components/CompositionArea.dom.tsx) | Current `canSend`, send handlers, input focus handling and composition controls. Keep the draft central, gate submission on usable input, preserve a stable send action and intentional focus. | Attachment, polls, stickers and rich-media controls add irrelevant density. Pip has no Signal encryption guarantees. |
| [GNOME dialogs](https://developer.gnome.org/hig/patterns/feedback/dialogs.html) | Initial keyboard focus, Escape cancellation, specific action verbs, and preference for inline recovery over interrupting error dialogs. | GNOME modal-dialog requirement is inappropriate for an existing nonmodal desktop helper; the desktop stays usable. |
| [Signal linked devices](https://support.signal.org/hc/en-us/articles/360007320551-Manage-Desktop-Preferences) | The endpoint currently resolves to Linked Devices. Its explicit privacy explanation reinforces keeping Pip's real retention statement visible. | This redirected page is not evidence for Signal's message layout. |
| [Panic Prompt](https://panic.com/prompt/) | Attempted direct fetch returned HTTP 403. | No design finding is claimed from this inaccessible reference. |

Shared Prism documentation, its research, local AGENTS instructions, Next.js CSS guidance, plugin source, and relevant existing browser tests were read before implementation.

## Three alternatives

1. **Command drawer:** small input-first panel with compact command rows and an expandable answer. Efficient for repeat requests, but too terse for learning game rules and reading a streamed conversation.
2. **Correspondence desk — selected:** warm opaque paper, editorial concierge introduction, asymmetric message corners, rose outgoing notes and a fixed writing area. Complete starter questions are visible initially, then fold into a disclosure after the first turn. Better for a short helpful exchange; costs some vertical space and therefore needs a short-height fallback.
3. **Technical field notebook:** monospaced transcript with a tool activity ledger and dense prompt strip. Suits repository inspection, but makes a friendly game helper feel like a debugging console and overemphasizes tools over answers.

## Personality contract

Character: personal, reassuring, concise correspondence. Decorative budget: one rose/pink family, with warm neutral paper/ink; completed tool green and blocked/error amber/red have explicit semantic meanings. XP blue/red chrome is retained shell styling, outside the content palette. Material: stable opaque reading/writing surfaces; no unnecessary glass in dense text. Hierarchy: XP identity, concierge context, conversation, optional starters, composer, retention disclosure. Signature interaction: starters populate the draft for review rather than auto-send; the user decides when to send. No continuous animation or blinking cursor. Ordinary interface roles inherit Prism.

## Implementation

`plugins/paperclip-assistant/src/pip.css` scopes content tokens and selectors to Pip. Message shape, sender hierarchy, vertically readable starter questions, a collapsible starter disclosure and an explicit Send action make this a small correspondence utility. The textarea explains keyboard behavior and respects IME composition. Escape closes chat and returns focus to its launcher. Drafts return after errors/cancellation without overwriting text already being composed. Streaming follows the bottom only while the reader remains near it; scrolling up preserves their place. Shared LoadingState still provides real stage/elapsed feedback and Stop response. Tool results wrap within a bounded excerpt. Failed open tools move to an error state. SSE JSON parsing no longer swallows errors thrown by valid provider events.

The legacy ancestor drop-shadow established a containing block for the fixed chat, putting it at x=0 on narrow screens. Removing that filter on the plugin aside restores viewport positioning; scoped paper and window shadows still express the actual surfaces. No shared shell or backend files changed. The XP header markup/styles and paperclip image remain.

## Verification and evidence

- Direct Chromium/Playwright check on **http://localhost:3131** (the working hydrated host).
- Screenshots captured and visually inspected at 1280×900, 390×844 and 320×844: `/tmp/pip-evidence/desktop.png`, `answer.png`, `390.png`, `320.png`. At 390 and 320 the chat fits between x=8 and viewport−8; its scroll width equals client width. Full question labels, sender distinction, tool result and composer remain legible. Earlier messages intentionally scroll inside the transcript.
- Mocked SSE metadata, streamed delta, done, tool start/end rendered an answer and completed tool. Mocked blocked state displayed “Request blocked”; HTTP 503 restored “keep this draft” and exposed an inline alert. No live provider credential or backend change was needed.
- Initial textarea focus and Escape focus restoration checked in the browser. Reduced-motion screenshot `/tmp/pip-evidence/reduced.png`; transcript uses immediate scroll and no cursor/character loop. All new content surfaces are opaque, so reduced-transparency preferences do not change their reading contrast. Shared material behavior remains for other apps.
- Focus outline is rose against paper; primary #a32660/white and #352d32/paper text pairings preserve strong contrast. Forced-colors CSS uses system surfaces/edges and focus. This is a targeted review, not whole-product accessibility certification.
- Targeted ESLint passes. Existing mocked chat and stalled-response cancellation Playwright regressions both passed (2/2, 22.3 seconds). No build or commit is performed by this app worker.

Limitations: native product screenshots were not inspected; direct reference pages/source supplied the workflow evidence. Panic was inaccessible. Live model latency, provider privacy policy and output quality were not evaluated. Full platform tests and shared stylesheet integration belong to the coordinator.

### Mobile integration refinement

At 320/390px the idle full tip covered useful lower content in other apps. It now becomes a single 106×44px **Talk to me** launcher, positioned in the desktop strip beside Privacy. The tip, surprise/help buttons and original character remain part of the desktop layout but are hidden on phone widths. Opening chat hides the launcher; closing restores focus after the launcher becomes visible. The full conversation still opens only on explicit action. Desktop tip layout and XP header are unchanged.

Verified against the actual Welcome and Minefield windows at both widths, with screenshots `/tmp/pip-evidence/launcher-welcome-390.png`, `launcher-welcome-320.png`, `launcher-minefield-390.png`, and `launcher-minefield-320.png`. Visually inspected Welcome's resource footer and Minefield's board/instructions: neither is covered by a persistent tip. The launcher and Privacy remain independently usable. At 390 the chat fits x=8–382; at 320 x=8–312. Both widths open the composer and return keyboard focus to the launcher on Escape. The mobile launcher rule uses an app-owned attribute for sufficient specificity against legacy desktop positioning.

### Workspace clearance correction (11 November 2026)

The acceptance hit-test found the desktop tip covering Chess's lower-right Leave
game action when maximized. The earlier phone-only compact launcher still occupied
application space. Pip now yields all decorative guide elements whenever any game
window is visible (including a game behind another window). A permanent, labelled
Pip button lives in a reserved XP taskbar slot. Explicitly opening it retains the
full useful chat, provider feedback and draft; Escape returns focus to the taskbar
when a game owns the workspace. Minimizing all games restores desktop tips. Phones
use taskbar access exclusively. This is actual application behavior, not a capture
or test override. The optional plugin-context field lets other desktop plugins
make the same considerate choice without depending on a shell store.

For this correction, directly downloaded and visually inspected the official
[elementary desktop screenshot](https://elementary.io/images/screenshots/desktop.jpg)
and [Zorin OS 18 desktop overview](https://assets.zorincdn.com/zorin.com/images/home/hero/18.png).
Both reserve system access in a panel/dock outside the application content; their
menus appear through explicit invocation. Adopted that spatial distinction while
preserving the existing XP taskbar bevels, restrained blue launcher gloss and Pip's
warm paper conversation. Rejected copying either desktop's icons/skin. Compared
three fixes: repositioning the tip merely moves the collision; automatic chat
opening interrupts play; selected desktop-only decoration plus persistent taskbar
access preserves both app controls and deliberate help.

`tests/e2e/pip-clearance.spec.ts` checks actual requested/maximized Chess and
390/320px viewports, embedding-document hit-tests of Leave game/New game, explicit
chat access, composer focus, Escape restoration and desktop-tip return on minimize.
Evidence and final test result are reported to the coordinator, who owns frozen
candidate and production acceptance; this local correction alone is not promotion.
