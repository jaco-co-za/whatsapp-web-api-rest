#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/jaco-co-za/whatsapp-web-api-rest.git}"
BRANCH="${BRANCH:-add-converse-status}"
REMOTE="${REMOTE:-origin}"

IMAGE="${IMAGE:-jaco/whatsapp-web-api-rest:add-converse-status}"
CONTAINER_NAME="${CONTAINER_NAME:-whatsapp}"
AUTH_VOLUME="${AUTH_VOLUME:-whatsapp_auth}"
APP_PORT="${APP_PORT:-8085}"
ENV_FILE="${ENV_FILE:-/home/jvdwalt/whatsapp.env}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -d .git ]]; then
  echo "This script must run from inside the repository directory."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  echo "Set ENV_FILE=/path/to/whatsapp.env and run again."
  exit 1
fi

echo "==> Syncing branch '$BRANCH' from '$REMOTE'..."
git remote set-url "$REMOTE" "$REPO_URL"
git fetch "$REMOTE" "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "==> Building docker image '$IMAGE'..."
docker build --pull -t "$IMAGE" .

echo "==> Recreating container '$CONTAINER_NAME'..."
docker volume create "$AUTH_VOLUME" >/dev/null
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --env-file "$ENV_FILE" \
  -p "$APP_PORT:$APP_PORT" \
  -v "$AUTH_VOLUME:/app/auth_info" \
  "$IMAGE" >/dev/null

echo "==> Container status:"
docker ps --filter "name=$CONTAINER_NAME"

echo "==> Following logs (Ctrl+C to stop):"
docker logs -f "$CONTAINER_NAME"
