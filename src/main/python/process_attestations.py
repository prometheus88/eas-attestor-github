#!/usr/bin/env python3
"""
Process new gist submissions and create attestations.

This script:
1. Fetches the last processed block height from state
2. Queries Basescan for new GistSubmitted events since that block
3. For each event, fetches and validates the GitHub Gist
4. Creates on-chain attestations for valid submissions
5. Updates the state file with the latest processed block
"""

import os
import json
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from web3 import Web3
from eth_account import Account
import requests
from github import Github

from utils.basescan import BasescanClient
from utils.gist_validator import GistValidator
from utils.state_manager import StateManager
from utils.contract import AttestationContract


def main():
    """Main attestation processing function."""
    try:
        # Load environment variables
        network = os.getenv("NETWORK", "sepolia")
        rpc_url = os.getenv("RPC_URL")
        private_key = os.getenv("PRIVATE_KEY")
        basescan_api_key = os.getenv("BASESCAN_API_KEY")
        github_token = os.getenv("GITHUB_TOKEN")
        
        if not all([rpc_url, private_key, basescan_api_key]):
            raise ValueError("Missing required environment variables")
        
        print(f"Processing attestations for network: {network}")
        
        # Initialize clients
        w3 = Web3(Web3.HTTPProvider(rpc_url))
        account = Account.from_key(private_key)
        basescan = BasescanClient(basescan_api_key, network)
        github = Github(github_token) if github_token else None
        state_manager = StateManager(network)
        
        # Get last processed block
        last_block = state_manager.get_last_processed_block()
        current_block = w3.eth.block_number
        
        print(f"Scanning from block {last_block} to {current_block}")
        
        # Fetch new gist submission events
        events = basescan.get_gist_submission_events(last_block, current_block)
        print(f"Found {len(events)} new gist submissions")
        
        if not events:
            print("No new submissions to process")
            state_manager.update_last_processed_block(current_block)
            return
        
        # Process each event
        processed_count = 0
        failed_count = 0
        
        for event in events:
            try:
                success = process_single_event(
                    event, w3, account, github, network
                )
                if success:
                    processed_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                print(f"Error processing event {event.get('transactionHash', 'unknown')}: {e}")
                failed_count += 1
        
        # Update state
        state_manager.update_last_processed_block(current_block)
        
        print(f"Processing complete: {processed_count} successful, {failed_count} failed")
        
    except Exception as e:
        print(f"Fatal error: {e}")
        sys.exit(1)


def process_single_event(
    event: Dict, 
    w3: Web3, 
    account: Account, 
    github: Optional[Github], 
    network: str
) -> bool:
    """Process a single GistSubmitted event."""
    try:
        # Extract event data
        gist_url = event.get("gist_url")
        submitter = event.get("submitter")
        tx_hash = event.get("transactionHash")
        
        print(f"Processing gist: {gist_url}")
        
        # Validate and fetch gist content
        validator = GistValidator(github)
        gist_data = validator.fetch_and_validate_gist(gist_url)
        
        if not gist_data:
            print(f"  ❌ Invalid gist: {gist_url}")
            return False
        
        # Verify the signature matches the submitter
        if not validator.verify_signature_matches_address(gist_data, submitter):
            print(f"  ❌ Signature mismatch for {gist_url}")
            return False
        
        # Create attestation on-chain
        contract = AttestationContract(w3, network)
        success = contract.create_attestation(
            account,
            gist_data["address"],
            gist_data["github_username"],
            gist_data
        )
        
        if success:
            print(f"  ✅ Created attestation for {gist_data['github_username']} -> {gist_data['address']}")
            return True
        else:
            print(f"  ❌ Failed to create attestation for {gist_url}")
            return False
            
    except Exception as e:
        print(f"  ❌ Error processing event: {e}")
        return False


if __name__ == "__main__":
    main()