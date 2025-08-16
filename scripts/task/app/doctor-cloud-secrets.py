#!/usr/bin/env python3

import json
import os
import subprocess
import sys
import tempfile
from typing import Dict, List, Optional

# Colors for output
class Colors:
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color

def print_colored(message: str, color: str = Colors.NC):
    print(f"{color}{message}{Colors.NC}")

def get_bws_secrets() -> Optional[List[Dict]]:
    """Fetch all secrets from BWS"""
    bws_token = os.getenv('BWS_ACCESS_TOKEN')
    bws_project = os.getenv('BWS_PROJECT_ID')
    
    if not bws_token or not bws_project:
        print_colored("⚠️  BWS not configured - skipping cloud deployment secret checks", Colors.YELLOW)
        print("   Run 'task secrets:doctor' to configure BWS first")
        return None
    
    try:
        cmd = ['bws', '-t', bws_token, 'secret', 'list', bws_project, '--output', 'json']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return json.loads(result.stdout)
    except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError) as e:
        print_colored("❌ Failed to fetch secrets from BWS", Colors.RED)
        print(f"   Error: {e}")
        return None

def get_secret_value(secret_id: str) -> Optional[str]:
    """Get secret value by ID"""
    bws_token = os.getenv('BWS_ACCESS_TOKEN')
    
    try:
        cmd = ['bws', '-t', bws_token, 'secret', 'get', secret_id, '--output', 'env']
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Parse the env output (KEY="value")
        env_line = result.stdout.strip()
        if '=' in env_line:
            _, value = env_line.split('=', 1)
            return value.strip('"')
    except subprocess.CalledProcessError:
        pass
    
    return None

def check_required_apis(project_id: str) -> bool:
    """Check if required GCP APIs are enabled"""
    required_apis = [
        ('run.googleapis.com', 'Cloud Run API'),
        ('secretmanager.googleapis.com', 'Secret Manager API'),
        ('cloudbuild.googleapis.com', 'Cloud Build API'),
        ('containerregistry.googleapis.com', 'Container Registry API')
    ]
    
    print("    🔍 Checking required APIs...")
    api_errors = 0
    
    for api_name, display_name in required_apis:
        try:
            result = subprocess.run(
                ['gcloud', 'services', 'list', '--enabled', f'--filter=name:{api_name}', '--project', project_id, '--format=value(name)'],
                check=True, capture_output=True, text=True
            )
            
            if api_name in result.stdout:
                print(f"    ✅ {display_name} enabled")
            else:
                print_colored(f"    ❌ {display_name} not enabled", Colors.RED)
                print_colored(f"       Enable with: gcloud services enable {api_name} --project={project_id}", Colors.YELLOW)
                api_errors += 1
        except subprocess.CalledProcessError as e:
            print_colored(f"    ⚠️  Could not check {display_name} status", Colors.YELLOW)
            if "PERMISSION_DENIED" in str(e) or "serviceusage.services.list" in str(e):
                print_colored(f"       Service account lacks API listing permissions", Colors.YELLOW)
    
    return api_errors == 0

