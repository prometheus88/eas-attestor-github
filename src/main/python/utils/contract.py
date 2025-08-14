"""Smart contract interaction utilities."""

import json
from pathlib import Path
from typing import Dict, Optional

from web3 import Web3
from eth_account import Account


class AttestationContract:
    """Interface for interacting with attestation contracts."""
    
    def __init__(self, w3: Web3, network: str):
        self.w3 = w3
        self.network = network
        self._load_contract_info()
    
    def _load_contract_info(self):
        """Load contract addresses and ABIs from deployment artifacts."""
        try:
            # Load deployment info
            deployment_file = Path(f"deployments/{self.network}.json")
            
            if not deployment_file.exists():
                raise FileNotFoundError(f"Deployment file not found: {deployment_file}")
            
            with open(deployment_file, 'r') as f:
                deployment = json.load(f)
            
            self.attestation_registry_address = deployment["contracts"]["AttestationRegistry"]
            self.gist_submission_address = deployment["contracts"]["GistSubmission"]
            
            # Load ABIs from build artifacts
            self._load_abis()
            
        except Exception as e:
            print(f"Warning: Could not load contract info: {e}")
            # Use placeholder values for testing
            self._set_placeholder_values()
    
    def _load_abis(self):
        """Load contract ABIs from Foundry build artifacts."""
        try:
            # Load AttestationRegistry ABI
            registry_artifact = Path("out/AttestationRegistry.sol/AttestationRegistry.json")
            with open(registry_artifact, 'r') as f:
                registry_data = json.load(f)
            self.attestation_registry_abi = registry_data["abi"]
            
            # Load GistSubmission ABI  
            submission_artifact = Path("out/GistSubmission.sol/GistSubmission.json")
            with open(submission_artifact, 'r') as f:
                submission_data = json.load(f)
            self.gist_submission_abi = submission_data["abi"]
            
        except Exception as e:
            print(f"Error loading ABIs: {e}")
            # Use minimal ABIs for basic functionality
            self._set_minimal_abis()
    
    def _set_placeholder_values(self):
        """Set placeholder values for testing."""
        self.attestation_registry_address = "0x0000000000000000000000000000000000000000"
        self.gist_submission_address = "0x0000000000000000000000000000000000000000"
        self._set_minimal_abis()
    
    def _set_minimal_abis(self):
        """Set minimal ABIs for basic functionality."""
        self.attestation_registry_abi = [
            {
                "inputs": [
                    {"name": "ethAddress", "type": "address"},
                    {"name": "githubUsername", "type": "string"},
                    {"name": "gistUrl", "type": "string"}
                ],
                "name": "createAttestation",
                "type": "function"
            }
        ]
        
        self.gist_submission_abi = [
            {
                "inputs": [],
                "name": "GistSubmitted",
                "type": "event",
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "submitter", "type": "address"},
                    {"indexed": False, "name": "gistUrl", "type": "string"},
                    {"indexed": False, "name": "timestamp", "type": "uint256"}
                ]
            }
        ]
    
    def create_attestation(
        self, 
        account: Account, 
        eth_address: str, 
        github_username: str, 
        gist_data: Dict
    ) -> bool:
        """
        Create an attestation on-chain.
        
        Args:
            account: The account to sign the transaction
            eth_address: Ethereum address to attest
            github_username: GitHub username to link
            gist_data: Full gist data for reference
            
        Returns:
            True if attestation was created successfully
        """
        try:
            if self.attestation_registry_address == "0x0000000000000000000000000000000000000000":
                print("Warning: Using placeholder contract address")
                return False
            
            # Create contract instance
            contract = self.w3.eth.contract(
                address=self.attestation_registry_address,
                abi=self.attestation_registry_abi
            )
            
            # Prepare transaction
            gist_url = gist_data.get('gist_url', 'unknown')
            
            transaction = contract.functions.createAttestation(
                eth_address,
                github_username,
                gist_url
            ).build_transaction({
                'from': account.address,
                'nonce': self.w3.eth.get_transaction_count(account.address),
                'gas': 200000,  # Estimate gas
                'gasPrice': self.w3.to_wei('20', 'gwei'),
            })
            
            # Sign and send transaction
            signed_txn = account.sign_transaction(transaction)
            tx_hash = self.w3.eth.send_raw_transaction(signed_txn.rawTransaction)
            
            # Wait for confirmation
            receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
            
            if receipt.status == 1:
                print(f"Attestation created successfully: {tx_hash.hex()}")
                return True
            else:
                print(f"Transaction failed: {tx_hash.hex()}")
                return False
                
        except Exception as e:
            print(f"Error creating attestation: {e}")
            return False
    
    def get_attestation(self, eth_address: str) -> Optional[Dict]:
        """Get attestation details for an Ethereum address."""
        try:
            if self.attestation_registry_address == "0x0000000000000000000000000000000000000000":
                return None
            
            contract = self.w3.eth.contract(
                address=self.attestation_registry_address,
                abi=self.attestation_registry_abi
            )
            
            # This would need the full ABI with view functions
            # For now, return placeholder
            return None
            
        except Exception as e:
            print(f"Error getting attestation: {e}")
            return None
    
    def check_if_authorized_attestor(self, address: str) -> bool:
        """Check if an address is an authorized attestor."""
        try:
            if self.attestation_registry_address == "0x0000000000000000000000000000000000000000":
                return False
            
            contract = self.w3.eth.contract(
                address=self.attestation_registry_address,
                abi=self.attestation_registry_abi
            )
            
            # This would need the full ABI
            # For now, assume authorized
            return True
            
        except Exception as e:
            print(f"Error checking attestor authorization: {e}")
            return False


class GistSubmissionContract:
    """Interface for the GistSubmission contract events."""
    
    def __init__(self, w3: Web3, network: str):
        self.w3 = w3
        self.network = network
        self._load_contract_info()
    
    def _load_contract_info(self):
        """Load contract address and ABI."""
        # Similar to AttestationContract
        # This would be implemented when we have actual deployments
        pass
    
    def get_gist_submitted_events(self, from_block: int, to_block: int):
        """Get GistSubmitted events from the blockchain."""
        # This would be implemented to fetch events directly from the contract
        # For now, we rely on Basescan API in the basescan.py module
        pass