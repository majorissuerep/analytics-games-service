# Sticky Note — the paper scratchpad

11 November 2026. Scope: the desktop overlay only. XP chrome, application windows,
plugin settings and the <=760px desktop overlay hiding policy remain shell-owned.

## Task and friction

The task is to capture a short thought while using the desktop, return to it after
a reload, and dismiss it without deleting its contents. The existing component
already has the correct one-note scope and local-storage key. Its three main
frictions were (1) no indication whether editing had actually persisted, (2) a
storage exception could interrupt typing without useful recovery, and (3) a
generic inset form field obscured the note's role as an immediately editable
scratchpad. Preserve the textarea accessible name, local-only content, storage
key, synchronous save per change, hide behavior and default-enabled plugin.

Read: AGENTS.md, APP_PERSONALITY_BRIEF.md, APPLICATION_DESIGN.md,
DESIGN_SYSTEM_RESEARCH.md, existing source, desktop CSS and relevant
application-design checks. Also checked the installed Next CSS guide before
adding the app-owned stylesheet import.

## Direct references inspected

Sources were opened through web retrieval; observations below concern published
documentation and product descriptions, not hands-on usability studies.

| Source | Inspected / useful pattern | Unsuitable for this scope |
| --- | --- | --- |
| [Apple Stickies user guide](https://support.apple.com/en-lamr/guide/stickies/welcome/mac) | Create-a-note and view-notes workflows: immediate text entry, automatic save, independent desktop presence. This supports an always-editable body and quiet persistence feedback. | Rich formatting, attachments, multiple notes, translucent text and window arranging would add infrastructure or obscure content. |
| [Tot official product page](https://tot.rocks/) | Single-window scope, simple editing and the explicit “less is more” product model. A scratchpad can have strong identity without a full document toolbar. | Its multi-device sync, rich text, multiple color slots, backups and smart bullets are outside this local single-note plugin. No claims of Tot-like syncing here. |
| [GNOME Sticky official repository](https://github.com/vixalien/sticky) | README and app description identify a focused GTK4 sticky-note tool. Useful confirmation of the independent note rather than document-manager model; no detailed screenshot claims inferred from the sparse README. | Do not recreate GTK chrome or assume its runtime features from the README. |
| [GNOME HIG principles](https://developer.gnome.org/hig/principles.html) | “Make it Simple”, “Reduce User Effort”, and “Be Considerate”: one situation, automatic routine work, short text and recovery. | Platform-specific UI chrome is not appropriate inside an XP desktop overlay. |

The suggested `apps.gnome.org/Paper/` reference was unavailable. Search surfaced
GNOME **Papers**, a document viewer, rather than a verified Paper note app; it was
not used as note-design evidence. Apple’s unlocalized URL returned a rate-limit
error; the direct localized official guide above was successfully inspected.

## Three directions and decision

1. **Paper scratchpad (chosen).** A small warm opaque writing sheet, compact
   header with a pink binding edge, and an unobtrusive persistence footer.
   Editing opens a pink perimeter around the writing area. This prioritizes
   capture and leaves most of the surface to the actual note.
2. **Tot-style text utility.** Flat white mini-editor, compact word/character
   metrics and a monochrome toolbar. More useful for longer text processing, but
   metrics and a toolbar spend too much of this tiny overlay on secondary tasks.
3. **Collapsed reminder strip.** First-line preview with an explicit expand
   action, then a larger editing panel. Keeps the desktop quieter but imposes an
   extra action before the plugin's primary task and requires new sizing state.

The chosen tradeoff is a fixed compact overlay with native vertical textarea
resizing, rather than new drag/resize/window infrastructure. It keeps browser
editing semantics and native undo. No formatting or deletion controls were added.

## Personality contract and implementation

- Character: a useful desk scrap, composed and immediate rather than playful.
- Palette: pink intent/binding/selection; a warm low-chroma paper family; dark
  warm neutral ink. No decorative success green or extra category hues.
- Material: opaque cream writing area, slightly deeper warm header, one short
  lift shadow and one asymmetrical sheet corner. No blur, texture imagery,
  animation, copied art or translucent text.
- Typography: shared Segoe UI/system sans, 17px title, 15px/1.65 writing body,
  compact support text. The small scratchpad label provides a distinct heading
  rhythm without imposing a second display font.
- Signature interaction: immediate editing with an explicit 3px pink outline;
  footer changes to “Editing · saved in this browser”. The saved wording means
  this browser's local storage, not an account, backup or cross-device service.
- Failure: local-storage reads/writes are guarded. Failed writes retain the draft
  in React state, explain “Not saved. Keep this tab open.” and expose Retry save.
  A successful retry clears the error. No note contents leave the browser.
- Containment: 264px nominal width, bounded by parent width; vertical writing
  resize is capped to viewport height. At <=760px the existing overlay hiding
  policy remains explicit, avoiding obstruction of full-window phone apps.
- Accessibility: existing landmark, textbox and hide accessible names remain;
  footer is associated with the textbox and is a polite status. Native selection,
  keyboard editing and undo remain. Hide target is 40px (44px coarse pointer).
  Forced colors use system surfaces/ink/focus. The surface is always opaque and
  has no transitions, so reduced transparency and motion need no material change.

All rules are scoped to `.app-surface.sticky-note-plugin`. The imported
`plugins/sticky-note/src/sticky-note.css` fully replaces sticky-note selectors
previously in `components/desktop/desktop.css`; the coordinator owns their removal.

## Verification and limits

- Workspace TypeScript check passes; targeted ESLint with `--max-warnings=0`
  passes after removing one stale suppression.
- Chromium/Playwright against `http://localhost:3131`, 1280×900: actual textarea
  input stored the complete multiline text under the unchanged storage key.
  Inspected the cropped editing screenshot at `/tmp/sticky-note-editing.png`:
  clear hierarchy, readable paper body, clean focused perimeter, no clipped text.
  Default screenshot: `/tmp/sticky-note-desktop.png`.
- Hide removed the note from the DOM; reloading showed the note again. At 390
  and 320px it was hidden as intended and document width did not overflow.
  Screenshots: `/tmp/sticky-note-390.png`, `/tmp/sticky-note-320.png`.
- Focus computed as a 3px outline; textarea retained Segoe UI. Forced-colors
  plus reduced-motion screenshot captured at `/tmp/sticky-note-forced.png`;
  outline remained 3px. No animated or translucent material exists to disable.
- Reload persistence passed with a value assertion that waits for after-mount
  hydration. Empty-string persistence passed. An injected storage write exception
  retained the draft and displayed Retry save; restoring storage and clicking
  Retry save persisted that same draft across reload. The error screenshot
  `/tmp/sticky-note-error.png` was inspected: the message and retry control remain
  legible without obscuring the writing area. The persisted solid material
  setting retained the opaque `rgb(255, 249, 237)` writing backing; reduced-motion
  screenshot: `/tmp/sticky-note-solid.png`. A transient shared-server HTTP 500
  interrupted the first attempt; the rerun passed after the server recovered.
- No production build, commit, push, global stylesheet edit or telemetry change.
  No whole-product accessibility certification or measured usability claim.
