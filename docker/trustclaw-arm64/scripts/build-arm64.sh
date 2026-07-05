#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PLATFORM="${IMAGE_PLATFORM:-linux/arm64}"
BASE_TAG="${TRUSTCLAW_BASE_IMAGE:-trustclaw-openclaw-base:arm64}"
APP_TAG="${TRUSTCLAW_APP_IMAGE:-trustclaw-app:arm64}"
MIRROR="${TRUSTCLAW_DOCKER_MIRROR:-docker.m.daocloud.io}"

# Optional registry mirror when docker.io is slow/unreachable (common on CN networks).
NODE_BOOKWORM_IMAGE="${OPENCLAW_NODE_BOOKWORM_IMAGE:-${MIRROR}/library/node:24-bookworm}"
NODE_BOOKWORM_SLIM_IMAGE="${OPENCLAW_NODE_BOOKWORM_SLIM_IMAGE:-${MIRROR}/library/node:24-bookworm-slim}"
BUN_IMAGE="${OPENCLAW_BUN_IMAGE:-${MIRROR}/oven/bun:1.3.13}"

cd "$ROOT"

export DOCKER_BUILDKIT=1
BUILD_CMD=(docker buildx build --load)

echo "==> [1/2] Build OpenClaw + TrustClaw base (${PLATFORM})"
"${BUILD_CMD[@]}" \
  --platform "$PLATFORM" \
  --build-arg OPENCLAW_NODE_BOOKWORM_IMAGE="$NODE_BOOKWORM_IMAGE" \
  --build-arg OPENCLAW_NODE_BOOKWORM_SLIM_IMAGE="$NODE_BOOKWORM_SLIM_IMAGE" \
  --build-arg OPENCLAW_BUN_IMAGE="$BUN_IMAGE" \
  --build-arg OPENCLAW_TRUSTCLAW_UI=1 \
  --build-arg OPENCLAW_EXTENSIONS=trustclaw-ptds \
  -f Dockerfile \
  -t "$BASE_TAG" \
  .

echo "==> [2/2] Add TrustClaw ARM64 entrypoint layer"
"${BUILD_CMD[@]}" \
  --platform "$PLATFORM" \
  --build-arg IMAGE_PLATFORM="$PLATFORM" \
  -f docker/trustclaw-arm64/Dockerfile \
  -t "$APP_TAG" \
  .

echo "==> Image ready: $APP_TAG"
docker image inspect "$APP_TAG" --format 'Platform: {{.Os}}/{{.Architecture}}  Size: {{.Size}} bytes'
