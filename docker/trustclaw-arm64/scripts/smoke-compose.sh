#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

if [[ ! -f app.env ]]; then
  cp app.env.example app.env
  echo "Created app.env from example."
fi

if [[ ! -f app.env.dev ]]; then
  cp app.env.dev.example app.env.dev
  echo "Created app.env.dev from example — edit ANTHROPIC_API_KEY before chat tests."
fi

if ! docker image inspect trustclaw-app:arm64 >/dev/null 2>&1; then
  echo "Image trustclaw-app:arm64 not found. Run: ./scripts/build-arm64.sh"
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
else
  COMPOSE=(docker-compose)
fi

"${COMPOSE[@]}" up -d --wait
PORT="$(grep -E '^APP_PORT=' app.env 2>/dev/null | cut -d= -f2- || echo 8080)"
PORT="${PORT:-8080}"
UI_PORT="$(grep -E '^TRUSTCLAW_UI_PORT=' app.env 2>/dev/null | cut -d= -f2- || echo 15174)"
UI_PORT="${UI_PORT:-15174}"

echo "==> Health check http://127.0.0.1:${PORT}/healthz"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null; then
    echo "healthz OK"
    break
  fi
  sleep 2
done

if ! curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null; then
  echo "Health check failed"
  "${COMPOSE[@]}" logs --tail=80
  exit 1
fi

echo "==> PTDS Console http://127.0.0.1:${UI_PORT}/trustclaw/"
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${UI_PORT}/trustclaw/" >/dev/null; then
    echo "trustclaw UI OK"
    "${COMPOSE[@]}" ps
    exit 0
  fi
  sleep 2
done

echo "TrustClaw UI check failed (is trustclaw:ui:build included in image?)"
"${COMPOSE[@]}" logs --tail=80
exit 1
