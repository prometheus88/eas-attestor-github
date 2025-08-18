#!/bin/bash

# Setup Kubernetes secrets for EAS Attestor
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"

# Default values
ENVIRONMENT=""
BWS_ACCESS_TOKEN=""
BWS_PROJECT_ID=""
DRY_RUN=false

usage() {
    cat << EOF
Usage: $0 -e ENVIRONMENT [OPTIONS]

Setup Kubernetes secrets for EAS Attestor

Required:
  -e, --environment    Environment (staging|production)

Optional:
  --bws-token         BWS access token (or set BWS_ACCESS_TOKEN env var)
  --bws-project       BWS project ID (or set BWS_PROJECT_ID env var)
  -d, --dry-run       Show what would be created without applying
  -h, --help          Show this help

Examples:
  $0 -e staging --bws-token xxx --bws-project yyy
  $0 -e production  # Uses env vars BWS_ACCESS_TOKEN and BWS_PROJECT_ID
EOF
}

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >&2
}

error() {
    log "ERROR: $*"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --bws-token)
            BWS_ACCESS_TOKEN="$2"
            shift 2
            ;;
        --bws-project)
            BWS_PROJECT_ID="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            ;;
    esac
done

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]]; then
    error "Environment is required. Use -e staging or -e production"
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    error "Environment must be 'staging' or 'production'"
fi

# Use environment variables as fallback
if [[ -z "$BWS_ACCESS_TOKEN" ]]; then
    BWS_ACCESS_TOKEN="${BWS_ACCESS_TOKEN:-}"
fi

if [[ -z "$BWS_PROJECT_ID" ]]; then
    BWS_PROJECT_ID="${BWS_PROJECT_ID:-}"
fi

if [[ -z "$BWS_ACCESS_TOKEN" || -z "$BWS_PROJECT_ID" ]]; then
    error "BWS credentials required. Set --bws-token and --bws-project or BWS_ACCESS_TOKEN and BWS_PROJECT_ID env vars"
fi

# Set environment-specific values
if [[ "$ENVIRONMENT" == "staging" ]]; then
    NAMESPACE="eas-staging"
    NODE_ENV="staging"
    LOG_LEVEL="debug"
    BWS_ENVIRONMENT="STAGING"
elif [[ "$ENVIRONMENT" == "production" ]]; then
    NAMESPACE="eas-production"
    NODE_ENV="production"
    LOG_LEVEL="info"
    BWS_ENVIRONMENT="PROD"
fi

log "Setting up secrets for environment: $ENVIRONMENT"
log "Namespace: $NAMESPACE"

# Create secret manifest
SECRET_MANIFEST="apiVersion: v1
kind: Secret
metadata:
  name: eas-validator-secrets
  namespace: $NAMESPACE
  labels:
    app: eas-validator
    environment: $ENVIRONMENT
type: Opaque
stringData:
  BWS_ACCESS_TOKEN: \"$BWS_ACCESS_TOKEN\"
  BWS_PROJECT_ID: \"$BWS_PROJECT_ID\"
  NETWORK: \"CLOUD\"
  ENVIRONMENT: \"$BWS_ENVIRONMENT\"
  COMPONENT: \"VALIDATOR\"
  CONCERN: \"DEPLOY\"
  NODE_ENV: \"$NODE_ENV\"
  LOG_LEVEL: \"$LOG_LEVEL\""

if [[ "$DRY_RUN" == true ]]; then
    log "Dry run - would create the following secret:"
    echo "$SECRET_MANIFEST" | sed 's/BWS_ACCESS_TOKEN: ".*"/BWS_ACCESS_TOKEN: "[REDACTED]"/'
else
    log "Creating secret in namespace $NAMESPACE..."
    echo "$SECRET_MANIFEST" | kubectl apply -f -
    log "Secret created successfully!"
    
    log "Verifying secret..."
    kubectl get secret eas-validator-secrets -n "$NAMESPACE" -o yaml | grep -E "name:|namespace:|BWS_PROJECT_ID:" | head -3
fi