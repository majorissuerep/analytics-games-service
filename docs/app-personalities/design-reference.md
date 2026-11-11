# Prism reference — material and specimen lab

11 November 2026. Scope: `/design-system`; no shared engine or gameplay changes.

## Task and friction

The visitor needs to understand what is shared, try real control states, then
see how app composition can differ. The previous session dashboard suggested a
uniform appearance, four tone cards implied a required rainbow, and equal app
cards hid structural differences. Keep DemoControls behavior, its exact action
labels, material preference persistence and `.prism-material-sample` intact.

## Direct sources

Fetched and inspected primary HTML/text on 11 November 2026, rather than a
secondary gallery. Source websites were not subjected to usability testing.

- [Radix Themes playground](https://www.radix-ui.com/themes/playground): inspected
  select variants including placeholder/disabled, segmented control sizes and
  radius variants, tables and typography specimens. Adopt bounded examples and
  label the role being demonstrated. Reject its exhaustive all-colors/all-sizes
  matrix for our introductory reference; that would imply compulsory palettes.
- [Storybook: writing stories](https://storybook.js.org/docs/writing-stories):
  inspected component/story parameters, decorator context, and empty versus
  populated composed stories. Adopt isolated, repeatable interaction states with
  enough surrounding context. Reject adding a Storybook runtime or controls
  infrastructure: the shipped demo already exercises real primitives.
- [GNOME HIG principles](https://developer.gnome.org/hig/principles.html): inspected
  Design for People and task-focused principles plus navigation to keyboard,
  scaling and accessibility guidance. Adopt a clear reading sequence and useful
  controls close to their explanation. Do not reproduce GNOME chrome or imply
  native-platform certification.

## Three directions

1. **Token atlas:** dense swatches, numeric tables and a left contents rail.
   Strong lookup speed for implementers; weak introduction to app personality,
   and the rail consumes narrow-screen space.
2. **Material/specimen lab (selected):** a concise contract, two paired tone
   specimens, a material comparison, working states, and structural miniatures.
   Communicates rules separately from composition and retains useful live demos.
   Tradeoff: a longer page than an index; section anchors support quick return.
3. **App gallery:** large side-by-side application screenshots with annotations.
   Strong first impression of individuality, but screenshots become stale and
   reveal little about focus, loading, disabled or accessible fallback states.

## Personality contract and implementation

Character: precise, welcoming documentation bench. Pink is intent; violet is
annotation/optional reference identity. Cool near-white, grey and ink form the
neutral ramp. Positive/info/warning/failure colors appear only in explicitly
labelled semantic examples. Decorative budget: two families. No continuous
animation. Frost is a bounded material sample and control surface; documentation
and specimen content use stable backing. Corners are mostly 8/12/16px.

The opening contract distinguishes engine ownership, app ownership and domain
meaning. Two tone cards replace four compulsory category swatches. Three static,
lightweight illustrations demonstrate chess board plus ledger, paint tools around
canvas, and Minefield counters plus dense board. Every specimen says Illustration,
links to its real app, and avoids live engines/iframes. Miniatures are hidden from
assistive technology because their captions and links carry the information.

DemoControls remains unchanged: selection, text field, primary/secondary/disabled
actions, progress/cancel, completion and reset. The material checkbox retains its
existing persistence. Type/spacing and reduced-motion/focus explanation stay next
to the real controls. This page demonstrates shared care, not shared layouts.

## Verification

- Playwright against `http://localhost:3131/design-system`: 1280, 390 and 320px
  document widths exactly match viewport widths; screenshots saved under
  `/tmp/design-reference-*.png`. Visually inspected the 390px full-page screenshot.
- Analysis sets `aria-pressed=true`; Preview exposes a progressbar; Cancel works;
  a second Preview completes; Reset clears completion. No DemoControls edits.
- Material preference produces white backing and `backdrop-filter:none`.
- Reduced motion plus forced colors: keyboard Tab from Preview to Reset keeps
  solid focus outline and effectively zero transition (`0.00001s`).
- Tone cards retain paired computed colors: pink ink `rgb(144,32,94)` on
  `rgb(255,240,247)` and violet ink `rgb(96,69,178)` on `rgb(238,232,251)`.
  Shared tests must expect two distinct tone cards instead of four; coordinator
  notified. No shared tests edited by this app owner.
- Scoped ESLint passed for page and DemoControls. No build or commit performed.
  Cross-app material propagation/full release suite belongs to integration.

Integrated review darkened the reference page’s muted ink to `#4f4b5c`: it reaches 4.72:1 against the shared 76%-white glass composited over black, while retaining the violet-neutral ramp.
