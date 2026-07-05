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

echo "📋 Bundling TrustClaw config + credentials from local OpenClaw state…"
node "$ROOT_DIR/scripts/trustclaw-setup.mjs" || true
BUNDLE_ARGS=()
if [[ "${TRUSTCLAW_MAC_CONFIG_DEV:-0}" == "1" ]]; then
  BUNDLE_ARGS=(--dev)
fi
node "$ROOT_DIR/scripts/trustclaw-bundle-mac-config.mjs" "${BUNDLE_ARGS[@]}"

exec bash "$ROOT_DIR/scripts/package-mac-dist.sh" "$@"
