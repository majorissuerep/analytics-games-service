# Stack and references

## Selected stack

| Layer | Choice | Why |
|---|---|---|
| Portal | Next.js 16, React 19, TypeScript | Existing Vercel path, server APIs, dynamic catalog, strong typing |
| Workspaces | npm workspaces + Turborepo | Isolated games/plugins with shared packages and incremental tasks |
| Desktop windows | `react-rnd` | Small MIT React drag/resize primitive; also used by daedalOS |
| Nostalgic controls | `XP.css` | MIT semantic HTML/CSS, framework-neutral; overridden with original branding/assets |
| State | Zustand | Small MIT state layer for windows/taskbar |
| Animation | Motion | Mature MIT React animation system for desktop plugins |
| Validation | Zod | Runtime manifest boundary for external URLs |
| Optional game engine | Phaser 4 | Web-first 2D engine with global/scene plugin architecture |
| External integration | iframe + `postMessage` | Framework/repository independent, browser-native isolation |

## Reviewed references

- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause: reused for legal move generation, FEN/PGN, checkmate, stalemate, and draw detection.
- [Stockfish.js 18](https://github.com/nmrugg/stockfish.js), GPL-3.0: vendored lite single-threaded WASM build for five real computer difficulty profiles. Full provenance and corresponding-source links are in `public/vendor/stockfish/UPSTREAM.md`.
- [react-chessboard](https://github.com/Clariity/react-chessboard), MIT: responsive board, standard piece set, drag-and-drop, animation, and mobile interactions.
- [XP.css](https://github.com/botoxparty/XP.css), MIT: reused dependency for semantic nostalgic controls.
- [98.css](https://github.com/jdan/98.css), MIT: XP.css ancestor and design-system reference.
- [web3point1](https://mythronaut.neocities.org/), public-domain claim: useful Windows 3.1 interaction reference, but source repository is gone; not vendored.
- [daedalOS](https://github.com/DustinBrett/daedalOS), MIT: mature browser desktop reference; informed `react-rnd` window approach, not copied wholesale.
- [Puter](https://github.com/HeyPuter/puter), AGPL: strong remote-app ecosystem reference; too broad for this focused launcher and not embedded.
- [React95](https://github.com/React95/React95), code MIT: evaluated for component/plugin coverage. Not used because repository explicitly excludes Microsoft-associated imagery from its license.
- [Phaser](https://phaser.io/), MIT: recommended optional internal game engine and plugin ecosystem.
- [OS.js](https://github.com/os-js/OS.js), BSD-2-Clause: mature application/package and web-desktop extension reference; not embedded because platform already has a smaller typed shell.
- [JS Paint](https://github.com/1j01/jspaint), MIT: high-quality browser painting reference. Paintbox is original, smaller, browser-local code rather than copied JS Paint UI/assets.
- [Webamp](https://github.com/captbaritone/webamp), MIT: proven embeddable nostalgic application reference; candidate future multimedia plugin, not currently bundled.
- [lrusso/Pinball](https://github.com/lrusso/Pinball), complete Phaser/Box2D browser pinball: runtime vendored at commit `fcf63f97d24467248fe1eaa89adaf273209f3da2`. Upstream declares no license; provenance and separation are documented in `public/vendor/pinball/UPSTREAM.md`.

## Copyright/trademark boundary

Product calls its UI **Millennium Desktop**. It uses no Microsoft names in UI, Windows logo, Bliss wallpaper, system icons, sounds, game resources, or Office Assistant sprites. Background, icons, assistant, game art, and branding are original code/assets. `public/wallpapers/millennium-horizon.svg` is repository-authored vector artwork made only from SVG gradients and paths; it is not derived from a photograph or Microsoft asset. Nostalgic layout and control behavior are inspiration; third-party code retains its license notices.

This is an engineering risk reduction, not legal advice. Public commercial launch should still receive trademark/trade-dress review.
