# Stockfish 18 browser engine provenance

- Upstream engine: https://github.com/official-stockfish/Stockfish
- Browser/WASM distribution: https://github.com/nmrugg/stockfish.js
- npm package: `stockfish@18.0.8`
- Upstream engine release: Stockfish 18 (`v18.0.0`, released 2026-01-31)
- Variant: lite, single-threaded WebAssembly (recommended by upstream for browser UX without cross-origin isolation)
- License: GNU GPL version 3; complete license text is preserved as `COPYING.txt`.
- Corresponding source: https://github.com/nmrugg/stockfish.js/tree/v18.0.0 and https://github.com/official-stockfish/Stockfish/tree/sf_18

Vendored byte checksums:

- `stockfish-18-lite-single.js`: `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391`
- `stockfish-18-lite-single.wasm`: `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1`
- `COPYING.txt`: `0b383d5a63da644f628d99c33976ea6487ed89aaa59f0b3257992deac1171e6b`

The engine runs in a dedicated browser Web Worker and communicates through the standard UCI protocol. Difficulty changes use Stockfish's `Skill Level` option plus bounded per-move search time. No engine source modifications were made.
