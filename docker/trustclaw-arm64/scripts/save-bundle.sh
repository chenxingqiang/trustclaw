#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_TAG="${TRUSTCLAW_APP_IMAGE:-trustclaw-app:arm64}"
OUT="${1:-$DIR/dist/trustclaw-app-arm64.tar}"

mkdir -p "$(dirname "$OUT")"
echo "==> Saving $APP_TAG -> $OUT"
docker save -o "$OUT" "$APP_TAG"
ls -lh "$OUT"
echo "==> Offline load: docker load -i $(basename "$OUT")"
