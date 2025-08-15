#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if BWS is configured
if [ -z "${BWS_ACCESS_TOKEN:-}" ] || [ -z "${BWS_PROJECT_ID:-}" ]; then
    echo -e "${YELLOW}⚠️  BWS not configured - skipping cloud deployment secret checks${NC}"
    echo "   Run 'task secrets:doctor' to configure BWS first"
    exit 0
fi

if ! command -v bws >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  BWS CLI not installed - skipping cloud deployment secret checks${NC}"
    echo "   Install BWS CLI first: https://bitwarden.com/help/secrets-manager-cli/"
    exit 0
fi

echo "🔍 Checking cloud deployment secrets..."
echo ""

# Define required secrets for each environment
STAGING_SECRETS=(
    "DEPLOY_CLOUD_STAGING_VALIDATOR_GCP_PROJECT_ID:GCP Project ID for staging"
    "DEPLOY_CLOUD_STAGING_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY:GCP Service Account Key for staging"
    "DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY:Validator private key for staging"
    "DEPLOY_CLOUD_STAGING_VALIDATOR_PUBLIC_ADDRESS:Validator public address for staging"
)

PROD_SECRETS=(
    "DEPLOY_CLOUD_PROD_VALIDATOR_GCP_PROJECT_ID:GCP Project ID for production"
    "DEPLOY_CLOUD_PROD_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY:GCP Service Account Key for production"
    "DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY:Validator private key for production"
    "DEPLOY_CLOUD_PROD_VALIDATOR_PUBLIC_ADDRESS:Validator public address for production"
)

# Get list of all secrets from BWS
echo "📋 Fetching secrets from BWS..."
if [ -n "${BWS_ACCESS_TOKEN}" ]; then
    SECRETS_LIST=$(bws -t "${BWS_ACCESS_TOKEN}" secret list "${BWS_PROJECT_ID}" --output json 2>/dev/null || echo "[]")
else
    SECRETS_LIST=$(bws secret list "${BWS_PROJECT_ID}" --output json 2>/dev/null || echo "[]")
fi

if [ "$SECRETS_LIST" = "[]" ]; then
    echo -e "${RED}❌ Failed to fetch secrets from BWS${NC}"
    echo "   Check your BWS_ACCESS_TOKEN and BWS_PROJECT_ID"
    exit 1
fi

# Extract secret names
SECRET_NAMES=$(echo "$SECRETS_LIST" | jq -r '.[].key' 2>/dev/null || echo "")

# Check each required secret
MISSING_SECRETS=0
FOUND_SECRETS=0

echo ""
echo "🔐 Checking required cloud deployment secrets:"
echo ""

# Check staging environment
echo -e "${BLUE}📍 STAGING ENVIRONMENT:${NC}"
for item in "${STAGING_SECRETS[@]}"; do
    secret_name="${item%%:*}"
    description="${item#*:}"
    if echo "$SECRET_NAMES" | grep -q "^$secret_name$"; then
        echo -e "  ✅ $secret_name"
        FOUND_SECRETS=$((FOUND_SECRETS + 1))
    else
        echo -e "  ${RED}❌ $secret_name${NC} - $description"
        MISSING_SECRETS=$((MISSING_SECRETS + 1))
    fi
done

echo ""
echo -e "${BLUE}📍 PRODUCTION ENVIRONMENT:${NC}"
for item in "${PROD_SECRETS[@]}"; do
    secret_name="${item%%:*}"
    description="${item#*:}"
    if echo "$SECRET_NAMES" | grep -q "^$secret_name$"; then
        echo -e "  ✅ $secret_name"
        FOUND_SECRETS=$((FOUND_SECRETS + 1))
    else
        echo -e "  ${RED}❌ $secret_name${NC} - $description"
        MISSING_SECRETS=$((MISSING_SECRETS + 1))
    fi
done

echo ""

