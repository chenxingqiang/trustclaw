#!/bin/sh
set -eu

export OPENCLAW_STATE_DIR="${OPENCLAW_STATE_DIR:-/home/node/.openclaw}"
export OPENCLAW_CONFIG_PATH="${OPENCLAW_CONFIG_PATH:-$OPENCLAW_STATE_DIR/openclaw.json}"
export OPENCLAW_CONFIG_DIR="${OPENCLAW_CONFIG_DIR:-$OPENCLAW_STATE_DIR}"
export OPENCLAW_WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$OPENCLAW_STATE_DIR/workspace}"
export OPENCLAW_DISABLE_BONJOUR="${OPENCLAW_DISABLE_BONJOUR:-1}"
export OPENCLAW_GATEWAY_PORT="${OPENCLAW_GATEWAY_PORT:-19001}"

node /opt/trustclaw/init-config.mjs

exec node /app/openclaw.mjs gateway \
  --bind lan \
  --port "$OPENCLAW_GATEWAY_PORT"
