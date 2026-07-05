#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONTAINER="${TRUSTCLAW_CONTAINER:-trustclaw-arm64-app-1}"
STATE_ROOT="${TRUSTCLAW_STATE_PULL_DIR:-$DIR/runtime-state}"
REMOTE_STATE="/home/node/.openclaw"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container not found: $CONTAINER" >&2
  exit 1
fi

if [[ ! -d "$STATE_ROOT/state" ]]; then
  echo "Missing $STATE_ROOT — run ./scripts/pull-container-state.sh first" >&2
  exit 1
fi

echo "==> Push PTDS DB + merged packs + audit (overwrites container volume)"
docker cp "$STATE_ROOT/state/local_ptds.db" "$CONTAINER:$REMOTE_STATE/state/local_ptds.db"
docker cp "$STATE_ROOT/state/trustclaw-agents-merged/." "$CONTAINER:$REMOTE_STATE/state/trustclaw-agents-merged/"
docker cp "$STATE_ROOT/state/ptds-audit/." "$CONTAINER:$REMOTE_STATE/state/ptds-audit/"

if [[ -d "$STATE_ROOT/workspace/domain-agents" ]]; then
  echo "==> Push workspace domain-agents registry"
  docker cp "$STATE_ROOT/workspace/domain-agents/." "$CONTAINER:$REMOTE_STATE/workspace/domain-agents/"
fi

if [[ -d "$STATE_ROOT/workspace/trustclaw-agents" ]]; then
  echo "==> Push workspace trustclaw-agents"
  docker cp "$STATE_ROOT/workspace/trustclaw-agents/." "$CONTAINER:$REMOTE_STATE/workspace/trustclaw-agents/"
fi

if [[ -d "$STATE_ROOT/npm" ]]; then
  echo "==> Push npm plugin installs"
  docker cp "$STATE_ROOT/npm/." "$CONTAINER:$REMOTE_STATE/npm/"
fi

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  echo "==> Restart gateway"
  docker restart "$CONTAINER" >/dev/null
fi

echo "==> Done. openclaw.json is NOT overwritten (use volume backup or manual merge)."
