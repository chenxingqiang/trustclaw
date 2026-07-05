#!/usr/bin/env bash
set -euo pipefail

# TrustClaw-branded macOS distribution (app + zip + dmg).
# Keeps the Swift binary/product as OpenClaw; user-visible bundle name is TrustClaw.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

export MAC_APP_NAME="${MAC_APP_NAME:-TrustClaw}"

# Offline Swift only when reusing an existing binary; full rebuild needs resolver.
if [[ "${SKIP_SWIFT_BUILD:-0}" == "1" ]]; then
  export SWIFT_DISABLE_AUTOMATIC_RESOLUTION="${SWIFT_DISABLE_AUTOMATIC_RESOLUTION:-1}"
fi

# Reuse a recent local Swift build when Package.resolved/network updates are flaky.
if [[ "${SKIP_SWIFT_BUILD:-}" == "" ]] && [[ -x "$ROOT_DIR/apps/macos/.build/arm64/debug/OpenClaw" ]]; then
  INSTALLER_SRC="$ROOT_DIR/apps/macos/Sources/OpenClaw/TrustClawBundledStateInstaller.swift"
  BINARY="$ROOT_DIR/apps/macos/.build/arm64/debug/OpenClaw"
  if [[ ! -f "$INSTALLER_SRC" ]] || [[ "$INSTALLER_SRC" -nt "$BINARY" ]]; then
    export SKIP_SWIFT_BUILD=0
  else
    export SKIP_SWIFT_BUILD=1
  fi
fi

BUILD_CONFIG="${BUILD_CONFIG:-debug}"
if [[ "$BUILD_CONFIG" == "release" ]]; then
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac}"
else
  export BUNDLE_ID="${BUNDLE_ID:-ai.trustclaw.mac.debug}"
fi

echo "📋 Preparing TrustClaw config from local OpenClaw state…"
export TRUSTCLAW_PACKAGED_DIST=1
node "$ROOT_DIR/scripts/trustclaw-setup.mjs" || true

bash "$ROOT_DIR/scripts/package-mac-dist.sh" "$@"

CONNECT_URL="$ROOT_DIR/dist/trustclaw-mac-bundle/trustclaw-connect.url"
if [[ -f "$CONNECT_URL" ]]; then
  cp "$CONNECT_URL" "$ROOT_DIR/dist/TrustClaw Connect.url"
  echo "🔗 Packaged connect shortcut: dist/TrustClaw Connect.url"
fi
