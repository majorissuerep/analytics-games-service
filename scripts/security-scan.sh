#!/usr/bin/env bash
set -euo pipefail

for command_name in docker gitleaks trivy uvx; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "[security] Missing required command: $command_name" >&2
    exit 1
  fi
done

echo "[security] ESLint and security rules"
npm run lint

echo "[security] npm dependency audit"
npm run audit:dependencies

echo "[security] Secret scan"
gitleaks detect --source . --no-banner --redact

echo "[security] Dependency, secret, and infrastructure scan"
trivy fs \
  --scanners vuln,secret,misconfig \
  --severity HIGH,CRITICAL \
  --ignore-unfixed \
  --exit-code 1 \
  .

echo "[security] GitHub Actions security scan"
docker run --rm -v "$PWD:/repo" -w /repo \
  rhysd/actionlint@sha256:b1934ee5f1c509618f2508e6eb47ee0d3520686341fec936f3b79331f9315667 \
  -color
uvx --from zizmor==1.27.0 zizmor .github/workflows --persona pedantic
