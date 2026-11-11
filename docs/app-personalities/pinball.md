# Space Cadet: flight-deck cabinet

11 November 2026. Ownership: platform cabinet only; faithful engine and native table artwork remain unchanged.

## Task and friction

The task hierarchy is start game → hold/release plunger → operate two flippers, with pause, sound and exit always reachable. Table data is occasional setup. Previously the file picker permanently competed with play, all control actions had similar emphasis, and on-screen flippers lacked a keyboard activation path. Preserve local-only import, opt-in persisted audio, real startup stages/elapsed time/retry, responsive native canvas fitting, exit during download, and the outer controller's about:blank/listener-before-navigation boot sequence.

## Direct references inspected

- [SpaceCadetPinball README](https://github.com/k4zmu2a/SpaceCadetPinball) and [maintained options source](https://github.com/k4zmu2a/SpaceCadetPinball/blob/master/SpaceCadetPinball/options.cpp): inspected upstream runtime/data distinction and actual Z, slash, Space, F2 and F3 bindings directly through raw source. Keep the original command vocabulary and full table/score panel. Do not copy bundled Microsoft assets or replace native menus with a speculative score UI.
- [Game Accessibility Guidelines: simple controls](https://gameaccessibilityguidelines.com/ensure-controls-are-as-simple-as-possible-or-provide-a-simpler-alternative/): inspected the guidance and examples about avoiding unnecessary buttons and complex combinations. Three large, labeled cabinet inputs mirror native controls; Enter/Space can hold and release a focused control. No additional gesture mode or hidden combos.
- [W3C: target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): inspected minimum 24px size, spacing exceptions and benefit to people with motor impairments. Main controls retain shared 40px targets; flippers/plunger use 50px minimum and separate key legends. The standard is a floor, not a claim of complete product conformance.

Pinball FX and Playdate help/SDK URLs were attempted but returned HTTP 403 in this environment; they are not claimed as inspected evidence. The three direct references above support the implemented control structure and interaction decisions.

## Three alternatives

1. **Flight-deck cabinet, selected:** slim command strip, graphite native-table surround, large three-button apron and secondary file drawer. Prioritizes original table visibility and precise inputs with little chrome.
2. **Museum restoration bench:** persistent side rail with provenance, detailed original-file setup and keyboard reference beside the table. Strong for archival discovery, but reduces native table area and overweights a rare setup task.
3. **Touch arcade console:** full-width bottom control deck and collapsible top commands, table filling the rest. Strong thumb orientation, but hiding pause/sound/exit behind expansion adds a needless step and changes desktop command habits.

The selected design keeps commands visible and moves optional setup into a native details disclosure. This trades one extra action for importing original files for more stable play space every session. Import automatically opens the drawer so restoration to free play stays discoverable.

## Personality contract and implementation

Character: compact, precise arcade instrument. Palette: a short warm-neutral control ramp, graphite playfield surround and shared pink primary intent; no added decorative chromatic family. Native blue table art and semantic error/progress colors remain domain exceptions. Header uses small monospaced instrument identification with a strong compact title. The playfield has opaque backing; bounded shared frost belongs only to the command strip. Material, contrast, motion and focus behavior continue through shared primitives and persisted appearance handling.

Signature interaction: physically grouped left flipper / hold-to-launch / right flipper controls with separate keycaps and a thicker lower edge. New game receives primary emphasis; pause, audio and exit remain aligned secondary commands. All buttons retain existing IDs, accessible names and selectors. The optional file drawer retains the native picker, local-only notice and free-play restoration. Narrow composition makes the identity one row and commands another, with three equal touch zones below. Native canvas scaling and engine/art remain unchanged.

Only `public/vendor/pinball/runtime.html`, `cabinet.css` and `cabinet.js` change. `controller.js`, outer boot handshake, engine files, data and provenance are untouched. Keyboard activation now holds the same synthetic native key until keyup, blur or pointer cancellation, without letting focus transfer prematurely release it.

## Evidence and limits

Against the coordinator's running server at `http://127.0.0.1:3131`, Chromium loaded the actual WASM table and enabled New game. Checked 1280×844, 390×844 and 320×844: document scroll width equals viewport width in each; native canvas remained wholly visible, including score panel. Screenshots saved to `/tmp/pinball-{1280,390,320}.png`; 390px screenshot inspected visually. No CSS recoloring or crop of native artwork.

Real interactions checked: new game, pause → Resume → Pause, focusable flipper Enter down/up and visible solid focus outline. Reduced-motion emulation was exercised. Material fallback is delegated to the shared primitives; coordinator should run the persisted transparency cross-frame regression. Native aspect ratio intentionally leaves vertical space on portrait phones rather than crop table/score content. This is not a mobile engine redesign.

`node --check public/vendor/pinball/cabinet.js` passed. Coordinator owns the complete `space-cadet.spec.ts` recovery/import/audio/boot-race suite and `application-design.spec.ts`; no root build or shared-file changes were made by this app agent.
