# EAS Attestor for Github

A comprehensive system for creating cryptographic attestations linking GitHub usernames to Ethereum addresses using EAS (Ethereum Attestation Service) on the Base network. The system includes a validator service, frontend dApp, and production-ready deployment infrastructure.

## 🏗️ Architecture

### Core Components

- **Validator Service**: Node.js service that validates GitHub gists and signs attestations
- **Frontend dApp**: Multi-page web application for creating, browsing, and managing attestations
- **EAS Integration**: Direct integration with Ethereum Attestation Service contracts on Base
- **Secret Management**: 5-dimensional secret resolution with Bitwarden Secrets Manager
- **Docker Infrastructure**: Production-ready containerized deployment

### System Flow

1. **User Registration**: User connects wallet and generates verification JSON
2. **GitHub Proof**: User creates a GitHub Gist containing the verification data
3. **Validation**: Validator service verifies the gist ownership and signature
4. **Attestation**: System creates an on-chain attestation linking GitHub username to Ethereum address
5. **Registry**: Attestations are browsable through the web interface

## 📁 Project Structure

```
├── src/main/
│   ├── html/                    # Frontend dApp (multi-page)
│   │   ├── index.html          # Browse attestations
│   │   ├── register.html       # Create attestations
│   │   ├── verify.html         # Verify attestations
│   │   ├── revoke.html         # Revoke attestations
│   │   └── config.js           # Centralized configuration
│   └── typescript/
│       └── validator/          # Validator service
│           ├── index.js        # Main service
│           ├── Dockerfile      # Container definition
│           └── resolve-secret.sh # Secret resolution
├── deploy/                     # Deployment configurations
│   └── local/dev/              # Local development
│       ├── docker-compose.yml  # Service orchestration
│       └── nginx.conf          # Reverse proxy config
├── taskfiles/                  # Task automation
├── third_party/               # External dependencies
│   └── taskfile-repo-template/ # 5D architecture template
└── scripts/                   # Automation scripts
```

## 🚀 Quick Start

### Prerequisites