# Additional validation for found secrets
if [ $FOUND_SECRETS -gt 0 ]; then
    echo "🔍 Validating secret formats..."
    
    # Check GCP Project ID format (basic validation)
    for env in "STAGING" "PROD"; do
        project_secret="DEPLOY_CLOUD_${env}_VALIDATOR_GCP_PROJECT_ID"
        if echo "$SECRET_NAMES" | grep -q "^$project_secret$"; then
            project_value=$(bws secret get "$project_secret" --output env 2>/dev/null | grep -o 'DEPLOY_CLOUD_.*=.*' | cut -d'=' -f2 | tr -d '"' || echo "")
            if [ -n "$project_value" ] && [[ "$project_value" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]; then
                echo -e "  ✅ $project_secret format valid"
            else
                echo -e "  ${YELLOW}⚠️  $project_secret format may be invalid${NC}"
            fi
        fi
    done
    
    # Check service account key format (JSON validation)
    for env in "STAGING" "PROD"; do
        sa_secret="DEPLOY_CLOUD_${env}_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY"
        if echo "$SECRET_NAMES" | grep -q "^$sa_secret$"; then
            sa_value=$(bws secret get "$sa_secret" --output env 2>/dev/null | grep -o 'DEPLOY_CLOUD_.*=.*' | cut -d'=' -f2- | tr -d '"' || echo "")
            if [ -n "$sa_value" ] && echo "$sa_value" | jq . >/dev/null 2>&1; then
                # Check if it has required service account fields
                if echo "$sa_value" | jq -e '.type == "service_account" and .project_id and .private_key and .client_email' >/dev/null 2>&1; then
                    echo -e "  ✅ $sa_secret format valid"
                else
                    echo -e "  ${YELLOW}⚠️  $sa_secret missing required service account fields${NC}"
                fi
            else
                echo -e "  ${YELLOW}⚠️  $sa_secret not valid JSON${NC}"
            fi
        fi
    done
    
    # Check private key format
    for env in "STAGING" "PROD"; do
        pk_secret="DEPLOY_CLOUD_${env}_VALIDATOR_PRIVATE_KEY"
        if echo "$SECRET_NAMES" | grep -q "^$pk_secret$"; then
            pk_value=$(bws secret get "$pk_secret" --output env 2>/dev/null | grep -o 'DEPLOY_CLOUD_.*=.*' | cut -d'=' -f2 | tr -d '"' || echo "")
            if [ -n "$pk_value" ] && [[ "$pk_value" =~ ^0x[a-fA-F0-9]{64}$ ]]; then
                echo -e "  ✅ $pk_secret format valid"
            else
                echo -e "  ${YELLOW}⚠️  $pk_secret format may be invalid (should be 0x + 64 hex chars)${NC}"
            fi
        fi
    done
    
    # Check public address format
    for env in "STAGING" "PROD"; do
        addr_secret="DEPLOY_CLOUD_${env}_VALIDATOR_PUBLIC_ADDRESS"
        if echo "$SECRET_NAMES" | grep -q "^$addr_secret$"; then
            addr_value=$(bws secret get "$addr_secret" --output env 2>/dev/null | grep -o 'DEPLOY_CLOUD_.*=.*' | cut -d'=' -f2 | tr -d '"' || echo "")
            if [ -n "$addr_value" ] && [[ "$addr_value" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
                echo -e "  ✅ $addr_secret format valid"
            else
                echo -e "  ${YELLOW}⚠️  $addr_secret format may be invalid (should be 0x + 40 hex chars)${NC}"
            fi
        fi
    done
    
    echo ""
    echo "🔧 Testing GCP service account permissions..."
    
    # Test GCP permissions for each environment
    for env in "STAGING" "PROD"; do
        project_secret="DEPLOY_CLOUD_${env}_VALIDATOR_GCP_PROJECT_ID"
        sa_secret="DEPLOY_CLOUD_${env}_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY"
        
        if echo "$SECRET_NAMES" | grep -q "^$project_secret$" && echo "$SECRET_NAMES" | grep -q "^$sa_secret$"; then
            echo -e "${BLUE}  Testing ${env} environment:${NC}"
            
            # Get secret IDs from the secrets list
            project_id_secret_id=$(echo "$SECRETS_LIST" | jq -r --arg name "$project_secret" '.[] | select(.key == $name) | .id' 2>/dev/null || echo "")
            sa_key_secret_id=$(echo "$SECRETS_LIST" | jq -r --arg name "$sa_secret" '.[] | select(.key == $name) | .id' 2>/dev/null || echo "")
            
            # Get project ID and service account key using secret IDs
            project_id=""
            sa_key=""
            if [ -n "$project_id_secret_id" ]; then
                if [ -n "${BWS_ACCESS_TOKEN}" ]; then
                    project_id=$(bws -t "${BWS_ACCESS_TOKEN}" secret get "$project_id_secret_id" --output env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")
                else
                    project_id=$(bws secret get "$project_id_secret_id" --output env 2>/dev/null | cut -d'=' -f2 | tr -d '"' || echo "")
                fi
            fi
            if [ -n "$sa_key_secret_id" ]; then
                # For service account key, we need to handle multiline JSON
                if [ -n "${BWS_ACCESS_TOKEN}" ]; then
                    sa_key_output=$(bws -t "${BWS_ACCESS_TOKEN}" secret get "$sa_key_secret_id" --output env 2>/dev/null || echo "")
                else
                    sa_key_output=$(bws secret get "$sa_key_secret_id" --output env 2>/dev/null || echo "")
                fi
                if [ -n "$sa_key_output" ]; then
                    # Extract everything after the = sign and remove quotes
                    sa_key=$(echo "$sa_key_output" | sed 's/^[^=]*=//' | sed 's/^"//' | sed 's/"$//')
                fi
            fi
            
            if [ -n "$project_id" ] && [ -n "$sa_key" ]; then
                # Write service account key to temp file
                temp_key_file="/tmp/gcp-sa-test-${env}.json"
                echo "$sa_key" > "$temp_key_file"
                
                # Test gcloud authentication
                if gcloud auth activate-service-account --key-file="$temp_key_file" --quiet 2>/dev/null; then
                    echo -e "    ✅ Service account authentication successful"
                    
                    # Test required permissions
                    PERMISSION_ERRORS=0
                    
                    # Check Cloud Run permissions
                    if gcloud run services list --project="$project_id" --limit=1 --quiet >/dev/null 2>&1; then
                        echo -e "    ✅ Cloud Run access confirmed"
                    else
                        echo -e "    ${RED}❌ Cloud Run access denied${NC}"
                        PERMISSION_ERRORS=$((PERMISSION_ERRORS + 1))
                    fi
                    
                    # Check Secret Manager permissions
                    if gcloud secrets list --project="$project_id" --limit=1 --quiet >/dev/null 2>&1; then
                        echo -e "    ✅ Secret Manager access confirmed"
                    else
                        echo -e "    ${RED}❌ Secret Manager access denied${NC}"
                        PERMISSION_ERRORS=$((PERMISSION_ERRORS + 1))
                    fi
                    
                    # Check Container Registry permissions (try to list repositories)
                    if gcloud container images list --repository="gcr.io/$project_id" --limit=1 --quiet >/dev/null 2>&1; then
                        echo -e "    ✅ Container Registry access confirmed"
                    else
                        echo -e "    ${YELLOW}⚠️  Container Registry access limited${NC} (may work for push)"
                    fi
                    
                    # Check IAM permissions (try to list service accounts)
                    if gcloud iam service-accounts list --project="$project_id" --limit=1 --quiet >/dev/null 2>&1; then
                        echo -e "    ✅ IAM service account access confirmed"
                    else
                        echo -e "    ${YELLOW}⚠️  IAM service account access limited${NC}"
                    fi
                    
                    if [ $PERMISSION_ERRORS -eq 0 ]; then
                        echo -e "    ${GREEN}✅ All critical permissions verified${NC}"
                    else
                        echo -e "    ${RED}❌ Missing $PERMISSION_ERRORS critical permissions${NC}"
                        echo -e "    ${YELLOW}💡 Required roles: roles/run.developer, roles/secretmanager.secretAccessor${NC}"
                    fi
                else
                    echo -e "    ${RED}❌ Service account authentication failed${NC}"
                    echo -e "    ${YELLOW}💡 Check service account key format and validity${NC}"
                fi
                
                # Clean up temp file
                rm -f "$temp_key_file"
            else
                echo -e "    ${YELLOW}⚠️  Skipping permission test - could not retrieve credentials${NC}"
            fi
        fi
    done
fi

echo ""
echo "📊 Summary:"
echo "  Found: $FOUND_SECRETS secrets"
echo "  Missing: $MISSING_SECRETS secrets"

if [ $MISSING_SECRETS -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}📚 To create missing secrets, see:${NC}"
    echo "   docs/BWS_SECRETS_SETUP.md"
    echo ""
    echo -e "${YELLOW}💡 Quick setup commands:${NC}"
    echo "   # For staging:"
    echo "   bws secret create 'DEPLOY_CLOUD_STAGING_VALIDATOR_GCP_PROJECT_ID' 'your-staging-project'"
    echo "   bws secret create 'DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY' '0x...'"
    echo "   bws secret create 'DEPLOY_CLOUD_STAGING_VALIDATOR_PUBLIC_ADDRESS' '0x...'"
    echo ""
    echo "   # For production:"
    echo "   bws secret create 'DEPLOY_CLOUD_PROD_VALIDATOR_GCP_PROJECT_ID' 'your-prod-project'"
    echo "   bws secret create 'DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY' '0x...'"
    echo "   bws secret create 'DEPLOY_CLOUD_PROD_VALIDATOR_PUBLIC_ADDRESS' '0x...'"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ All cloud deployment secrets are present and properly formatted!${NC}"
    echo ""
    echo "🚀 Ready for GitHub Actions deployment:"
    echo "   • Staging: git push origin main"
    echo "   • Production: gh workflow run deploy.yml -f environment=prod"
fi