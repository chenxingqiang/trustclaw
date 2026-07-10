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

echo "==> Push setup libs + docker init-config"
docker exec "$CONTAINER" mkdir -p /app/scripts/lib
docker cp "$ROOT/scripts/lib/trustclaw-defaults.mjs" "$CONTAINER:/app/scripts/lib/trustclaw-defaults.mjs"
docker cp "$ROOT/scripts/lib/trustclaw-agent-packs.mjs" "$CONTAINER:/app/scripts/lib/trustclaw-agent-packs.mjs"
docker cp "$ROOT/scripts/lib/trustclaw-workspace-sync.mjs" "$CONTAINER:/app/scripts/lib/trustclaw-workspace-sync.mjs"
docker cp "$ROOT/scripts/lib/tra-state-bootstrap.mjs" "$CONTAINER:/app/scripts/lib/tra-state-bootstrap.mjs"
docker cp "$ROOT/scripts/lib/normalize-domain-agent-pack.mjs" "$CONTAINER:/app/scripts/lib/normalize-domain-agent-pack.mjs"
docker cp "$DIR/scripts/init-config.mjs" "$CONTAINER:/opt/trustclaw/init-config.mjs"

echo "==> Push Control UI"
docker cp "$ROOT/dist/control-ui/." "$CONTAINER:/app/dist/control-ui/"

echo "==> Push plugin bundle (trustclaw-tra)"
docker exec "$CONTAINER" mkdir -p /app/dist/extensions/trustclaw-tra/dist/ui
docker cp "$ROOT/dist/extensions/trustclaw-tra/index.js" "$CONTAINER:/app/dist/extensions/trustclaw-tra/index.js"
docker cp "$ROOT/extensions/trustclaw-tra/openclaw.plugin.json" "$CONTAINER:/app/dist/extensions/trustclaw-tra/openclaw.plugin.json"
if [[ -f "$ROOT/dist/extensions/trustclaw-tra/openclaw.plugin.json" ]]; then
  docker cp "$ROOT/dist/extensions/trustclaw-tra/openclaw.plugin.json" "$CONTAINER:/app/dist/extensions/trustclaw-tra/openclaw.plugin.json"
fi

echo "==> Push TrustClaw UI"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/dist/extensions/trustclaw-tra/dist/ui/"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/dist/extensions/dist/ui/"
docker cp "$ROOT/trustclaw/ui/dist/." "$CONTAINER:/app/trustclaw/ui/dist/"

echo "==> Push trustclaw sources"
docker cp "$ROOT/trustclaw/tra/." "$CONTAINER:/app/trustclaw/tra/"
docker cp "$ROOT/trustclaw/runtime/." "$CONTAINER:/app/trustclaw/runtime/"
docker cp "$ROOT/trustclaw/agents/." "$CONTAINER:/app/trustclaw/agents/"
docker cp "$ROOT/trustclaw/workspace/." "$CONTAINER:/app/trustclaw/workspace/"

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  echo "==> Restart gateway (entrypoint runs init-config.mjs)"
  docker restart "$CONTAINER" >/dev/null
  sleep 3
fi

echo "==> Post-sync checks"
docker exec "$CONTAINER" node -e "
const fs=require('fs');
const cfg=JSON.parse(fs.readFileSync('/home/node/.openclaw/openclaw.json','utf8'));
const tra=cfg.plugins?.entries?.['trustclaw-tra']?.config||{};
console.log('plugin:', Object.keys(cfg.plugins?.entries||{}).filter(k=>k.includes('trust')).join(', ')||'(none)');
console.log('agentPacksDir:', tra.agentPacksDir||'(unset)');
console.log('plugin dist:', fs.existsSync('/app/dist/extensions/trustclaw-tra/index.js')?'trustclaw-tra':'missing');
const packs=fs.readdirSync(tra.agentPacksDir||'/home/node/.openclaw/agent-packs',{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort();
console.log('agent-packs count:', packs.length, packs.filter(id=>id.startsWith('tra-')).length+' tra-*');
"

echo "==> Done. Hard-refresh http://127.0.0.1:\${APP_PORT:-8080}/trustclaw/"
echo "    Verify: curl -s http://127.0.0.1:\${APP_PORT:-8080}/api/tra/agent-packs | head -c 120"
