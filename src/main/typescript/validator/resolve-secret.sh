#!/bin/bash

set -euo pipefail

SECRET_ITEM="${1:-}"
NETWORK="${NETWORK:-LOCAL}"
ENVIRONMENT="${ENVIRONMENT:-DEV}"
SERVICE="${SERVICE:-VALIDATOR}"  # Updated default for EAS project
CONCERN="${CONCERN:-DEPLOY}"  # Default concern

if [ -z "$SECRET_ITEM" ]; then
    echo "Usage: $0 <SECRET_ITEM>" >&2
    echo "Example: $0 GITLAB_API_KEY" >&2
    exit 1
fi

# Construct full secret name using 5D naming convention
# Pattern: ${CONCERN}_${NETWORK}_${ENVIRONMENT}_${COMPONENT}_${RESOURCE}
CONCERN="${CONCERN:-DEPLOY}"  # Default concern if not specified
COMPONENT="${COMPONENT:-${SERVICE}}"  # Backward compatibility
SECRET_NAME="${CONCERN}_${NETWORK}_${ENVIRONMENT}_${COMPONENT}_${SECRET_ITEM}"

# Environment variable name (for direct override)
ENV_VAR_NAME="${SECRET_ITEM}"

# Precedence hierarchy: env -> .env -> BWS

# 1. Check environment variable (highest precedence)
if [ -n "${!ENV_VAR_NAME:-}" ]; then
    echo "${!ENV_VAR_NAME}"
    exit 0
fi

# 2. Check .env file (medium precedence)
if [ -f .env ] && grep -q "^${ENV_VAR_NAME}=" .env; then
    grep "^${ENV_VAR_NAME}=" .env | cut -d= -f2- | sed 's/^["'\'']//' | sed 's/["'\'']$//'
    exit 0
fi

# 3. Fall back to BWS (lowest precedence, authoritative store)
BWS_ACCESS_TOKEN="${BWS_ACCESS_TOKEN:-}"
BWS_PROJECT_ID="${BWS_PROJECT_ID:-}"

if [ -z "$BWS_ACCESS_TOKEN" ] || [ -z "$BWS_PROJECT_ID" ]; then
    echo "❌ Secret not found in environment or .env, and BWS not configured" >&2
    echo "   Set BWS_ACCESS_TOKEN and BWS_PROJECT_ID, or provide $ENV_VAR_NAME directly" >&2
    exit 1
fi

if ! command -v bws >/dev/null 2>&1; then
    echo "❌ Secret not found in environment or .env, and BWS CLI not available" >&2
    echo "   Install BWS CLI or provide $ENV_VAR_NAME directly" >&2
    exit 1
fi

# Try to retrieve from BWS
SECRETS_JSON=$(bws secret list "$BWS_PROJECT_ID" --output json 2>/dev/null || echo "[]")
SECRET_ID=$(echo "$SECRETS_JSON" | jq -r --arg name "$SECRET_NAME" '.[] | select(.key == $name) | .id' 2>/dev/null || echo "")

if [ -n "$SECRET_ID" ]; then
    SECRET_VALUE=$(bws secret get "$SECRET_ID" --output json 2>/dev/null | jq -r '.value' 2>/dev/null || echo "")
    if [ -n "$SECRET_VALUE" ] && [ "$SECRET_VALUE" != "null" ]; then
        echo "$SECRET_VALUE"
        exit 0
    fi
fi

# Not found anywhere
echo "❌ Secret '$SECRET_ITEM' not found" >&2
echo "   Tried: environment variable $ENV_VAR_NAME, .env file, BWS secret $SECRET_NAME" >&2
echo "   Create with: task secrets:create-secret SECRET_NAME=$SECRET_NAME SECRET_VALUE=<value>" >&2
exit 1