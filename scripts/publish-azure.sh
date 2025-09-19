#!/usr/bin/env bash
set -euo pipefail

# Publish the app to Azure Container Apps from local source.
#
# Required env vars:
#   APP_NAME           Name of the Container App
# Optional env vars:
#   AZ_SUBSCRIPTION    Azure subscription ID or name
#   RESOURCE_GROUP     Azure resource group
#   ENVIRONMENT        Azure Container Apps environment name
#   LOCATION           Azure region (e.g., eastus)
#   INGRESS            'external' (default) or 'internal'
#   TARGET_PORT        Container port exposed for ingress (default: 8080)
#   ENV_ARGS           Space-separated env vars: "KEY1=VAL1 KEY2=VAL2"
#                      If not set, defaults to key/values parsed from
#                      a local `.env.local` file in the repo root.
#
# Usage:
#   APP_NAME=my-app RESOURCE_GROUP=my-rg ENVIRONMENT=my-env npm run publish

err() { echo "Error: $*" >&2; }

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI not found. Install from https://aka.ms/azure-cli"
  exit 1
fi

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'USAGE'
Publish current source to Azure Container Apps

Required env:
  APP_NAME            Container App name
Optional env:
  AZ_SUBSCRIPTION     Azure subscription ID or name
  RESOURCE_GROUP      Resource group
  ENVIRONMENT         Container Apps environment
  LOCATION            Azure region (e.g., eastus)
  INGRESS             external|internal (default: external)
  TARGET_PORT         container port (default: 8080)
  ENV_ARGS            space-separated env: "KEY1=VAL1 KEY2=VAL2"

Example:
  APP_NAME=myapp RESOURCE_GROUP=rg-demo ENVIRONMENT=env-demo \
  INGRESS=external TARGET_PORT=8080 ENV_ARGS="NODE_ENV=production PORT=8080" \
  npm run publish
USAGE
  exit 0
fi

echo "Checking Azure CLI login..."
if ! az account show >/dev/null 2>&1; then
  echo "Not logged in to Azure. Run: az login"
  exit 1
fi

readonly APP_NAME="${APP_NAME:-logprob-visualizer}"
readonly INGRESS="${INGRESS:-external}"
readonly TARGET_PORT="${TARGET_PORT:-8787}"
readonly RESOURCE_GROUP="${RESOURCE_GROUP:-}"
readonly ENVIRONMENT="${ENVIRONMENT:-}"
readonly LOCATION="${LOCATION:-}"
readonly ENV_ARGS="${ENV_ARGS:-}"

# If ENV_ARGS is not provided, default to values from .env.local when present.
# Parses simple dotenv lines: KEY=VALUE with optional quotes; ignores blank and comment lines.
env_kvs=()
if [[ -z "$ENV_ARGS" && -f ./.env.local ]]; then
  echo "ENV_ARGS not set; loading from .env.local"
  # Read .env.local line by line and construct key=value pairs preserving spaces via array elements
  # Enable extended globbing for whitespace trimming patterns
  shopt -s extglob
  while IFS= read -r raw || [[ -n "$raw" ]]; do
    # Trim leading/trailing whitespace
    line="${raw%%[$'\r\n']*}"
    line="${line##+([[:space:]])}"
    line="${line%%+([[:space:]])}"
    # Skip empty or comment lines
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    # Remove optional 'export '
    if [[ "$line" == export* ]]; then
      line="${line#export }"
      line="${line##+([[:space:]])}"
    fi
    # Require KEY=VALUE
    if [[ "$line" != *"="* ]]; then
      continue
    fi
    key="${line%%=*}"
    val="${line#*=}"
    # Trim whitespace around key and value
    key="${key%%+([[:space:]])}"
    key="${key##+([[:space:]])}"
    val="${val%%+([[:space:]])}"
    val="${val##+([[:space:]])}"
    # Strip surrounding quotes if present (simple case)
    case "$val" in
      \"*\") val="${val:1:${#val}-2}" ;;
      \'*\') val="${val:1:${#val}-2}" ;;
    esac
    # Skip obviously unsafe or empty keys
    [[ -z "$key" ]] && continue
    env_kvs+=("${key}=${val}")
  done < ./.env.local
  # Disable extended globbing to avoid bleeding into later logic
  shopt -u extglob
fi

if [[ -z "$APP_NAME" ]]; then
  err "APP_NAME is required. Example: APP_NAME=myapp npm run publish"
  exit 1
fi

if [[ -n "${AZ_SUBSCRIPTION:-}" ]]; then
  echo "Setting subscription: ${AZ_SUBSCRIPTION}"
  az account set --subscription "${AZ_SUBSCRIPTION}"
fi

echo "Publishing Container App '${APP_NAME}' from source with ingress ${INGRESS}:${TARGET_PORT}..."

args=(containerapp up -n "${APP_NAME}" --source . --ingress "${INGRESS}" --target-port "${TARGET_PORT}")

if [[ -n "$RESOURCE_GROUP" ]]; then
  args+=(--resource-group "${RESOURCE_GROUP}")
fi
if [[ -n "$ENVIRONMENT" ]]; then
  args+=(--environment "${ENVIRONMENT}")
fi
if [[ -n "$LOCATION" ]]; then
  args+=(--location "${LOCATION}")
fi
if [[ -n "$ENV_ARGS" ]]; then
  # Split ENV_ARGS on whitespace into an array and pass to --env-vars.
  # Note: values containing spaces should be quoted at invocation time.
  # shellcheck disable=SC2206
  env_kvs=( $ENV_ARGS )
fi

if [[ ${#env_kvs[@]} -gt 0 ]]; then
  echo "Passing ${#env_kvs[@]} env vars"
  args+=(--env-vars "${env_kvs[@]}")
fi

echo "+ az ${args[*]}"
az "${args[@]}"

echo "Publish complete."
