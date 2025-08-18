# EAS Attestor Kubernetes Deployment Guide

This guide covers deploying the EAS Attestor service to a kube-hetzner Kubernetes cluster with staging (Base Sepolia) and production (Base mainnet) environments.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────────────────────┐ │
│  │  eas-staging    │    │     eas-production              │ │
│  │  (Base Sepolia) │    │     (Base mainnet)              │ │
│  │                 │    │                                 │ │
│  │  ┌─────────────┐│    │  ┌─────────────────────────────┐ │ │
│  │  │ Validator   ││    │  │ Validator (3 replicas)     │ │ │
│  │  │ (2 replicas)││    │  │                             │ │ │
│  │  └─────────────┘│    │  └─────────────────────────────┘ │ │
│  └─────────────────┘    └─────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                      Ingress Controller                     │
│   staging.eas.your-domain.com   eas.your-domain.com        │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Kubernetes Cluster**: kube-hetzner cluster with kubectl access
2. **Container Registry**: GitHub Container Registry (GHCR) access
3. **Secrets Management**: Bitwarden Secrets Manager (BWS) configured
4. **Domain**: DNS configured for your domains
5. **TLS**: cert-manager installed for SSL certificates
6. **Ingress**: nginx-ingress-controller installed

## Quick Start

### 1. Setup Secrets

Configure BWS credentials and setup secrets for both environments:

```bash
# Staging environment
export BWS_ACCESS_TOKEN="your-bws-access-token"
export BWS_PROJECT_ID="your-bws-project-id"

task app:k8s:secrets:staging
task app:k8s:secrets:production
```

### 2. Deploy to Staging

```bash
# Deploy staging (Base Sepolia)
task app:k8s:deploy:staging

# Check status
task app:k8s:status:staging
```

### 3. Deploy to Production

```bash
# Deploy production (Base mainnet)
task app:k8s:deploy:production

# Check status
task app:k8s:status:production
```

## Detailed Configuration

### Environment Configuration

| Environment | Namespace | Network | Replicas | Resources |
|-------------|-----------|---------|----------|-----------|
| Staging | `eas-staging` | Base Sepolia | 2 | 250m CPU, 256Mi RAM |
| Production | `eas-production` | Base mainnet | 3 | 500m CPU, 512Mi RAM |

### Domains and Ingress

Update the ingress configuration with your actual domains:

1. Edit `deploy/k8s/ingress/staging-ingress.yaml`
2. Edit `deploy/k8s/ingress/production-ingress.yaml`
3. Replace `staging.eas.your-domain.com` and `eas.your-domain.com` with your domains

### Secrets Management

The deployment uses BWS (Bitwarden Secrets Manager) with the 5D naming pattern:

```
NETWORK=CLOUD ENVIRONMENT=STAGING COMPONENT=VALIDATOR
NETWORK=CLOUD ENVIRONMENT=PROD COMPONENT=VALIDATOR
```

Required secrets in BWS:
- `PRIVATE_KEY`: Ethereum private key for the validator
- `VALIDATOR_URL`: Public URL of the deployed validator (optional)

## Available Tasks

### Deployment Tasks

```bash
# Deploy environments
task app:k8s:deploy:staging          # Deploy to staging
task app:k8s:deploy:production       # Deploy to production

# Dry run deployments
task app:k8s:deploy:staging:dry-run     # Test staging deployment
task app:k8s:deploy:production:dry-run  # Test production deployment
```

### Management Tasks

```bash
# Check status
task app:k8s:status:staging          # Check staging status
task app:k8s:status:production       # Check production status

# View logs
task app:k8s:logs:staging           # Follow staging logs
task app:k8s:logs:production        # Follow production logs

# Restart deployments
task app:k8s:restart:staging        # Restart staging
task app:k8s:restart:production     # Restart production

# Access pods
task app:k8s:shell:staging          # Shell into staging pod
task app:k8s:shell:production       # Shell into production pod
```

### Secret Management

```bash
# Setup secrets
task app:k8s:secrets:staging        # Setup staging secrets
task app:k8s:secrets:production     # Setup production secrets
```

