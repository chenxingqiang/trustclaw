#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
CONTAINER="${TRUSTCLAW_CONTAINER:-trustclaw-arm64-app-1}"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container not found: $CONTAINER" >&2
  exit 1
fi

cd "$ROOT"

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  echo "==> Build TrustClaw UI"
  node scripts/trustclaw-ui.js build
  echo "==> Build extension bundles"
  node scripts/tsdown-build.mjs
fi

echo "==> Push plugin bundle"
docker cp "$ROOT/dist/extensions/trustclaw-ptds/index.js" "$CONTAINER:/app/dist/extensions/trustclaw-ptds/index.js"

echo "==> Push TrustClaw UI"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/dist/extensions/trustclaw-ptds/dist/ui/"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/dist/extensions/dist/ui/"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/trustclaw/ui/dist/"

echo "==> Push trustclaw ptds + runtime sources"
docker cp "$ROOT/trustclaw/ptds/." "$CONTAINER:/app/trustclaw/ptds/"
docker cp "$ROOT/trustclaw/runtime/." "$CONTAINER:/app/trustclaw/runtime/"

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  echo "==> Restart gateway"
  docker restart "$CONTAINER" >/dev/null
fi

echo "==> Done. Hard-refresh http://127.0.0.1:\${APP_PORT:-8080}/trustclaw/"
