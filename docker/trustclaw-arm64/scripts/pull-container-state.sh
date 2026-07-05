#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$DIR/../.." && pwd)"
CONTAINER="${TRUSTCLAW_CONTAINER:-trustclaw-arm64-app-1}"
STATE_ROOT="${TRUSTCLAW_STATE_PULL_DIR:-$DIR/runtime-state}"
REMOTE_STATE="/home/node/.openclaw"
SEEDS_DIR="$ROOT/trustclaw/ptds/seeds/domain-agents"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Container not found: $CONTAINER" >&2
  exit 1
fi

mkdir -p "$STATE_ROOT"/{state,workspace,npm}

echo "==> Pull openclaw.json (secrets redacted)"
docker cp "$CONTAINER:$REMOTE_STATE/openclaw.json" "$STATE_ROOT/openclaw.json.raw"
node - "$STATE_ROOT/openclaw.json.raw" "$STATE_ROOT/openclaw.json" <<'NODE'
import { readFileSync, writeFileSync } from "node:fs";
const [rawPath, outPath] = process.argv.slice(2);
const config = JSON.parse(readFileSync(rawPath, "utf8"));
if (config.env && typeof config.env === "object") {
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "OPENAI_API_KEY"]) {
    if (typeof config.env[key] === "string" && config.env[key].trim()) {
      config.env[key] = "REDACTED";
    }
  }
}
if (config.gateway?.auth?.token) {
  config.gateway.auth.token = "REDACTED";
}
writeFileSync(outPath, `${JSON.stringify(config, null, 2)}\n`);
NODE
rm -f "$STATE_ROOT/openclaw.json.raw"

echo "==> Pull PTDS state"
docker cp "$CONTAINER:$REMOTE_STATE/state/local_ptds.db" "$STATE_ROOT/state/local_ptds.db"
docker cp "$CONTAINER:$REMOTE_STATE/state/trustclaw-agents-merged/." "$STATE_ROOT/state/trustclaw-agents-merged/"
docker cp "$CONTAINER:$REMOTE_STATE/state/ptds-audit/." "$STATE_ROOT/state/ptds-audit/"

echo "==> Pull workspace agent registry"
docker cp "$CONTAINER:$REMOTE_STATE/workspace/domain-agents/." "$STATE_ROOT/workspace/domain-agents/"
docker cp "$CONTAINER:$REMOTE_STATE/workspace/trustclaw-agents/." "$STATE_ROOT/workspace/trustclaw-agents/" 2>/dev/null || true

echo "==> Pull npm plugin installs (WeChat, etc.)"
docker cp "$CONTAINER:$REMOTE_STATE/npm/." "$STATE_ROOT/npm/" 2>/dev/null || true

echo "==> Promote domain-agents seeds into repo"
mkdir -p "$SEEDS_DIR"
rsync -a --delete "$STATE_ROOT/workspace/domain-agents/" "$SEEDS_DIR/"

echo "==> Done. Local mirror: $STATE_ROOT"
echo "    Seeds: $SEEDS_DIR"
du -sh "$STATE_ROOT" "$SEEDS_DIR" 2>/dev/null || true
