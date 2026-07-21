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

- [XP.css](https://github.com/botoxparty/XP.css), MIT: reused dependency for semantic nostalgic controls.
- [98.css](https://github.com/jdan/98.css), MIT: XP.css ancestor and design-system reference.
- [web3point1](https://mythronaut.neocities.org/), public-domain claim: useful Windows 3.1 interaction reference, but source repository is gone; not vendored.
- [daedalOS](https://github.com/DustinBrett/daedalOS), MIT: mature browser desktop reference; informed `react-rnd` window approach, not copied wholesale.
- [Puter](https://github.com/HeyPuter/puter), AGPL: strong remote-app ecosystem reference; too broad for this focused launcher and not embedded.
- [React95](https://github.com/React95/React95), code MIT: evaluated for component/plugin coverage. Not used because repository explicitly excludes Microsoft-associated imagery from its license.
- [Phaser](https://phaser.io/), MIT: recommended optional internal game engine and plugin ecosystem.

## Copyright/trademark boundary

Product calls its UI **Millennium Desktop**. It uses no Microsoft names in UI, Windows logo, Bliss wallpaper, system icons, sounds, or Office Assistant sprites. Background, icons, assistant, and branding are original code/assets. Nostalgic layout and control behavior are inspiration; third-party code retains its license notices.

This is an engineering risk reduction, not legal advice. Public commercial launch should still receive trademark/trade-dress review.
