# EAS Contribution Attestation System

A comprehensive system for creating on-chain attestations of GitHub contributions using EAS (Ethereum Attestation Service). This extends the basic GitHub→ETH identity attestation to track and verify repository contributions including issues, pull requests, and code reviews.

## 🚀 Live Endpoints

- **Production**: https://attestor.cyberstorm.dev (Base mainnet)
- **Staging**: https://attestor.staging.cyberstorm.dev (Base Sepolia testnet)

## 🏗️ System Architecture

### Core Components

1. **Identity Attestations** - Link GitHub usernames to Ethereum addresses (existing)
2. **Repository Registration** - Register repositories for contribution monitoring  
3. **Webhook Processing** - Process GitHub events and create contribution attestations
4. **Contribution Attestations** - On-chain records of valuable contributions

### Data Flow

```
GitHub Repository → Webhook Events → Attestor Service → EAS Attestations → On-Chain Storage
                 ↗                                    ↘
Repository Registration                          Contribution Tracking
```

## 📋 Repository Registration Process

### Prerequisites

1. **Verified Identity**: Repository owner must have GitHub→ETH identity attestation
2. **Repository Allowlist**: Repository must be approved by attestor operator
3. **Admin Access**: Must have admin/owner permissions on GitHub repository

### Registration Flow

1. **Connect Wallet**: Owner connects MetaMask with verified identity
2. **Select Repository**: Choose from allowlisted repositories  
3. **Sign Registration**: Sign repository path (`"owner/repo"`) with private key
4. **Submit Registration**: Attestor creates on-chain registration attestation
5. **Configure Webhook**: Owner manually sets up GitHub webhook with returned secret
6. **Start Monitoring**: System begins processing contribution events

### On-Chain Registration Data

```typescript
interface RepositoryRegistration {
  repository: Repository;           // Domain + path ("github.com", "owner/repo")
  registrant: Identity;            // Verified GitHub→ETH identity
  registrant_signature: bytes;     // Signature of "owner/repo" 
  registered_at: timestamp;        // Registration time
}
```

## 🔗 Webhook Configuration

### GitHub Webhook Setup

After registration, repository owner configures GitHub webhook:

- **Payload URL**: `https://attestor.cyberstorm.dev/webhook`
- **Content Type**: `application/json`
- **Secret**: Derived secret returned from registration
- **Events**: `Issues`, `Pull requests`, `Pull request reviews`

### Webhook Secret Derivation

```typescript
webhook_secret = keccak256(
  repository.full_name + 
  registrant_signature + 
  attestor_private_key
)
```

**Security Features**:
- No secret storage - derived on-demand from on-chain data
- Unique per repository and registrant
- Only attestor can derive (has private key)
- Repository admin access required to configure

## 🎯 Contribution Processing

### Event Processing Flow

1. **Webhook Received**: GitHub sends event to attestor
2. **Repository Lookup**: Query EAS for repository registration (cached)
3. **Secret Validation**: Re-derive webhook secret and validate GitHub HMAC
4. **Identity Resolution**: Map GitHub username to verified ETH address (cached) 
5. **Business Logic**: Apply high-value contribution filtering
6. **Create Attestation**: Generate EAS attestation with contribution data
7. **Store On-Chain**: Commit attestation to EAS with linkage UIDs

### Tracked Contribution Types

#### Issue Contributions
- **Events**: Issue opened, issue resolved
- **High-Value**: Issue resolution (problem solving)
- **Data**: Repository, contributor identity, issue URL, resolution status

#### Pull Request Contributions  
- **Events**: PR opened, PR merged, PR closed
- **High-Value**: PR merged (accepted code contribution)
- **Data**: Repository, contributor identity, PR URL, commit hash, linked issues

#### Code Review Contributions
- **Events**: Review submitted (approved/changes requested)
- **High-Value**: Quality feedback (both approval and change requests)
- **Data**: Repository, reviewer identity, review URL, reviewed PR, approval status

### Business Logic Filtering

Not all events create attestations - only high-value contributions:

```typescript
// High-value events that generate attestations
const VALUABLE_EVENTS = {
  issues: ['closed'],           // Problem resolution
  pull_request: ['merged'],     // Accepted contributions  
  pull_request_review: [        // Quality feedback
    'approved', 
    'changes_requested'
  ]
};
```

## 🔗 Contribution Linkages

### Forward Linking (Supported)

- **PR → Issues**: Pull requests link to issues they resolve
- **Review → PR**: Reviews link to the pull request being reviewed
- **All → Identity**: All contributions link to identity attestation
- **All → Repository**: All contributions link to repository registration

### Schema with Linkages

```typescript
interface PullRequestContribution {
  contribution: Contribution;           // Base data (identity, repo, URL, time)
  event_type: PullRequestEvent;         // MERGED, OPENED, CLOSED
  commit_hash: string;                  // Git commit hash
  linked_issue_uids: bytes32[];         // Forward links to resolved issues
  identity_attestation_uid: bytes32;    // Link to identity attestation
  repository_registration_uid: bytes32; // Link to repository registration
}
```

