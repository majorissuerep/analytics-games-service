#!/usr/bin/env bash
set -euo pipefail

if [[ -z ${COSMIC_FORGE_REAL_EMXX-} ]]; then
  printf 'COSMIC_FORGE_REAL_EMXX is not set\n' >&2
  exit 1
fi

linking=true
for argument in "$@"; do
  case "$argument" in
    -c|-E|-S)
      linking=false
      break
      ;;
  esac
done

if [[ $linking == true ]]; then
  exec "$COSMIC_FORGE_REAL_EMXX" "$@" -s EXPORTED_RUNTIME_METHODS=ccall,cwrap,FS
fi
exec "$COSMIC_FORGE_REAL_EMXX" "$@"
