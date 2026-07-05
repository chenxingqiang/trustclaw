#!/usr/bin/env bash
# Push trustclaw-app:arm64 to Docker Hub (requires docker login + reachable registry-1.docker.io).
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

DOCKER_USER="${DOCKER_USER:-chenxingqiang}"
IMAGE="${DOCKER_USER}/trustclaw-app"
TAG="${1:-arm64}"

if ! docker image inspect "trustclaw-app:arm64" >/dev/null 2>&1; then
  echo "Local image trustclaw-app:arm64 not found. Run: ./scripts/build-arm64.sh"
  exit 1
fi

docker tag "trustclaw-app:arm64" "${IMAGE}:${TAG}"
if [[ "${TAG}" != "latest" ]]; then
  docker tag "trustclaw-app:arm64" "${IMAGE}:latest"
fi

echo "==> Pushing ${IMAGE}:${TAG}"
docker push "${IMAGE}:${TAG}"
if [[ "${TAG}" != "latest" ]]; then
  echo "==> Pushing ${IMAGE}:latest"
  docker push "${IMAGE}:latest"
fi

echo "Done: docker pull ${IMAGE}:${TAG}"