- [Task](https://taskfile.dev/) - Task runner
- [Docker](https://docker.com/) - Container runtime
- [BWS CLI](https://bitwarden.com/help/secrets-manager-cli/) - Secret management
- [Node.js 20+](https://nodejs.org/) - Runtime

### Local Development

1. **Clone and Setup**
```bash
git clone <repository-url>
cd contributor-attestation-service
git submodule update --init --recursive
```

2. **Configure Secrets**
```bash
# Set up Bitwarden Secrets Manager
export BWS_ACCESS_TOKEN="your-bws-token"
export BWS_PROJECT_ID="your-project-id"

# Test secret resolution
task secrets:resolve SECRET_ITEM=PRIVATE_KEY
```

3. **Start Services**
```bash
# Start all services with Docker
cd deploy/local/dev
docker compose up -d

# Check service health
curl http://localhost:6001/health  # Validator service
curl http://localhost:9000         # Frontend dApp
```

### Development Commands

```bash
# Core development tasks
task typescript:build            # Build TypeScript
task typescript:test             # Run tests
task app:dev-server             # Start development server

# Docker operations
task container:build            # Build containers
task container:up               # Start services
task container:down             # Stop services

# Secret management
task secrets:create-secret      # Create new secret
task secrets:resolve           # Resolve secret value
task secrets:list              # List all secrets
```

## 🔐 Secret Management (5D Architecture)

The system uses a 5-dimensional secret naming convention:

**Pattern**: `${CONCERN}_${NETWORK}_${ENVIRONMENT}_${COMPONENT}_${RESOURCE}`

### Examples
- `DEPLOY_LOCAL_DEV_VALIDATOR_PRIVATE_KEY` - Validator private key for local dev
- `DEPLOY_CLOUD_PROD_VALIDATOR_API_TOKEN` - Production API token
- `CHAIN_BASE_MAINNET_RPC_URL` - Base mainnet RPC endpoint

### Resolution Hierarchy
1. **Environment Variables** (highest precedence)
2. **.env Files** (medium precedence) 
3. **Bitwarden Secrets Manager** (authoritative store)

## 🌐 Deployment

### Local Development
```bash
# Start all services
cd deploy/local/dev
docker compose up -d
```

### Production (GCP Cloud Run)
```bash
# Build production image
docker build -t eas-validator:prod src/main/typescript/validator/

# Deploy to Cloud Run
gcloud run deploy eas-validator \
  --image gcr.io/PROJECT/eas-validator:prod \
  --platform managed \
  --region us-central1
```

## 🧪 Testing

### Unit Tests
```bash
task typescript:test            # TypeScript tests
```

### Integration Tests
```bash
# Test validator service
curl -X POST http://localhost:6001/validate \
  -H "Content-Type: application/json" \
  -d '{
    "githubUsername": "testuser",
    "gistUrl": "https://gist.github.com/testuser/abc123",
    "ethereumAddress": "0x..."
  }'
```

### Health Checks
```bash
curl http://localhost:6001/health  # Validator service health
docker compose ps                  # Service status
```

## 📊 Monitoring

### Service Health
- **Validator**: `GET /health` endpoint with service metadata
- **Docker**: Health checks with automatic restarts
- **Logs**: Centralized logging via Docker Compose

### Metrics
- Response times for validation requests
- Success/failure rates
- Active attestation counts

## 🔧 Configuration

### Environment Variables
```bash
# Core service configuration
NODE_ENV=development
PORT=5001
DOCKER_ENV=true

# Network configuration  
NETWORK=LOCAL
ENVIRONMENT=DEV
COMPONENT=VALIDATOR
CONCERN=DEPLOY

# BWS configuration
BWS_ACCESS_TOKEN=your-token
BWS_PROJECT_ID=your-project-id
```

### Frontend Configuration
Edit `src/main/html/config.js` to customize:
- GitHub URLs and domains
- EAS contract addresses
- Network configurations
- Validator endpoints

## 🏃‍♂️ Workflows

### User Registration Flow
1. User visits registration page
2. Connects MetaMask wallet
3. Generates verification JSON with signed message
4. Creates GitHub Gist with JSON
5. Submits gist URL for validation
6. Validator service verifies ownership and signature
7. On-chain attestation created via EAS

### Attestation Browsing
1. User visits browse page
2. Connects wallet (optional)
3. Loads attestations from EAS GraphQL API
4. Filters and searches attestations
5. Views verification details and proofs

## 🤝 Contributing

1. **Setup Development Environment**
```bash
git clone <repo>
cd contributor-attestation-service  
task setup  # Sets up dependencies and environment
```

2. **Follow 5D Architecture**
- Use proper secret naming conventions
- Follow directory structure patterns
- Update documentation

3. **Testing**
- Add tests for new features
- Ensure Docker builds succeed
- Verify secret resolution works

## 🔒 Security

### Best Practices
- **No Fallback Keys**: Production uses BWS exclusively
- **Environment Isolation**: Strict network/environment separation
- **Container Security**: Non-root users, minimal attack surface
- **Secret Rotation**: Regular key rotation via BWS
- **Audit Trail**: All secret access logged

### Threat Model
- **Gist Tampering**: Mitigated by signature verification
- **Key Compromise**: Minimized by secret management
- **Service Disruption**: Handled by health checks and restarts

## 📚 API Reference

### Validator Service

#### `POST /validate`
Validates a GitHub gist and creates attestation signature.

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
  "message": "GitHub:user|ETH:0x...|Gist:abc|Time:123",
  "responseTime": 1500
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

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Project Docs](docs/)
- **Issues**: [GitHub Issues](https://github.com/allendy/contributor-attestation-service/issues)
- **Discussions**: [GitHub Discussions](https://github.com/allendy/contributor-attestation-service/discussions)