### Backward Traversal (Via Queries)

While attestations only store forward links, backward traversal is supported via RPC queries:

- **Find PRs for Issue**: `GetContributionsByRepositoryUid()` + filter by issue UID
- **Find Reviews for PR**: `GetPullRequestReviews(pr_attestation_uid)`
- **Find All by Identity**: `GetContributionsByIdentityUid(identity_uid)`

## 🌐 dApp Interface

### Pages

#### Repository Registration (`/register-repo`)
- Connect verified wallet
- Select allowlisted repository
- Sign registration message
- Submit registration transaction
- Display webhook configuration instructions

#### Contribution Browser (`/contributions`)
- Browse contribution attestations by repository
- Filter by contribution type (issues, PRs, reviews)
- Search by contributor identity
- View contribution details and links

#### Repository Dashboard (`/repo/<owner>/<name>`)
- Repository-specific contribution feed
- Top contributors ranking
- Contribution timeline and metrics
- Registration status and webhook health

#### Contributor Profile (`/contributor/<address>`)
- Individual contributor's attestations
- Cross-repository contribution history
- Linked identities and verification status
- Contribution quality metrics

## 🔌 API Endpoints

### REST/HTTP Endpoints

#### GitHub Webhook Processing
```
POST /webhook
Content-Type: application/json
X-Hub-Signature-256: sha256=<hmac>

Process GitHub webhook events for contribution tracking
```

#### Repository Registration  
```
POST /api/v1/repositories/register
Content-Type: application/json

Register repository for contribution monitoring
Request: { repository: Repository, signature: string }
Response: { webhook_secret: string, registration_uid: string }
```

#### Repository Management
```
GET /api/v1/repositories
List all registered repositories

DELETE /api/v1/repositories/{domain}/{path}
Unregister repository (admin only)
```

#### Contribution Queries
```
GET /api/v1/contributions?repository={repo}&contributor={addr}&type={type}&limit={n}
Query contributions with filters

GET /api/v1/contributions/by-identity/{address}
Get all contributions by verified identity

GET /api/v1/contributions/by-repository/{domain}/{path}
Get all contributions for repository

GET /api/v1/contributions/{uid}/linked-issues
Get issues linked to a pull request contribution

GET /api/v1/contributions/{uid}/reviews  
Get reviews for a pull request contribution
```

#### Health & Status
```
GET /health
Service health check

GET /api/v1/status
System status including webhook processing health

GET /metrics
Prometheus metrics (if enabled)
```

## 🔧 gRPC API Reference

The system also exposes gRPC services for high-performance integrations:

### Repository Management Service

```typescript
service ContributionService {
  // Register repository for monitoring
  rpc RegisterRepository(RepositoryRegistration) returns (RegisterRepositoryResponse);
  
  // List all registered repositories  
  rpc ListRegisteredRepositories(google.protobuf.Empty) returns (ListRegisteredRepositoriesResponse);
}
```

### Contribution Query Service

```typescript
service ContributionService {
  // Query contributions with filters
  rpc GetContributions(GetContributionsRequest) returns (GetContributionsResponse);
  
  // Get contributions by verified identity
  rpc GetContributionsByIdentity(Identity) returns (GetContributionsResponse);
  
  // Get contributions by repository
  rpc GetContributionsByRepository(Repository) returns (GetContributionsResponse);
  
  // Referential lookups by attestation UID
  rpc GetContributionsByIdentityUid(GetContributionsByUidRequest) returns (GetContributionsResponse);
  rpc GetContributionsByRepositoryUid(GetContributionsByUidRequest) returns (GetContributionsResponse);
  
  // Relationship queries
  rpc GetLinkedIssues(GetLinkedIssuesRequest) returns (GetLinkedIssuesResponse);
  rpc GetPullRequestReviews(GetPullRequestReviewsRequest) returns (GetPullRequestReviewsResponse);
}
```

### Example API Calls

#### Register Repository
```bash
curl -X POST https://attestor.cyberstorm.dev/api/v1/repositories/register \
  -H "Content-Type: application/json" \
  -d '{
    "repository": {
      "domain": "github.com",
      "path": "owner/repo"
    },
    "signature": "0x..."
  }'
```

#### Query Contributions
```bash
# Get recent PR contributions for a repository
curl "https://attestor.cyberstorm.dev/api/v1/contributions?repository=github.com/owner/repo&type=pull_request&limit=50"

# Get all contributions by an identity
curl "https://attestor.cyberstorm.dev/api/v1/contributions/by-identity/0x742d35Cc6634C0532925a3b8D4AE6c53..."
```

## 🔒 Security Model

### Repository Registration Security

- **Identity Verification**: Only verified GitHub users can register repositories
- **Repository Allowlist**: Operator maintains list of approved repositories
- **Webhook Ownership**: Only repository admins can configure webhooks
- **Signature Verification**: Registration requires signing repository path

### Webhook Processing Security

- **HMAC Validation**: All webhooks validated with derived secrets
- **Replay Protection**: Webhook signatures prevent replay attacks
- **Source Verification**: Only GitHub can generate valid webhook signatures
- **Rate Limiting**: Protection against webhook spam

