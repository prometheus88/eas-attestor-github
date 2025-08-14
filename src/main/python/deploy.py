#!/usr/bin/env python3
"""
Deploy contracts using Python wrapper around Forge.

This script handles deployment to different networks and updates
configuration files with deployed addresses.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Deploy contracts")
    parser.add_argument(
        "--network", 
        required=True, 
        choices=["sepolia", "mainnet"],
        help="Network to deploy to"
    )
    parser.add_argument(
        "--verify", 
        action="store_true", 
        default=True,
        help="Verify contracts on Basescan"
    )
    
    args = parser.parse_args()
    
    try:
        deploy_contracts(args.network, args.verify)
    except Exception as e:
        print(f"Deployment failed: {e}")
        sys.exit(1)


def deploy_contracts(network: str, verify: bool = True):
    """Deploy contracts to the specified network."""
    print(f"Deploying to {network} network...")
    
    # Check required environment variables
    required_vars = ["DEPLOY_PRIVATE_KEY"]
    if network == "mainnet":
        required_vars.extend(["BASE_MAINNET_RPC_URL", "BASESCAN_API_KEY"])
    else:
        required_vars.extend(["BASE_SEPOLIA_RPC_URL", "BASESCAN_SEPOLIA_API_KEY"])
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        raise ValueError(f"Missing environment variables: {missing_vars}")
    
    # Build contracts first
    print("Building contracts...")
    result = subprocess.run(["forge", "build"], capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Build failed: {result.stderr}")
    
    # Deploy using forge script
    print("Deploying contracts...")
    rpc_url = os.getenv(f"BASE_{network.upper()}_RPC_URL")
    private_key = os.getenv("DEPLOY_PRIVATE_KEY")
    
    cmd = [
        "forge", "script", 
        "src/solidity/script/Deploy.s.sol:DeployScript",
        "--rpc-url", rpc_url,
        "--private-key", private_key,
        "--broadcast"
    ]
    
    if verify:
        etherscan_key = os.getenv(f"BASESCAN{'_SEPOLIA' if network == 'sepolia' else ''}_API_KEY")
        cmd.extend(["--verify", "--etherscan-api-key", etherscan_key])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Deployment failed: {result.stderr}")
    
    print("✅ Deployment successful!")
    print(result.stdout)
    
    # Update configuration with deployed addresses
    update_config(network)


def update_config(network: str):
    """Update configuration files with deployed contract addresses."""
    try:
        # Parse deployment artifacts
        broadcast_dir = Path("broadcast")
        if not broadcast_dir.exists():
            print("Warning: No broadcast directory found")
            return
        
        # Find the latest deployment file
        # This is a simplified version - in practice you'd parse the actual artifacts
        print(f"Updating configuration for {network}...")
        
        # TODO: Parse broadcast artifacts and extract contract addresses
        # TODO: Update config files used by the dApp and Python scripts
        
    except Exception as e:
        print(f"Warning: Could not update configuration: {e}")


if __name__ == "__main__":
    main()