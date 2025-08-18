#!/bin/bash

# Kubernetes deployment script for EAS Attestor
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(dirname "$(dirname "$K8S_DIR")")"

# Default values
ENVIRONMENT=""
IMAGE_TAG="latest"
REGISTRY=""
DRY_RUN=false
SKIP_BUILD=false

usage() {
    cat << EOF
Usage: $0 -e ENVIRONMENT [OPTIONS]

Deploy EAS Attestor to Kubernetes

Required:
  -e, --environment    Environment to deploy (staging|production)

Optional:
  -t, --tag           Docker image tag (default: latest)
  -r, --registry      Docker registry prefix
  -d, --dry-run       Show what would be deployed without applying
  -s, --skip-build    Skip building Docker image
  -h, --help          Show this help

Examples:
  $0 -e staging
  $0 -e production -t v1.2.3 -r my-registry.com/eas
  $0 -e staging --dry-run
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
        -t|--tag)
            IMAGE_TAG="$2"
            shift 2
            ;;
        -r|--registry)
            REGISTRY="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
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

# Set image name
IMAGE_NAME="eas-validator"
if [[ -n "$REGISTRY" ]]; then
    FULL_IMAGE_NAME="${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
else
    FULL_IMAGE_NAME="${IMAGE_NAME}:${IMAGE_TAG}"
fi

log "Deploying EAS Attestor to Kubernetes"
log "Environment: $ENVIRONMENT"
log "Image: $FULL_IMAGE_NAME"
log "Dry run: $DRY_RUN"

# Build Docker image if not skipped
if [[ "$SKIP_BUILD" == false ]]; then
    log "Building Docker image..."
    cd "$PROJECT_ROOT"
    task app:validator:docker:build
    
    # Tag the image
    if [[ "$FULL_IMAGE_NAME" != "eas-validator:latest" ]]; then
        docker tag eas-validator:latest "$FULL_IMAGE_NAME"
        log "Tagged image as: $FULL_IMAGE_NAME"
    fi
    
    # Push to registry if specified
    if [[ -n "$REGISTRY" ]]; then
        log "Pushing image to registry..."
        docker push "$FULL_IMAGE_NAME"
    fi
fi

# Prepare manifests
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log "Preparing manifests..."
cp -r "$K8S_DIR/$ENVIRONMENT"/* "$TEMP_DIR/"

# Update image in deployment
sed -i.bak "s|image: eas-validator:latest|image: $FULL_IMAGE_NAME|g" "$TEMP_DIR/deployment.yaml"
rm "$TEMP_DIR/deployment.yaml.bak" 2>/dev/null || true

# Setup kubeconfig from BWS
log "Setting up kubectl configuration..."
KUBE_TEMP_CONFIG=$(mktemp)
trap "rm -f $KUBE_TEMP_CONFIG" EXIT

if [[ -n "$BWS_ACCESS_TOKEN" && -n "$BWS_PROJECT_ID" ]]; then
    BWS_ACCESS_TOKEN="$BWS_ACCESS_TOKEN" BWS_PROJECT_ID="$BWS_PROJECT_ID" bws secret get "37102190-b2e6-4a3f-9e4f-b33c00828d38" | jq -r .value | base64 -d > "$KUBE_TEMP_CONFIG"
    export KUBECONFIG="$KUBE_TEMP_CONFIG"
    log "Using kubeconfig from BWS"
else
    log "Using default kubeconfig"
fi

# Apply manifests
KUBECTL_CMD="kubectl apply"
if [[ "$DRY_RUN" == true ]]; then
    KUBECTL_CMD="kubectl apply --dry-run=client"
fi

log "Applying Kubernetes manifests..."

# Apply namespace first
$KUBECTL_CMD -f "$TEMP_DIR/namespace.yaml"

# Apply secrets (skip if dry run to avoid showing sensitive data)
if [[ "$DRY_RUN" == false ]]; then
    $KUBECTL_CMD -f "$TEMP_DIR/secrets.yaml"
else
    log "Skipping secrets in dry run mode"
fi

# Apply service and deployment
$KUBECTL_CMD -f "$TEMP_DIR/service.yaml"
$KUBECTL_CMD -f "$TEMP_DIR/deployment.yaml"

# Apply ingress if it exists in the environment directory
if [[ -f "$K8S_DIR/ingress/${ENVIRONMENT}-ingress.yaml" ]]; then
    $KUBECTL_CMD -f "$K8S_DIR/ingress/${ENVIRONMENT}-ingress.yaml"
fi

if [[ "$DRY_RUN" == false ]]; then
    log "Deployment complete!"
    log "Checking deployment status..."
    
    NAMESPACE="eas-$ENVIRONMENT"
    kubectl rollout status deployment/eas-validator -n "$NAMESPACE" --timeout=300s
    
    log "Service endpoints:"
    kubectl get svc -n "$NAMESPACE"
    
    log "Pod status:"
    kubectl get pods -n "$NAMESPACE"
else
    log "Dry run complete. No changes were applied."
fi