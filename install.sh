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
WEBHOOK_URLS="${WEBHOOK_URLS:-http://192.168.55.73:3350/incomingwa}"
IMAGE_TAG="${IMAGE_TAG:-local}"
BUILD_SHA="${BUILD_SHA:-dev}"

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

ensure_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"

  if grep -qE "^${key}=" "$file"; then
    return 0
  fi

  printf "%s=%s\n" "$key" "$value" >> "$file"
}

ENV_DIR="$(dirname "$ENV_FILE")"
mkdir -p "$ENV_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
APP_PORT=$APP_PORT

# Optional startup webhook registration:
# comma/semicolon/newline separated URLs
WEBHOOK_URLS=$WEBHOOK_URLS

# Optional file path that contains webhook URLs (newline or CSV)
# WEBHOOKS_FILE=/data/webhooks.csv

# Optional startup metadata log fields
IMAGE_TAG=$IMAGE_TAG
BUILD_SHA=$BUILD_SHA
EOF
  echo "==> Created default env file at '$ENV_FILE'"
else
  ensure_env_value "APP_PORT" "$APP_PORT" "$ENV_FILE"
  ensure_env_value "WEBHOOK_URLS" "$WEBHOOK_URLS" "$ENV_FILE"
  ensure_env_value "IMAGE_TAG" "$IMAGE_TAG" "$ENV_FILE"
  ensure_env_value "BUILD_SHA" "$BUILD_SHA" "$ENV_FILE"
  echo "==> Reused env file at '$ENV_FILE' (added missing defaults only)"
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