## CI/CD Pipeline

The GitHub Actions workflow in `.github/workflows/deploy-k8s.yml` provides:

1. **Automatic Docker Image Building**: Builds and pushes to GHCR
2. **Staging Deployment**: Auto-deploys on main branch pushes
3. **Production Deployment**: Manual deployment via workflow_dispatch
4. **Environment Protection**: Uses GitHub environments for approval

### Required Secrets

Configure these secrets in your GitHub repository:

- `KUBECONFIG`: Base64 encoded kubeconfig file
- `BWS_ACCESS_TOKEN`: Bitwarden Secrets Manager access token
- `BWS_PROJECT_ID`: Bitwarden Secrets Manager project ID

### Manual Deployment

To deploy manually via GitHub Actions:

1. Go to Actions → Deploy to Kubernetes
2. Click "Run workflow"
3. Select environment (staging/production)
4. Optionally specify image tag
5. Run workflow

## Monitoring and Health Checks

### Health Endpoints

Both environments expose health check endpoints:

- Staging: `https://staging.eas.your-domain.com/health`
- Production: `https://eas.your-domain.com/health`

### Kubernetes Probes

All deployments include:
- **Liveness Probe**: Restarts unhealthy containers
- **Readiness Probe**: Routes traffic only to ready containers
- **Startup Probe**: Allows time for application startup

### Monitoring Commands

```bash
# Watch pod status
kubectl get pods -n eas-staging -w
kubectl get pods -n eas-production -w

# Check resource usage
kubectl top pods -n eas-staging
kubectl top pods -n eas-production

# View events
kubectl get events -n eas-staging --sort-by=.metadata.creationTimestamp
kubectl get events -n eas-production --sort-by=.metadata.creationTimestamp
```

## Scaling

### Manual Scaling

```bash
# Scale staging
kubectl scale deployment eas-validator -n eas-staging --replicas=3

# Scale production
kubectl scale deployment eas-validator -n eas-production --replicas=5
```

### Auto-scaling (Future Enhancement)

Consider adding HorizontalPodAutoscaler (HPA) for automatic scaling based on CPU/memory usage.

## Troubleshooting

### Common Issues

1. **Pod CrashLoopBackOff**
   ```bash
   kubectl logs -n eas-staging deployment/eas-validator
   kubectl describe pod -n eas-staging -l app=eas-validator
   ```

2. **Ingress Not Working**
   ```bash
   kubectl get ingress -A
   kubectl describe ingress -n eas-staging eas-validator-staging
   ```

3. **Secrets Not Loading**
   ```bash
   kubectl get secrets -n eas-staging
   kubectl describe secret -n eas-staging eas-validator-secrets
   ```

### Debug Commands

```bash
# Test connectivity from within cluster
kubectl run debug --image=curlimages/curl -it --rm -- sh
# Then: curl http://eas-validator.eas-staging.svc.cluster.local/health

# Check DNS resolution
kubectl run debug --image=busybox -it --rm -- nslookup eas-validator.eas-staging.svc.cluster.local
```

## Security Considerations

1. **Network Policies**: Consider adding network policies to restrict inter-pod communication
2. **RBAC**: Ensure proper role-based access control
3. **Secret Rotation**: Regularly rotate BWS tokens and Ethereum private keys
4. **Image Security**: Scan container images for vulnerabilities
5. **TLS**: Ensure all external traffic uses HTTPS

## Backup and Disaster Recovery

1. **Configuration**: All Kubernetes manifests are version controlled
2. **Secrets**: BWS provides centralized secret management and backup
3. **Container Images**: Stored in GHCR with retention policies
4. **Monitoring**: Set up alerts for service availability

## Migration from Cloud Run

To migrate from the existing Cloud Run deployment:

1. Deploy to staging and test thoroughly
2. Update DNS to point to Kubernetes ingress
3. Monitor both systems during transition
4. Gradually shift traffic to Kubernetes
5. Decommission Cloud Run when stable

The GitHub Pages frontend will automatically fall back to Cloud Run if Kubernetes endpoints are unavailable.