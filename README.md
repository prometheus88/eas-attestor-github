# EAS Attestor for GitHub

A system for creating cryptographic attestations that link GitHub usernames to Ethereum addresses using EAS (Ethereum Attestation Service) on the Base network. The system includes a validator service, frontend dApp, and Kubernetes deployment infrastructure.

## 🚀 Live Demo

- **Production**: https://attestor.cyberstorm.dev (Base mainnet)  
- **Staging**: https://attestor.staging.cyberstorm.dev (Base Sepolia testnet)

## 🏗️ How It Works

1. **Connect Wallet**: User connects MetaMask to the dApp
2. **Generate Proof**: User creates a verification JSON with signed message
3. **Create Gist**: User creates a GitHub Gist containing the verification data
4. **Validate**: Validator service verifies gist ownership and signature
5. **Attest**: System creates an on-chain EAS attestation linking GitHub username to Ethereum address
6. **Browse**: Attestations are browsable through the web interface

## 📁 Project Structure

```
├── src/main/
│   ├── html/                    # Frontend dApp
│   │   ├── index.html          # Browse attestations
│   │   ├── register.html       # Create new attestations
│   │   └── config.js           # Configuration
│   └── typescript/validator/    # Validator service (Node.js)
├── deploy/k8s/                  # Kubernetes manifests
│   ├── staging/                 # Staging environment (Base Sepolia)
│   └── production/             # Production environment (Base mainnet)
├── taskfiles/                   # Task automation
└── scripts/task/               # Build and deployment scripts
```

## 🚀 Quick Start

### Prerequisites

- [Task](https://taskfile.dev/) - Task runner
- [Docker](https://docker.com/) - Container runtime
- [Node.js 20+](https://nodejs.org/) - Runtime

### Local Development

1. **Clone and Setup**
```bash
git clone https://github.com/allenday/eas-attestor-github.git
cd eas-attestor-github
```

2. **Start Services**
```bash
# Build and start with Docker Compose
task app:docker:up

# Services will be available at:
# - Frontend: http://localhost:6000
# - Validator: http://localhost:6001
```

3. **Development Workflow**
```bash
# Build application
task app:build

# Start development server
task app:dev

# Run validator locally
task app:validator:dev

# Build Docker image
task app:validator:docker:build
```

### Using the dApp

1. **Browse Attestations** (index.html)
   - View existing GitHub ↔ Ethereum attestations
   - Search by GitHub username or Ethereum address
   - No wallet connection required

2. **Create Attestation** (register.html)
   - Connect MetaMask wallet
   - Generate verification JSON
   - Create GitHub Gist with verification data
   - Submit for validation and on-chain attestation

3. **Verify Attestation**
   - Check attestation validity
   - View verification details and proofs

## 🔐 Secret Management

The system uses Bitwarden Secrets Manager for secure credential storage:

```bash
# Configure BWS access
export BWS_ACCESS_TOKEN="your-bws-token"
export BWS_PROJECT_ID="your-project-id"

# Test secret access
task secrets:doctor
```

**Secret naming pattern**: `DEPLOY_CLOUD_{STAGING|PROD}_VALIDATOR_{RESOURCE}`

Examples:
- `DEPLOY_CLOUD_STAGING_VALIDATOR_PRIVATE_KEY`
- `DEPLOY_CLOUD_PROD_VALIDATOR_PRIVATE_KEY`

## 🌐 Deployment

### Kubernetes (Production)

The system deploys to Kubernetes with staging and production environments:

```bash
# Deploy to staging (Base Sepolia)
task app:k8s:deploy:staging

# Deploy to production (Base mainnet)  
task app:k8s:deploy:production

# Check deployment status
task app:k8s:status:staging
task app:k8s:status:production
```

**Infrastructure:**
- **External Secrets Operator** - Bitwarden integration
- **cert-manager** - SSL/TLS certificates
- **Traefik** - Ingress controller
- **Docker Hub** - Container registry (`allenday/eas-validator:latest`)

### Environment Details

| Environment | Network | URL | Purpose |
|-------------|---------|-----|---------|
| Staging | Base Sepolia | https://attestor.staging.cyberstorm.dev | Testing |
| Production | Base mainnet | https://attestor.cyberstorm.dev | Live service |

## 🧪 Testing

### Health Checks
```bash
# Check validator service
curl https://attestor.cyberstorm.dev/health
curl https://attestor.staging.cyberstorm.dev/health

# Local development
curl http://localhost:6001/health
```

### Validation Test
```bash
# Test validation endpoint
task app:validator:test \
  GITHUB_USERNAME=yourname \
  GIST_URL=https://gist.github.com/yourname/abc123 \
  ETH_ADDRESS=0x...
```

## 🔧 Available Tasks

```bash
# Development
task app:build                   # Build all components
task app:dev                     # Start development environment
task app:serve                   # Serve built dApp locally

# Docker operations
task app:validator:docker:build  # Build validator image
task app:validator:docker:push   # Push to DockerHub
task app:docker:up               # Start Docker Compose services
task app:docker:down             # Stop Docker Compose services

# Kubernetes deployment
task app:k8s:deploy:staging      # Deploy staging environment
task app:k8s:deploy:production   # Deploy production environment
task app:k8s:status:staging      # Check staging status
task app:k8s:logs:staging        # View staging logs

# Secret management
task secrets:doctor              # Check BWS configuration
task secrets:list-secrets        # List available secrets
```

## 📚 API Reference

### Validator Service

#### `POST /validate`
Validates GitHub gist and creates attestation signature.

**Request:**
```json
{
  "githubUsername": "string",
  "gistUrl": "string", 
  "ethereumAddress": "string"
}
```

**Response:**
```json
{
  "success": true,
  "validationSig": "0x...",
  "validatedAt": 1234567890,
  "validator": "0x...",
  "message": "GitHub:user|ETH:0x...|Gist:abc|Time:123"
}
```

#### `GET /health`
Service health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "service": "eas-validator-service"
}
```

## 🔒 Security

- **No Private Keys in Code**: All credentials via Bitwarden Secrets Manager
- **Environment Isolation**: Separate staging/production deployments
- **Container Security**: Non-root users, minimal attack surface
- **Signature Verification**: All GitHub gists cryptographically verified
- **HTTPS Only**: TLS termination via cert-manager

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request

For local development:
```bash
task app:setup    # Initial setup
task app:doctor   # Health check
```

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/allenday/eas-attestor-github/issues)
- **Documentation**: See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed k8s setup