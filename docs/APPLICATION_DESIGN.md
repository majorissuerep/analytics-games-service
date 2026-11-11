# One application language inside the XP desktop

The desktop is an XP shell. Application content uses a restrained functional
language derived from Minefield: soft blue backgrounds, warm ivory panels, sage
insets, teal actions, readable labels, small corner radii, quiet boundaries, and
purposeful color. Keep the palette visibly colored and subdued. The window frame
communicates where an app begins; the content communicates what to do.

## Ownership

`public/styles/app-theme.css` owns the shared tokens and `app-surface` primitives.
Next.js imports it through `app/globals.css`. Static pinball links the same asset.
The Cosmic Forge workbench assembler copies it from the same source, and its
server serves CSS with the correct MIME type. The developer guide includes an
integration example for independently hosted games.

Apply `app-surface` to application content, not to the entire desktop or window
wrapper. The desktop wallpaper, icons, Start menu, taskbar, title bars, close /
minimize / maximize buttons, and outer window borders retain XP styling. Pip's
chat header remains an XP-style boundary; its conversation and controls share
the application theme.

## Visual rules

- Use `--ui-canvas`, `--ui-surface`, `--ui-raised`, and `--ui-recessed` for visual
  hierarchy. Flat fills and one-pixel boundaries replace glass, bevels, neon,
  decorative gradients, and large shadows.
- Use `--ui-font` for interface text and `--ui-mono` for numbers, codes, and move
  history. Default body text is 14px with a 1.5 line height. Supporting text should
  remain readable; avoid using tiny text to establish hierarchy.
- Use the 4 / 8 / 12 / 16 / 24 / 32px spacing scale and 4 / 6px radii. Keep labels
  close to their controls and group related decisions into quiet panels.
- Use the teal accent for primary actions and selected controls. Selected state
  also has a border or structural cue. Keyboard focus uses a visible 3px outline.
- Reserve positive, warning, and negative colors for meaning, with text or shape
  alongside hue. Preserve paint colors, team identities, stable chess evaluation
  colors, and essential playfield graphics; a shared UI is not a monochrome game.
- Chess piece buttons and board geometry are excluded from generic application
  control sizing and disabled opacity. Minefield cells and paint swatches keep
  their own geometry and use explicit focus/selection treatment.
- Avoid continuous decorative motion. Progress indicators may move while work
  is pending; reduced-motion preferences suppress that movement.

## Coverage

| Surface | Shared treatment |
| --- | --- |
| Chess and model arena | Neutral setup panels, common controls and fonts, quiet board surrounds, shared board palette |
| Consensus Radar | Neutral room/lobby/leaderboard panels, readable team colors, subdued gauge, static identity mark |
| Minefield | Shared surface/type/focus tokens; distinct covered, revealed, and flagged states |
| Paintbox | Flat tool rail, common actions, neutral canvas surround, labeled tools, original drawing colors |
| Pinball | Shared cabinet controls, stage surround, and loading state; playable table artwork retained |
| Cosmic Forge workbench | Shared header, status, page surface, and error treatment; simulation rendering retained |
| Welcome, Help, Plugins | Shared content typography, surfaces, and controls inside XP windows |
| Sticky Note and Pip | Readable note/conversation surfaces and common controls |
| Privacy and developer guide | Shared forms, surfaces, documentation hierarchy and focus |

Third-party cross-origin content cannot be restyled by the host. `/develop`
provides the same public stylesheet and `app-surface` contract so authors can
adopt the language in their own deployment. No bridge protocol changes are needed.

## Validation

`tests/e2e/application-design.spec.ts` checks all built-in app roots at 1280px and
390px, confirms the XP/app boundary, checks notes/chat/system panels, and verifies
visible keyboard focus and the primary action treatment. The gameplay suite
continues to cover four-player rooms, chess human/arena/free modes, full expert
Minefield deduction, drawing/export, and pinball sound/exit controls. Screenshots
are captured for visual review; color contrast and state cues are reviewed on the
rendered pages rather than inferred solely from token names.
