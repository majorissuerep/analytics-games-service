# Space Cadet cabinet provenance

The native engine is alula/SpaceCadetPinball source commit
`0bc12d3ca97a30a61e1e325cfde1eeec379bb9b9`, MIT, compiled locally with
Emscripten 3.1.74. It implements the Space Cadet physics and rules.
`scripts/space-cadet-cabinet.patch` removes all native menus/dialogs, renders
only the physical table, sends live native score/ball/pause/mission state to the
cabinet, fixes the renderer's height for the 470-pixel table, binds horizontal
arrows to flippers, and disables nudging and obsolete setup shortcuts.
The artwork owns the full palette, including formerly reserved system slots.

Aster is original procedural Python artwork dedicated under CC0: navy enamel,
restrained flight markings, rose flippers, cyan native lamp/bumper states,
blue steel fixtures and white chrome balls. All 318 bitmap records are regenerated. Bitmap masks and bounds,
depth maps, collision geometry and game rules are preserved. Source and output
DAT files, previews and notes are in `art/`; generator:
`scripts/generate-pinball-art.py`. The starting geometry and synthesized sounds
are from andrewnakas/open-cadet commit
`4ae332be705f86bfb62f8d8ac1dc1f11918977dd`, CC0-1.0. No Microsoft artwork,
sounds, executable or MIDI is shipped. Keep LICENSE-engine.txt, LICENSE-data.txt,
NOTICE-data.md and THIRD_PARTY_NOTICES.md with redistribution.

The cabinet is ready to play, with no file picker, import controller or runtime
settings menu. It starts a single-player game, displays native score and ball
above the table, and provides restart, pause, sound and responsive touch inputs.
Keyboard: hold/release Space to launch, left/right arrows for flippers. Vertical
arrows do nothing and cannot scroll. The outer platform supplies XP window chrome.

Verify shipped checksums: `node scripts/vendor-space-cadet.mjs --verify`.
Check deterministic art: `python scripts/generate-pinball-art.py --check`
(requires Pillow and NumPy). Rebuild runtime: activate Emscripten 3.1.74, install
CMake, then `node scripts/vendor-space-cadet.mjs`. This fetches the pinned MIT
source and verified CC0 sounds, applies the checked-in patch, and embeds the
checked-in artwork. Emscripten's package UUID can vary between builds, so rebuilds
require artifact hash review; art generation is byte deterministic.

References: https://github.com/alula/SpaceCadetPinball,
https://github.com/andrewnakas/open-cadet, https://github.com/libsdl-org/SDL,
https://github.com/libsdl-org/SDL_mixer, https://github.com/ocornut/imgui.

11 November 2026 visual revision: the renderer draws original
`ASTER-BACKING.BGRA` below the native masked table texture. Index zero remains
exactly zero; zero sprite color retains the backing while its native depth write
remains unchanged. Texture alpha blending composes this background material.
No native physics, collision/depth records or DAT sprite masks changed. The
full JS/WASM/preload package was rebuilt to include the new original backing.
