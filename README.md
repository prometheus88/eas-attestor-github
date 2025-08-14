# EAS Attestor for Github

A stateless system for creating cryptographic attestations linking GitHub usernames to Ethereum addresses using EAS (Ethereum Attestation Service) on the Base network.

## Architecture

- **Static dApp**: Single HTML page for wallet connection, message signing, and gist creation
- **EAS Integration**: Uses Ethereum Attestation Service contracts on Base network for attestation storage
- **GitHub Actions**: Automated verification and attestation processing (optional)

## Project Structure

```
├── src/
│   ├── html/              # Static website files
│   └── solidity/          # Smart contracts
│       ├── contracts/     # Contract source code
│       ├── test/         # Contract tests
│       └── script/       # Deployment scripts
├── scripts/              # Node.js automation scripts
├── state/               # GitHub Action state persistence
├── .github/workflows/   # CI/CD workflows
└── build/               # Build outputs
```

## Workflows

- `ci.yml`: Continuous integration (build, test, coverage)
- `deploy.yml`: Manual contract deployment to Base networks
- `publish.yml`: Deploy static site to GitHub Pages
- `attest.yml`: Automated attestation processing (runs every 15 minutes)

## Usage

1. Visit the static site at GitHub Pages
2. Connect wallet and sign verification message
3. Create GitHub Gist with verification JSON
4. Submit gist URL to Base contract
5. GitHub Action processes and creates attestation

## Development

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
npm install

# Build contracts
forge build

# Run tests
forge test

# Local development
npm run anvil
```

## Environments

- **Sepolia**: Testing environment using Base Sepolia testnet
- **Mainnet**: Production environment using Base mainnet

Environment variables are managed through GitHub repository secrets.