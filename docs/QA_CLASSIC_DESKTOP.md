# Classic desktop QA report

## Scope

Production-build exploratory and automated acceptance testing of Millennium Desktop, all four games, and all four desktop plugins. Tested mouse, keyboard, canvas interaction, window close/restore paths, plugin enable/disable behavior, console errors, and the complete four-player Consensus Radar flow.

## Consolidated findings

| ID | Severity | Area | Finding | Resolution |
|---|---|---|---|---|
| QA-01 | High | Desktop | Game, Plugins, and Build-a-game desktop icons required a mouse double-click. Enter/Space could focus but not launch them, and touch activation was unreliable. | Fixed: explicit Enter/Space launch handlers; browser acceptance added. |
| QA-02 | Medium | Pinball | The original Orbit Pinball implementation was too small and bespoke to qualify as a complete classical game. | Replaced by Neon Forge, an original themed table using Planck.js for robust CCD/joints and repository-authored rules, geometry, rendering, audio, and art direction. |
| QA-03 | Medium | Assets | The photographic `green-horizon.png` had no embedded provenance or license metadata, despite documentation claiming original assets. | Fixed: replaced by repository-authored `millennium-horizon.svg`; provenance and non-derivation are documented. |
| QA-04 | High | Desktop windows | Dragging across iframe content could lose pointer movement; oversized windows also created impossible `react-rnd` bounds, producing dead zones followed by one-frame jumps. | Fixed: drag-time pointer shield plus viewport-aware initial bounds and per-game preferred sizes; continuous-drag and short-viewport regressions added. |
| QA-05 | Medium | Embedded games | Minefield, Paintbox, and Consensus Radar repeated app/title chrome inside the XP-style outer window. | Fixed: embedded launch mode now suppresses redundant branding/title rows while preserving gameplay controls. |
| QA-06 | Medium | Window controls | Clicking a title-bar control could be consumed by the parent drag/focus handler, requiring a second click. | Fixed: controls stop mouse-down propagation before `react-rnd` handles the title bar. |

No Critical defects were found. No unresolved High, Medium, or Low defects remain from this pass.

Final automated acceptance: 8/8 Playwright scenarios passed, including continuous dragging, compact viewport containment, all isolated classics/plugins, and the complete four-player Consensus Radar flow.

## Per-game results

### Consensus Radar

- Played as four isolated browser players through name entry, room creation/join, team and role selection, two rounds per team, clue submission, guessing, reveal, score advancement, and game over.
- Verified localized entry UI, private-role flow, room polling, and desktop close behavior.
- Result: pass; existing functionality preserved.

### Minefield

- Played beginner board from the first safe reveal; verified empty-cell expansion, number rendering, right-click flag/unflag, mine counter, timer, reset, and all three difficulty definitions.
- Model tests cover first-click safety, adjacency, flood reveal, flags, loss, and win.
- Result: pass.

### Pinball

- Original Neon Forge table. Verified shooter-lane feed, 120 Hz fixed-step Planck.js simulation with CCD balls, motorized flippers, keyboard/touch controls, ball save, five-target lock qualification, spinner/ramp cashout, N·E·O·N multiplier lanes, scoop mode, two-ball lock, three-ball multiball, escalating jackpots, nudge/tilt, and real game-over flow.
- Physics engine, table layout, and game model are unit-tested.
- Result: pass after original rewrite.

### Paintbox

- Drew a stroke, verified non-white canvas pixels, selected color, changed tool, undid the stroke, cleared, and checked PNG export availability.
- Verified pointer capture and cancellation behavior and responsive canvas scaling.
- Result: pass.

## Per-plugin results

### Pip Assistant

- Verified animation, non-repeating random tip, Help action, dismissal, readable speech bubble, and no copied Microsoft sprite/audio.
- Result: pass.

### Sticky Note

- Verified editing, browser-local persistence, dismiss action, and desktop overlay placement.
- Result: pass.

### Game Shuffle

- Verified Start-menu placement and random launch against the current typed game catalog.
- Result: pass.

### Game Counter

- Verified installed-game count and immediate hide/show through Plugin Manager.
- Result: pass.

## Visual and copyright boundary

The shell deliberately recreates the late-1990s/early-2000s desktop interaction vocabulary: blue taskbar, green Start control, beveled windows, desktop shortcuts, system tray, and rolling green landscape. It does not use the Windows logo, Bliss photograph, Microsoft system icons/sounds, Space Cadet resources, Minesweeper resources, Paint resources, or Office Assistant sprites. Game names and artwork are original alternatives. Third-party dependencies and reviewed references are listed in `docs/STACK_AND_REFERENCES.md`.

This report is engineering risk reduction, not legal advice.
