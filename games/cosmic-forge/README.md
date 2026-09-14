# Cosmic Forge development workbench

This is a development setup, not the game.

It proves one two-scale content loop:

1. model stars and planets as small, independent universe assets;
2. connect them with a system asset;
3. select a body through an evaluation asset;
4. load that evaluation's Lua scene into an unmodified Powder Toy WASM build.

The universe view and Powder Toy do not share one physics grid. An evaluation is an explicit projection from a huge-scale body into a bounded local material lab. Its `metersPerCell` value records the scale loss.

## Asset boundaries

```text
content/
  bodies/<id>/body.json                    one star, planet, or moon
  systems/<id>/system.json                 stable references to body IDs
  evaluations/<id>/evaluation.json         projection and scale contract
  evaluations/<id>/scene.lua               Powder Toy scene for that projection
```

Each directory owns one versioned asset. References use stable IDs, not relative imports. `tools/validate-content.mjs` rejects missing bodies, broken systems, invalid orbital values, unsafe script paths, and invalid scales.

The first fixture is deliberately small:

- `forge-star`: star data;
- `cinder`: rocky planet data;
- `first-light`: system and orbit data;
- `cinder-material-lab`: a paused Powder Toy cross-section with a lava core, stone mantle, iron crust, oxygen layer, and radial gravity.

## Development loop

Run from the repository root:

```text
node games/cosmic-forge/tools/validate-content.mjs
node games/cosmic-forge/tools/assemble-runtime.mjs
bash games/cosmic-forge/tools/build-wasm.sh
node games/cosmic-forge/tools/serve.mjs
```

Open:

```text
http://127.0.0.1:4177/?evaluation=cinder-material-lab
```

Run the self-contained browser proof after a build:

```text
npm --workspace @analytics-games/cosmic-forge-dev run verify:workbench
```

It starts an isolated development server, boots the selected scene in software-rendered Chromium, checks cross-origin isolation and Emscripten FS mounting, measures rendered pixel diversity, and writes a canvas screenshot under `.cache/powder-toy/`.

The first engine build downloads the pinned Emscripten SDK and Powder Toy dependencies. Generated source, toolchains, build files, and runtime bundles stay under `.cache/powder-toy/`.

## Iterating on one asset

Change only the owning directory. Then run validation and assembly again. The generated `content-index.json` carries a SHA-256 hash for every metadata file and scene script, so a review can identify the exact changed asset.

Examples:

- change planet mass: edit `content/bodies/cinder/body.json`;
- change its orbit: edit `content/systems/first-light/system.json`;
- change local scale: edit `content/evaluations/cinder-material-lab/evaluation.json`;
- change the material experiment: edit `content/evaluations/cinder-material-lab/scene.lua`.

No step edits the Powder Toy source tree. `upstream.lock.json` pins the exact commit, Emscripten version, and empty patch set.

The development server watches `content/` and `runtime/`. A valid save refreshes the assembled runtime; reload the browser to see it. An invalid save prints the validation error and keeps serving the last valid runtime.

## Current limit

This setup does not yet implement visual zoom, orbital simulation, save conversion, or bidirectional state transfer. The first proof is narrower: a validated global asset selects and boots one real local engine scene. We add those systems only after this loop works end to end.
