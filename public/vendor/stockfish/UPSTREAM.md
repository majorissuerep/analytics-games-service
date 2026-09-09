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

# Stockfish 19 browser engine provenance

- Upstream engine: https://github.com/official-stockfish/Stockfish
- Browser/WASM distribution: https://github.com/lichess-org/stockfish-web
- npm package: `@lichess-org/stockfish-web@0.5.0`
- Upstream engine release: Stockfish 19 (`sf_19`, released 2026-06-10)
- Variant: `sf_19_smallnet`, single-threaded browser WebAssembly with the matching `nn-61e7af4bb97d.nnue` network
- License: GNU GPL version 3; the package license text is preserved as `STOCKFISH_WEB_LICENSE.txt`.
- Corresponding source: https://github.com/lichess-org/stockfish-web/tree/main and https://github.com/official-stockfish/Stockfish/tree/sf_19

Vendored byte checksums for the Stockfish 19 build are recorded below.

- `sf_19_smallnet.js`: `114751d6f0c1e98dfedb9eb1928ac86fb763bab2b5282f24e2d7865156abac2e`
- `sf_19_smallnet.wasm`: `7e6629d0e1226a0d20c9c2c71c69dd3dccbe260a25f0053d3e4e5e4acea77fbc`
- `nn-61e7af4bb97d.nnue`: `61e7af4bb97d51eeeb25d322916f86513b5cd3a827ce189c98c6e31946f99e5b`
- `STOCKFISH_WEB_LICENSE.txt`: `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`

The engine worker fetches the NNUE asset from the same-origin static bundle before announcing UCI readiness.
