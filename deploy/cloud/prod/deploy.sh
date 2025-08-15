#!/bin/bash

# Production deployment script for GCP Cloud Run
set -euo pipefail

# Configuration
PROJECT_ID=${PROJECT_ID:-"your-project-id"}
REGION=${REGION:-"us-central1"}
SERVICE_NAME="eas-validator"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Validate prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if gcloud is installed
    if ! command -v gcloud &> /dev/null; then
        error "gcloud CLI is not installed. Please install it first."
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed. Please install it first."
    fi
    
    # Check if authenticated with gcloud
    if ! gcloud auth print-access-token &> /dev/null; then
        error "Not authenticated with gcloud. Run 'gcloud auth login' first."
    fi
    
    # Check if project is set
    if [ -z "${PROJECT_ID}" ] || [ "${PROJECT_ID}" == "your-project-id" ]; then
        error "PROJECT_ID environment variable must be set to your GCP project ID"
    fi
    
    log "Prerequisites check passed"
}

# Enable required GCP APIs
enable_apis() {
    log "Enabling required GCP APIs..."
    
    gcloud services enable cloudbuild.googleapis.com \
                          run.googleapis.com \
                          secretmanager.googleapis.com \
                          --project="${PROJECT_ID}"
    
    log "APIs enabled successfully"
}

# Create service account and IAM bindings
setup_service_account() {
    log "Setting up service account..."
    
    local sa_email="eas-validator-sa@${PROJECT_ID}.iam.gserviceaccount.com"
    
    # Create service account if it doesn't exist
    if ! gcloud iam service-accounts describe "${sa_email}" --project="${PROJECT_ID}" &> /dev/null; then
        gcloud iam service-accounts create eas-validator-sa \
            --display-name="EAS Validator Service Account" \
            --description="Service account for EAS validator Cloud Run service" \
            --project="${PROJECT_ID}"
    fi
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
        --member="serviceAccount:${sa_email}" \
        --role="roles/secretmanager.secretAccessor"
    
    log "Service account configured successfully"
}

# Create secrets in Secret Manager
create_secrets() {
    log "Creating secrets in Secret Manager..."
    
    # Check if BWS credentials are provided
    if [ -z "${BWS_ACCESS_TOKEN:-}" ] || [ -z "${BWS_PROJECT_ID:-}" ]; then
        warn "BWS credentials not provided. You'll need to create secrets manually:"
        warn "  gcloud secrets create bws-access-token --data-file=- --project=${PROJECT_ID}"
        warn "  gcloud secrets create bws-project-id --data-file=- --project=${PROJECT_ID}"
        return
    fi
    
    # Create BWS access token secret
    if ! gcloud secrets describe bws-access-token --project="${PROJECT_ID}" &> /dev/null; then
        echo -n "${BWS_ACCESS_TOKEN}" | gcloud secrets create bws-access-token \
            --data-file=- \
            --project="${PROJECT_ID}"
        log "Created bws-access-token secret"
    else
        warn "bws-access-token secret already exists"
    fi
    
    # Create BWS project ID secret
    if ! gcloud secrets describe bws-project-id --project="${PROJECT_ID}" &> /dev/null; then
        echo -n "${BWS_PROJECT_ID}" | gcloud secrets create bws-project-id \
            --data-file=- \
            --project="${PROJECT_ID}"
        log "Created bws-project-id secret"
    else
        warn "bws-project-id secret already exists"
    fi
}

# Build and push Docker image
build_and_push() {
    log "Building Docker image..."
    
    # Build the image using the production Dockerfile
    docker build -t "${IMAGE_NAME}:latest" \
                 -f Dockerfile \
                 ../../../src/main/typescript/validator/
    
    # Configure Docker to use gcloud as credential helper
    gcloud auth configure-docker --quiet
    
    # Push the image
    log "Pushing image to Container Registry..."
    docker push "${IMAGE_NAME}:latest"
    
    # Tag with timestamp for versioning
    local timestamp=$(date +%Y%m%d-%H%M%S)
    docker tag "${IMAGE_NAME}:latest" "${IMAGE_NAME}:${timestamp}"
    docker push "${IMAGE_NAME}:${timestamp}"
    
    log "Image pushed successfully: ${IMAGE_NAME}:latest"
}

# Deploy to Cloud Run
deploy_service() {
    log "Deploying to Cloud Run..."
    
    # Update the cloud-run.yaml with actual project ID
    sed "s/PROJECT_ID/${PROJECT_ID}/g" cloud-run.yaml > cloud-run-deployed.yaml
    
    # Apply the Cloud Run service configuration
    gcloud run services replace cloud-run-deployed.yaml \
        --region="${REGION}" \
        --project="${PROJECT_ID}"
    
    # Get the service URL
    local service_url=$(gcloud run services describe "${SERVICE_NAME}" \
                       --region="${REGION}" \
                       --project="${PROJECT_ID}" \
                       --format="value(status.url)")
    
    log "Service deployed successfully!"
    log "Service URL: ${service_url}"
    log "Health check: ${service_url}/health"
    
    # Clean up temporary file
    rm -f cloud-run-deployed.yaml
}

# Test the deployment
test_deployment() {
    log "Testing deployment..."
    
    local service_url=$(gcloud run services describe "${SERVICE_NAME}" \
                       --region="${REGION}" \
                       --project="${PROJECT_ID}" \
                       --format="value(status.url)")
    
    # Test health endpoint
    if curl -f "${service_url}/health" > /dev/null 2>&1; then
        log "Health check passed ✓"
    else
        error "Health check failed ✗"
    fi
    
    log "Deployment test completed successfully"
}

# Main deployment flow
main() {
    log "Starting production deployment for EAS Validator Service"
    log "Project: ${PROJECT_ID}"
    log "Region: ${REGION}"
    
    check_prerequisites
    enable_apis
    setup_service_account
    create_secrets
    build_and_push
    deploy_service
    test_deployment
    
    log "🎉 Production deployment completed successfully!"
    log "Your EAS Validator Service is now running on Google Cloud Run"
}

# Show usage information
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Environment variables:"
    echo "  PROJECT_ID          GCP project ID (required)"
    echo "  REGION              GCP region (default: us-central1)"
    echo "  BWS_ACCESS_TOKEN    Bitwarden Secrets Manager access token (optional)"
    echo "  BWS_PROJECT_ID      Bitwarden Secrets Manager project ID (optional)"
    echo ""
    echo "Example:"
    echo "  PROJECT_ID=my-project ./deploy.sh"
    echo ""
    echo "For help:"
    echo "  ./deploy.sh --help"
}

# Parse command line arguments
case "${1:-}" in
    --help|-h)
        show_usage
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac