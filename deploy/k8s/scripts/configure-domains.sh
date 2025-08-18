#!/bin/bash

# Configure domains for Kubernetes ingress
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"

# Default values
DOMAIN=""
STAGING_SUBDOMAIN="staging.eas"
PROD_SUBDOMAIN="eas"

usage() {
    cat << EOF
Usage: $0 -d DOMAIN [OPTIONS]

Configure domain names for Kubernetes ingress

Required:
  -d, --domain        Your base domain (e.g., example.com)

Optional:
  --staging-sub       Staging subdomain prefix (default: staging.eas)
  --prod-sub          Production subdomain prefix (default: eas)
  -h, --help          Show this help

Examples:
  $0 -d example.com
  # Creates: staging.eas.example.com and eas.example.com
  
  $0 -d mysite.org --staging-sub test --prod-sub api
  # Creates: test.mysite.org and api.mysite.org
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
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        --staging-sub)
            STAGING_SUBDOMAIN="$2"
            shift 2
            ;;
        --prod-sub)
            PROD_SUBDOMAIN="$2"
            shift 2
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
if [[ -z "$DOMAIN" ]]; then
    error "Domain is required. Use -d your-domain.com"
fi

STAGING_DOMAIN="${STAGING_SUBDOMAIN}.${DOMAIN}"
PROD_DOMAIN="${PROD_SUBDOMAIN}.${DOMAIN}"

log "Configuring domains:"
log "  Staging: $STAGING_DOMAIN"
log "  Production: $PROD_DOMAIN"

# Update staging ingress
log "Updating staging ingress..."
sed -i.bak "s/staging\.eas\.your-domain\.com/$STAGING_DOMAIN/g" "$K8S_DIR/ingress/staging-ingress.yaml"
rm "$K8S_DIR/ingress/staging-ingress.yaml.bak"

# Update production ingress  
log "Updating production ingress..."
sed -i.bak "s/eas\.your-domain\.com/$PROD_DOMAIN/g" "$K8S_DIR/ingress/production-ingress.yaml"
rm "$K8S_DIR/ingress/production-ingress.yaml.bak"

# Update GitHub Pages workflow
log "Updating GitHub Pages workflow..."
WORKFLOW_PATH="$K8S_DIR/../../.github/workflows/publish.yml"
if [ -f "$WORKFLOW_PATH" ]; then
  sed -i.bak "s/eas\.your-domain\.com/$PROD_DOMAIN/g" "$WORKFLOW_PATH"
  rm "$WORKFLOW_PATH.bak" 2>/dev/null || true
else
  log "⚠️  GitHub Pages workflow not found at $WORKFLOW_PATH"
fi

log "✅ Domain configuration complete!"
log ""
log "📝 Next steps:"
log "1. Ensure DNS records point to your Kubernetes ingress:"
log "   $STAGING_DOMAIN → <your-k8s-ingress-ip>"
log "   $PROD_DOMAIN → <your-k8s-ingress-ip>"
log ""
log "2. Deploy to test the configuration:"
log "   task app:k8s:deploy:staging"
log ""
log "3. Check ingress status:"
log "   kubectl get ingress -A"