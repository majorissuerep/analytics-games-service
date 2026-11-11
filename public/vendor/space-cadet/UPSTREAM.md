# Space Cadet runtime provenance

Engine: alula/SpaceCadetPinball, gh-pages commit
`a93547299a2ed7bd602630c0be3a43648e25a886`, MIT. This is the WebAssembly
port of k4zmu2a/SpaceCadetPinball, the reverse-engineered Space Cadet engine.
The WASM binary is unchanged. Only the generated JavaScript preload manifest is
replaced with offsets for our freely licensed data package.

Game data: andrewnakas/open-cadet at
`4ae332be705f86bfb62f8d8ac1dc1f11918977dd`, CC0-1.0. See LICENSE-data.txt and
NOTICE-data.md. This is a newly drawn neon-space table and synthesized sounds,
using the Space Cadet geometry, rules, and file format. It is not Microsoft's
original artwork. No Microsoft PINBALL.DAT, bitmap, MIDI, WAV, or executable is
redistributed here. The MIT engine and its SDL/ImGui dependencies are independent
of that proprietary game-data license; keep the corresponding license notices.

Original XP appearance: the cabinet can read a player's own PINBALL.DAT and
sounds in browser memory, then restart only the runtime with those files.
Those bytes are never uploaded or persisted. Only data filenames are accepted;
EXE, DLL, script files, paths, and oversized selections are rejected.

Inspect `provenance.json` for source revisions and SHA-256 values. Reproduce
with `node scripts/vendor-space-cadet.mjs`; verify with the same command and
`--verify`. This downloads the pinned MIT runtime and CC0 assets, never the
upstream package containing original Microsoft resources.

The platform-owned cabinet is in `/vendor/pinball`; its styles, local file
controller, touch controls, loading/recovery states and exit bridge are separate
from the vendored engine. Native in-canvas menus are preserved.

References:
- https://github.com/k4zmu2a/SpaceCadetPinball
- https://github.com/alula/SpaceCadetPinball
- https://github.com/andrewnakas/open-cadet
- https://github.com/libsdl-org/SDL (zlib license)
- https://github.com/libsdl-org/SDL_mixer (zlib license; codec notices apply)
- https://github.com/ocornut/imgui (MIT)
