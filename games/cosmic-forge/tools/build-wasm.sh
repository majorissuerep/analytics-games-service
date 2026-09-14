#!/usr/bin/env bash
set -euo pipefail

GAME_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
REPO_ROOT=$(cd "$GAME_ROOT/../.." && pwd)
CACHE_ROOT="$REPO_ROOT/.cache/powder-toy"
SOURCE_ROOT="$CACHE_ROOT/upstream"
BUILD_ROOT="$CACHE_ROOT/build"
EMSDK_ROOT="$CACHE_ROOT/emsdk"
EMS_VERSION=$(node -e "const fs=require('fs'); const lock=JSON.parse(fs.readFileSync(process.argv[1])); process.stdout.write(lock.emscriptenVersion)" "$GAME_ROOT/upstream.lock.json")

node "$GAME_ROOT/tools/fetch-upstream.mjs"

if [[ ! -d "$EMSDK_ROOT/.git" ]]; then
  git clone --depth 1 --branch "$EMS_VERSION" https://github.com/emscripten-core/emsdk.git "$EMSDK_ROOT"
fi
"$EMSDK_ROOT/emsdk" install "$EMS_VERSION"
"$EMSDK_ROOT/emsdk" activate "$EMS_VERSION"
source "$EMSDK_ROOT/emsdk_env.sh"
export COSMIC_FORGE_REAL_EMXX
COSMIC_FORGE_REAL_EMXX=$(command -v em++)
OVERRIDE_CROSS_FILE="$CACHE_ROOT/emscripten-cosmic-forge.ini"
printf "[binaries]\ncpp = ['bash', '%s']\n" "$GAME_ROOT/tools/emxx-wrapper.sh" > "$OVERRIDE_CROSS_FILE"

SETUP_ARGS=(
  "$BUILD_ROOT"
  "$SOURCE_ROOT"
  "--cross-file=$SOURCE_ROOT/.github/emscripten-ghactions.ini"
  "--cross-file=$OVERRIDE_CROSS_FILE"
  "-Dbuildtype=debugoptimized"
  "-Dstatic=prebuilt"
  "-Dhttp=false"
  "-Dignore_updates=true"
  "-Dcan_install=no"
  "-Dresolve_vcs_tag=no"
  "-Dlua=lua5.2"
)

if [[ -f "$BUILD_ROOT/build.ninja" ]]; then
  meson setup --wipe "${SETUP_ARGS[@]}"
else
  meson setup "${SETUP_ARGS[@]}"
fi
meson compile -C "$BUILD_ROOT"

test -f "$BUILD_ROOT/powder.js"
test -f "$BUILD_ROOT/powder.wasm"
git -C "$SOURCE_ROOT" diff --quiet

printf 'Powder Toy WASM built without tracked source changes:\n'
sha256sum "$BUILD_ROOT"/powder.js "$BUILD_ROOT"/powder.wasm
if [[ -f "$BUILD_ROOT/powder.worker.js" ]]; then
  sha256sum "$BUILD_ROOT/powder.worker.js"
fi
