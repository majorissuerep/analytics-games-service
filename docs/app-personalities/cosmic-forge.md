# Cosmic Forge — instrument bench

11 November 2026. Scope: experimental development workbench only; no catalog exposure.

## Task and friction

Primary task: open a selected evaluation and inspect its native Powder Toy scene.
Secondary: understand which body was projected and the local scale contract.
Recovery: identify a failed boot and retry without obscuring unrelated context.
The old single-line status combined identity, scale and readiness; metadata was
absent until ready; shrinking the entire native canvas made its tools tiny on phones.
Keep real readiness callback, stage/elapsed progress, error/retry, FS scene mounting,
evaluation query selection and native input/controls intact. No engine changes.

## Direct references inspected

- [Stellarium official interface/features](https://stellarium.org/): retrieved homepage
  descriptions of keyboard control, coordinate grids, time/zoom controls and labelled
  astronomy views. Its viewport-first task hierarchy informs the main inspection area.
  Do not adopt twinkling or hidden icon-only controls. Also inspected the
  [developer architecture](https://stellarium.org/doc/24.0/) describing its viewport,
  GUI and action separation. This is documentation inspection, not a running-app trial.
- [Celestia official feature workflow](https://celestiaproject.space/): retrieved
  point-and-goto navigation, exponential zoom and object catalog descriptions.
  Keep the selected object and scale explicit. Do not imply seamless zoom here:
  this workbench deliberately projects between independent scales.
- [W3C Reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html):
  retrieved 320 CSS pixel requirement and the exception for meaningful two-dimensional
  content. Metadata reflows; native simulation has its own scroll region, avoiding
  a horizontally scrolling document. This does not establish full conformance.

ParaView documentation requests returned 403/404 and were not used as evidence.

## Alternatives and decision

1. **Planetarium overlay:** fullscreen scene with floating metadata. Strong immersion,
   but overlays would cover native Powder Toy tools and obscure inspection.
2. **Notebook:** stacked evaluation summary, large explanatory sections and scene.
   Clear teaching sequence, but moves the actual scientific task below prose.
3. **Instrument bench, selected:** compact manifest rail, persistent stage strip and
   independent native viewport. Less immersive; better separation of scale contract,
   current runtime state and native controls. The rail becomes a two-column manifest
   above the viewport on phones.

## Personality contract and implementation

Precise, quiet, explicitly experimental. Warm paper/graphite neutral ramp; pink
alone for intent/loading/recovery (one decorative chromatic family). Native scene
material colors are essential domain content and remain untouched. Header is the
only bounded glass layer; manifest and scientific content have opaque backing.
Squared 6–8px instrument edges, mono units, compact labels and stable dividers
replace the generic large pill status. Shared stylesheet still supplies all control,
focus, progress, motion/transparency and forced-colors behavior.

Evaluation name, focus body ID, projection, meters/cell and domain dimensions come
from the existing validated manifest, never duplicated fixtures. Status stays scoped
above the simulation. A labelled, keyboard-focusable viewport contains native-sized
canvas scrolling on narrow screens; native controls are not rescaled into tiny targets.
Error and retry remain accessible before runtime readiness. No simulation controls,
content assets, build pipeline, native engine or public catalog were changed.

## Verification and limits

- `node --check games/cosmic-forge/runtime/runtime.js` passed.
- Existing assembly completed; generated cache only.
- Chromium at 1280/390/320: document width equalled viewport at each size; error
  viewport had no internal accidental overflow. Screenshot inspection at 320 exposed
  loading margin overflow, corrected using auto width and a compact solid panel.
- Real missing-engine error (`/tpt/powder.js` unavailable on the supplied 4178 static
  server), retry reload and unknown evaluation recovery were exercised successfully.
- Keyboard Tab reached the viewport with a visible solid focus outline. Reduced
  motion/material preference preview was captured; shared engine owns fallbacks.
- Explicitly mocked engine readiness exercised existing callback at all widths:
  canvas retained 612px width, contained within viewport; status showed real manifest
  scale and inspection-ready text. This is layout/callback evidence, not physics proof.
- Evidence under `/tmp/cosmic-evidence/`: `error-{1280,390,320}.png`,
  `mock-ready-{1280,390,320}.png`, `reduced-320.png`.

Actual WASM rendering, native interactions and contrast over actual scene content
remain coordinator verification: no compiled engine was available on this server.
No clinical eye-safety or user-performance claim is made.