### Contribution Attestation Security

- **Identity Mapping**: Only process events for verified GitHub users
- **Repository Validation**: Only process events from registered repositories  
- **Event Filtering**: Business logic prevents low-value attestation spam
- **On-Chain Immutability**: EAS attestations are permanent and verifiable

## 💡 Smart Contract Integration

### Composability via UIDs

All attestations include cross-references enabling smart contract composition:

```solidity
// Example: Bounty contract that pays based on contributions
contract ContributionBounty {
    function claimBounty(
        bytes32 issueContributionUid,
        bytes32 prContributionUid
    ) external {
        // Verify issue resolution
        IssueContribution memory issue = eas.getAttestation(issueContributionUid);
        require(issue.resolved == true, "Issue not resolved");
        
        // Verify PR links to issue
        PullRequestContribution memory pr = eas.getAttestation(prContributionUid);
        require(
            contains(pr.linked_issue_uids, issueContributionUid), 
            "PR doesn't resolve issue"
        );
        
        // Pay contributor
        payable(pr.contributor).transfer(bountyAmount);
    }
}
```

### Reputation Systems

```solidity
// Example: Calculate contributor reputation score
function calculateReputation(address contributor) public view returns (uint256) {
    bytes32[] memory contributions = getContributionsByAddress(contributor);
    
    uint256 score = 0;
    for (uint i = 0; i < contributions.length; i++) {
        Contribution memory contrib = eas.getAttestation(contributions[i]);
        
        if (contrib.type == PULL_REQUEST_MERGED) score += 10;
        if (contrib.type == ISSUE_RESOLVED) score += 5;
        if (contrib.type == REVIEW_APPROVED) score += 3;
    }
    
    return score;
}
```

## 🚀 Deployment Architecture

### Container Structure

```
/app/
├── index.js                          # Attestor service entry point
├── html/                             # Frontend dApp files
├── generated/typescript/attestor/v1/ # Generated protobuf types & gRPC
└── node_modules/                     # Dependencies including gRPC
```

### Kubernetes Resources

- **Deployment**: Attestor service pods with gRPC and HTTP endpoints
- **Service**: Internal cluster communication and external access
- **Ingress**: HTTPS termination and routing
- **ExternalSecret**: Bitwarden integration for private keys
- **ConfigMap**: Repository allowlist and configuration

### Build Pipeline

```bash
# 1. Generate protobuf TypeScript types
task protobuf:gen-typescript

# 2. Build attestor service with generated types
task app:build:validator

# 3. Build and push Docker container
task app:validator:docker:build
task app:validator:docker:push

# 4. Deploy to Kubernetes
task app:k8s:deploy:staging
task app:k8s:deploy:production
```

## 📊 Monitoring & Observability

### Health Checks

- **Service Health**: `GET /health` - Basic service status
- **Webhook Health**: `GET /webhook/health` - GitHub webhook processing status
- **gRPC Health**: Built-in gRPC health checking protocol
- **EAS Connectivity**: On-chain attestation service availability

### Metrics

- **Registration Metrics**: Repository registrations, webhook configurations
- **Contribution Metrics**: Attestations created by type and repository
- **Performance Metrics**: Webhook processing latency, EAS write times
- **Error Metrics**: Failed webhook validations, attestation errors

### Logging

- **Structured Logging**: JSON format with correlation IDs
- **Webhook Events**: All GitHub webhook receipts and processing results
- **Attestation Events**: All EAS attestation creations and failures
- **Security Events**: Invalid webhook signatures, unauthorized access

## 🧪 Testing Strategy

### Unit Tests
- Protobuf message serialization/deserialization
- Webhook signature validation
- Business logic filtering
- EAS attestation data structures

### Integration Tests  
- End-to-end repository registration flow
- GitHub webhook processing with real payloads
- EAS attestation creation and retrieval
- gRPC client/server communication

### Load Tests
- Webhook processing under high GitHub event volume
- Concurrent repository registration handling
- EAS attestation throughput limits
- Database/cache performance under load

## 🛣️ Implementation Roadmap

This README describes the intended system architecture. Implementation will be tracked via GitHub issues:

### Phase 1: Core Infrastructure
- [ ] Webhook endpoint implementation
- [ ] Repository registration gRPC service
- [ ] EAS attestation creation logic
- [ ] Basic caching layer

### Phase 2: dApp Interface
- [ ] Repository registration page
- [ ] Contribution browser interface
- [ ] Repository dashboard
- [ ] Contributor profiles

### Phase 3: Advanced Features
- [ ] Smart contract integration examples
- [ ] Advanced contribution analytics
- [ ] Webhook health monitoring
- [ ] Performance optimization

### Phase 4: Production Readiness
- [ ] Comprehensive test suite
- [ ] Performance benchmarking
- [ ] Security audit
- [ ] Documentation completion

---

**Note**: This system extends the existing GitHub→ETH identity attestation service. The base identity verification functionality remains unchanged and continues to operate as documented in the main README.md.