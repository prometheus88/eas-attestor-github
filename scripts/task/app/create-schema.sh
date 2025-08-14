#!/bin/bash
set -e

NETWORK=${1:-base-sepolia}

echo "🔧 Creating EAS Schema for Domain Identity Attestation"
echo "Network: $NETWORK"
echo ""

cat << 'EOF'
To create the schema for domain identity attestation:

1. Go to EAS Schema Registry: https://base-sepolia.easscan.org/schemas (for testnet)
   Or: https://base.easscan.org/schemas (for mainnet)

2. Click "Create Schema"

3. Use this schema definition:
   string domain,string identifier,string proofUrl

4. Set resolverAddress to: 0x0000000000000000000000000000000000000000 (no resolver)

5. Set revocable to: true

6. Description: "Domain identifier to Ethereum address attestation with gist verification"

7. After creation, copy the Schema UID and update ATTESTATION_SCHEMA_UID in the dApp

The schema allows attestations that prove:
- An identifier on a domain (e.g., username@github.com) belongs to an Ethereum address
- With a proof URL containing verification data from that domain
- Extensible to other platforms (twitter.com, linkedin.com, etc.)

For GitHub: domain="github.com", identifier="username", proofUrl="https://gist.github.com/$username/..."
EOF

echo ""
echo "📋 Once created, update src/main/html/index.html with the Schema UID"