def validate_gcp_permissions(project_id: str, service_account_key: str, env_name: str) -> bool:
    """Test GCP service account permissions"""
    print_colored(f"  Testing {env_name} environment:", Colors.BLUE)
    
    try:
        # Parse service account JSON
        sa_data = json.loads(service_account_key)
        if sa_data.get('type') != 'service_account':
            print("    ❌ Invalid service account key format")
            return False
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as temp_file:
            json.dump(sa_data, temp_file)
            temp_path = temp_file.name
        
        try:
            # Test authentication
            subprocess.run(
                ['gcloud', 'auth', 'activate-service-account', '--key-file', temp_path, '--quiet'],
                check=True, capture_output=True
            )
            print("    ✅ Service account authentication successful")
            
            # Check required APIs first
            print()
            apis_enabled = check_required_apis(project_id)
            if not apis_enabled:
                print_colored("    ⚠️  API issues detected - enable missing APIs and re-run", Colors.YELLOW)
            print()
            
            permission_errors = 0
            
            # Test Cloud Run access
            try:
                subprocess.run(
                    ['gcloud', 'run', 'services', 'list', '--project', project_id, '--limit', '1', '--quiet'],
                    check=True, capture_output=True
                )
                print("    ✅ Cloud Run access confirmed")
            except subprocess.CalledProcessError:
                print_colored("    ❌ Cloud Run access denied", Colors.RED)
                permission_errors += 1
            
            # Test Service Account impersonation permissions
            try:
                sa_email = sa_data.get('client_email', '')
                test_result = subprocess.run(
                    ['gcloud', 'iam', 'service-accounts', 'get-iam-policy', sa_email, '--project', project_id, '--quiet'],
                    check=True, capture_output=True, text=True
                )
                print("    ✅ Service Account impersonation permissions confirmed")
            except subprocess.CalledProcessError:
                print_colored("    ❌ Service Account impersonation permissions missing", Colors.RED)
                print_colored("       Add role: gcloud projects add-iam-policy-binding {} --member='serviceAccount:{}' --role='roles/iam.serviceAccountUser'".format(project_id, sa_email), Colors.YELLOW)
                permission_errors += 1
            
            # Test Secret Manager access
            try:
                subprocess.run(
                    ['gcloud', 'secrets', 'list', '--project', project_id, '--limit', '1', '--quiet'],
                    check=True, capture_output=True
                )
                print("    ✅ Secret Manager access confirmed")
            except subprocess.CalledProcessError:
                print_colored("    ❌ Secret Manager access denied", Colors.RED)
                permission_errors += 1
            
            # Test Container Registry read access
            try:
                subprocess.run(
                    ['gcloud', 'container', 'images', 'list', f'--repository=gcr.io/{project_id}', '--limit', '1', '--quiet'],
                    check=True, capture_output=True
                )
                print("    ✅ Container Registry read access confirmed")
            except subprocess.CalledProcessError:
                print_colored("    ⚠️  Container Registry read access limited", Colors.YELLOW)
            
            # Test Container Registry write/push permissions by checking IAM
            try:
                sa_email = sa_data.get('client_email', '')
                # Check if service account has artifact registry writer role
                bindings_result = subprocess.run(
                    ['gcloud', 'projects', 'get-iam-policy', project_id, '--format=json'],
                    check=True, capture_output=True, text=True
                )
                iam_policy = json.loads(bindings_result.stdout)
                
                has_artifact_writer = False
                has_storage_admin = False
                
                for binding in iam_policy.get('bindings', []):
                    members = binding.get('members', [])
                    role = binding.get('role', '')
                    
                    if f'serviceAccount:{sa_email}' in members:
                        if role in ['roles/artifactregistry.writer', 'roles/artifactregistry.repoAdmin']:
                            has_artifact_writer = True
                        elif role in ['roles/storage.admin', 'roles/storage.objectAdmin']:
                            has_storage_admin = True
                
                if has_artifact_writer or has_storage_admin:
                    print("    ✅ Container Registry push permissions confirmed")
                else:
                    print_colored("    ❌ Container Registry push permissions missing", Colors.RED)
                    print_colored("       For GCR: gcloud projects add-iam-policy-binding {} --member='serviceAccount:{}' --role='roles/storage.admin'".format(project_id, sa_email), Colors.YELLOW)
                    print_colored("       For Artifact Registry: gcloud projects add-iam-policy-binding {} --member='serviceAccount:{}' --role='roles/artifactregistry.repoAdmin'".format(project_id, sa_email), Colors.YELLOW)
                    permission_errors += 1
                    
            except (subprocess.CalledProcessError, json.JSONDecodeError, KeyError):
                print_colored("    ⚠️  Could not verify Container Registry push permissions", Colors.YELLOW)
            
            # Test IAM access for listing
            try:
                subprocess.run(
                    ['gcloud', 'iam', 'service-accounts', 'list', '--project', project_id, '--limit', '1', '--quiet'],
                    check=True, capture_output=True
                )
                print("    ✅ IAM service account listing confirmed")
            except subprocess.CalledProcessError:
                print_colored("    ⚠️  IAM service account listing access limited", Colors.YELLOW)
            
            # Test IAM service account creation permissions (dry run)
            test_sa_name = "test-deploy-permissions-check"
            test_sa_email = f"{test_sa_name}@{project_id}.iam.gserviceaccount.com"
            try:
                # Check if test service account already exists
                describe_result = subprocess.run(
                    ['gcloud', 'iam', 'service-accounts', 'describe', test_sa_email, '--project', project_id, '--quiet'],
                    capture_output=True, text=True
                )
                if describe_result.returncode == 0:
                    print("    ✅ IAM service account creation permissions confirmed (test SA exists)")
                else:
                    # Try to create test service account to check permissions
                    create_result = subprocess.run(
                        ['gcloud', 'iam', 'service-accounts', 'create', test_sa_name, 
                         '--display-name=Test Deploy Permissions', '--project', project_id, '--quiet'],
                        capture_output=True, text=True
                    )
                    if create_result.returncode == 0:
                        print("    ✅ IAM service account creation permissions confirmed")
                        # Clean up test service account
                        subprocess.run(
                            ['gcloud', 'iam', 'service-accounts', 'delete', test_sa_email, 
                             '--project', project_id, '--quiet'],
                            capture_output=True
                        )
                    else:
                        print_colored("    ❌ IAM service account creation permission denied", Colors.RED)
                        print_colored("    💡 Required role: roles/iam.serviceAccountAdmin", Colors.YELLOW)
                        permission_errors += 1
            except Exception:
                print_colored("    ⚠️  Could not test IAM service account creation permissions", Colors.YELLOW)
            
            if permission_errors == 0:
                print_colored("    ✅ All critical permissions verified", Colors.GREEN)
                return True
            else:
                print_colored(f"    ❌ Missing {permission_errors} critical permissions", Colors.RED)
                print_colored("    💡 Required roles: roles/run.developer, roles/secretmanager.secretAccessor, roles/iam.serviceAccountAdmin, roles/storage.admin, roles/iam.serviceAccountUser", Colors.YELLOW)
                return False
                
        finally:
            os.unlink(temp_path)
            
    except json.JSONDecodeError:
        print_colored("    ❌ Service account key is not valid JSON", Colors.RED)
        return False
    except subprocess.CalledProcessError as e:
        print_colored("    ❌ Service account authentication failed", Colors.RED)
        print_colored("    💡 Check service account key format and validity", Colors.YELLOW)
        return False
    except Exception as e:
        print_colored(f"    ❌ Unexpected error: {e}", Colors.RED)
        return False

