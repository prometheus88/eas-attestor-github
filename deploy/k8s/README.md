# Kubernetes Deployment

This directory contains Kubernetes manifests for deploying the EAS Attestor service to a kube-hetzner cluster.

## Structure

```
k8s/
├── base/              # Base manifests (common configuration)
├── staging/           # Staging environment (Base Sepolia)
├── production/        # Production environment (Base mainnet)
└── ingress/           # Ingress configuration
```

## Environments

### Staging
- **Network**: Base Sepolia testnet
- **Namespace**: `eas-staging`
- **Domain**: `staging.eas.your-domain.com`
- **Purpose**: Testing and validation before production

### Production
- **Network**: Base mainnet
- **Namespace**: `eas-production`
- **Domain**: `eas.your-domain.com`
- **Purpose**: Live production service

## Deployment

1. Apply namespaces:
   ```bash
   kubectl apply -f staging/namespace.yaml
   kubectl apply -f production/namespace.yaml
   ```

2. Apply secrets (configure first):
   ```bash
   kubectl apply -f staging/secrets.yaml
   kubectl apply -f production/secrets.yaml
   ```

3. Deploy services:
   ```bash
   kubectl apply -f staging/
   kubectl apply -f production/
   ```

4. Configure ingress:
   ```bash
   kubectl apply -f ingress/
   ```

## Configuration

Each environment uses its own:
- Namespace for isolation
- Secrets for environment-specific configuration
- Service and deployment configuration
- Ingress rules

## Monitoring

Services expose `/health` endpoints for health checks and monitoring integration.