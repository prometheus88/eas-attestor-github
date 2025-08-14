"""Basescan API client for fetching blockchain events."""

import requests
import time
from typing import Dict, List, Optional
from urllib.parse import urlencode


class BasescanClient:
    """Client for interacting with Basescan API."""
    
    def __init__(self, api_key: str, network: str):
        self.api_key = api_key
        self.network = network
        
        # API endpoints
        self.endpoints = {
            "mainnet": "https://api.basescan.org/api",
            "sepolia": "https://api-sepolia.basescan.org/api"
        }
        
        self.base_url = self.endpoints.get(network)
        if not self.base_url:
            raise ValueError(f"Unsupported network: {network}")
    
    def get_gist_submission_events(
        self, 
        from_block: int, 
        to_block: int,
        contract_address: Optional[str] = None
    ) -> List[Dict]:
        """
        Fetch GistSubmitted events from the contract.
        
        Args:
            from_block: Starting block number
            to_block: Ending block number  
            contract_address: Contract address (will be loaded from config if not provided)
        
        Returns:
            List of event dictionaries
        """
        try:
            # TODO: Load contract address from deployment artifacts
            if not contract_address:
                contract_address = self._get_contract_address()
            
            # GistSubmitted event signature
            # event GistSubmitted(address indexed submitter, string gistUrl, uint256 timestamp);
            topic0 = "0x" + "GistSubmitted(address,string,uint256)".encode().hex()
            
            params = {
                "module": "logs",
                "action": "getLogs", 
                "address": contract_address,
                "topic0": topic0,
                "fromBlock": hex(from_block),
                "toBlock": hex(to_block),
                "apikey": self.api_key
            }
            
            response = self._make_request(params)
            
            if response.get("status") == "1":
                events = []
                for log in response.get("result", []):
                    try:
                        event = self._parse_gist_submitted_event(log)
                        if event:
                            events.append(event)
                    except Exception as e:
                        print(f"Warning: Could not parse event log: {e}")
                
                return events
            else:
                print(f"Basescan API error: {response.get('message', 'Unknown error')}")
                return []
                
        except Exception as e:
            print(f"Error fetching events: {e}")
            return []
    
    def _make_request(self, params: Dict) -> Dict:
        """Make API request with rate limiting."""
        url = f"{self.base_url}?{urlencode(params)}"
        
        for attempt in range(3):
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                data = response.json()
                
                # Handle rate limiting
                if data.get("message") == "NOTOK" and "rate limit" in str(data.get("result", "")).lower():
                    if attempt < 2:
                        print("Rate limited, waiting 5 seconds...")
                        time.sleep(5)
                        continue
                
                return data
                
            except Exception as e:
                if attempt < 2:
                    print(f"Request failed (attempt {attempt + 1}/3): {e}")
                    time.sleep(2)
                    continue
                raise
        
        raise Exception("Failed to make request after 3 attempts")
    
    def _parse_gist_submitted_event(self, log: Dict) -> Optional[Dict]:
        """Parse a GistSubmitted event log into structured data."""
        try:
            # Extract submitter from topics[1] (indexed parameter)
            submitter = "0x" + log["topics"][1][-40:]
            
            # Decode the data field to get gistUrl and timestamp
            # This is a simplified version - in practice you'd use web3.py for proper ABI decoding
            data = log["data"][2:]  # Remove 0x prefix
            
            # For now, return basic event data
            # TODO: Implement proper ABI decoding
            return {
                "submitter": submitter,
                "gist_url": "placeholder",  # Will be properly decoded
                "timestamp": int(log["timeStamp"], 16) if log["timeStamp"].startswith("0x") else int(log["timeStamp"]),
                "transactionHash": log["transactionHash"],
                "blockNumber": int(log["blockNumber"], 16),
            }
            
        except Exception as e:
            print(f"Error parsing event log: {e}")
            return None
    
    def _get_contract_address(self) -> str:
        """Get contract address for the current network."""
        # TODO: Load from deployment artifacts or config
        addresses = {
            "sepolia": "0x0000000000000000000000000000000000000000",  # Placeholder
            "mainnet": "0x0000000000000000000000000000000000000000",  # Placeholder
        }
        
        address = addresses.get(self.network)
        if not address or address == "0x0000000000000000000000000000000000000000":
            raise ValueError(f"Contract address not configured for network: {self.network}")
        
        return address