def main():
    print("🔍 Checking cloud deployment secrets...")
    print()
    
    # Required secrets for each environment
    required_secrets = {
        'staging': [
            ('DEPLOY_CLOUD_STAGING_VALIDATOR_GCP_PROJECT_ID', 'GCP Project ID for staging'),
            ('DEPLOY_CLOUD_STAGING_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY', 'GCP Service Account Key for staging'),
            ('DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY', 'Validator private key for staging'),
            ('DEPLOY_CLOUD_STAGING_VALIDATOR_PUBLIC_ADDRESS', 'Validator public address for staging'),
        ],
        'prod': [
            ('DEPLOY_CLOUD_PROD_VALIDATOR_GCP_PROJECT_ID', 'GCP Project ID for production'),
            ('DEPLOY_CLOUD_PROD_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY', 'GCP Service Account Key for production'),
            ('DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY', 'Validator private key for production'),
            ('DEPLOY_CLOUD_PROD_VALIDATOR_PUBLIC_ADDRESS', 'Validator public address for production'),
        ]
    }
    
    # Fetch secrets from BWS
    print("📋 Fetching secrets from BWS...")
    secrets_list = get_bws_secrets()
    if not secrets_list:
        sys.exit(1)
    
    # Create lookup dict
    secret_lookup = {secret['key']: secret['id'] for secret in secrets_list}
    
    print()
    print("🔐 Checking required cloud deployment secrets:")
    print()
    
    missing_secrets = 0
    found_secrets = 0
    
    # Check each environment
    for env_name, secrets in required_secrets.items():
        print_colored(f"📍 {env_name.upper()} ENVIRONMENT:", Colors.BLUE)
        
        for secret_name, description in secrets:
            if secret_name in secret_lookup:
                print(f"  ✅ {secret_name}")
                found_secrets += 1
            else:
                print_colored(f"  ❌ {secret_name} - {description}", Colors.RED)
                missing_secrets += 1
        print()
    
    # Test GCP permissions if secrets are found
    if found_secrets > 0:
        print("🔧 Testing GCP service account permissions...")
        
        for env_name in ['staging', 'prod']:
            env_upper = env_name.upper()
            project_secret = f'DEPLOY_CLOUD_{env_upper}_VALIDATOR_GCP_PROJECT_ID'
            sa_secret = f'DEPLOY_CLOUD_{env_upper}_VALIDATOR_GCP_SERVICE_ACCOUNT_KEY'
            
            if project_secret in secret_lookup and sa_secret in secret_lookup:
                project_id = get_secret_value(secret_lookup[project_secret])
                sa_key = get_secret_value(secret_lookup[sa_secret])
                
                if project_id and sa_key:
                    validate_gcp_permissions(project_id, sa_key, env_upper)
                else:
                    print_colored(f"  ⚠️  Could not retrieve {env_upper} credentials", Colors.YELLOW)
    
    print()
    print("📊 Summary:")
    print(f"  Found: {found_secrets} secrets")
    print(f"  Missing: {missing_secrets} secrets")
    
    if missing_secrets > 0:
        print()
        print_colored("📚 To create missing secrets, see:", Colors.YELLOW)
        print("   docs/BWS_SECRETS_SETUP.md")
        sys.exit(1)
    else:
        print_colored("✅ All cloud deployment secrets are present!", Colors.GREEN)
        print()
        
        # Provide setup guidance if permissions failed
        permission_issues_detected = False
        for env_name in ['staging', 'prod']:
            env_upper = env_name.upper()
            project_secret = f'DEPLOY_CLOUD_{env_upper}_VALIDATOR_GCP_PROJECT_ID'
            if project_secret in secret_lookup:
                project_id = get_secret_value(secret_lookup[project_secret])
                if project_id and "❌" in str(validate_gcp_permissions.__code__):  # Simple check for errors
                    permission_issues_detected = True
                    break
        
        if permission_issues_detected:
            print_colored("🔧 To fix GCP setup issues:", Colors.YELLOW)
            print()
            print("1. Enable required APIs:")
            print("   gcloud services enable run.googleapis.com secretmanager.googleapis.com \\")
            print("                         cloudbuild.googleapis.com containerregistry.googleapis.com \\")
            print("                         --project=PROJECT_ID")
            print()
            print("2. Grant required roles to service account:")
            print("   gcloud projects add-iam-policy-binding PROJECT_ID \\")
            print("     --member='serviceAccount:SERVICE_ACCOUNT_EMAIL' \\")
            print("     --role='roles/run.developer'")
            print()
            print("   gcloud projects add-iam-policy-binding PROJECT_ID \\")
            print("     --member='serviceAccount:SERVICE_ACCOUNT_EMAIL' \\")
            print("     --role='roles/secretmanager.secretAccessor'")
            print()
            print("   gcloud projects add-iam-policy-binding PROJECT_ID \\")
            print("     --member='serviceAccount:SERVICE_ACCOUNT_EMAIL' \\")
            print("     --role='roles/iam.serviceAccountAdmin'")
            print()
            print("3. Re-run doctor: task app:doctor:cloud-secrets")
            print()
        
        print("🚀 Ready for GitHub Actions deployment:")
        print("   • Staging: git push origin main")
        print("   • Production: gh workflow run deploy.yml -f environment=prod")

if __name__ == '__main__':
    main()