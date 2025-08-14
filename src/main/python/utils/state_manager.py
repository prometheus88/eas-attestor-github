"""State management for tracking last processed block heights."""

import json
from pathlib import Path
from typing import Optional


class StateManager:
    """Manages persistent state for the attestation processor."""
    
    def __init__(self, network: str):
        self.network = network
        self.state_dir = Path("state")
        self.state_file = self.state_dir / f"{network}_state.json"
        
        # Ensure state directory exists
        self.state_dir.mkdir(exist_ok=True)
    
    def get_last_processed_block(self) -> int:
        """Get the last processed block height for this network."""
        try:
            if not self.state_file.exists():
                # Return a reasonable starting block (recent history)
                # This should be set to deployment block in production
                return self._get_default_starting_block()
            
            with open(self.state_file, 'r') as f:
                data = json.load(f)
                return data.get("last_processed_block", self._get_default_starting_block())
                
        except Exception as e:
            print(f"Warning: Could not read state file: {e}")
            return self._get_default_starting_block()
    
    def update_last_processed_block(self, block_number: int) -> None:
        """Update the last processed block height."""
        try:
            # Load existing data or create new
            data = {}
            if self.state_file.exists():
                with open(self.state_file, 'r') as f:
                    data = json.load(f)
            
            data["last_processed_block"] = block_number
            data["network"] = self.network
            
            with open(self.state_file, 'w') as f:
                json.dump(data, f, indent=2)
                
        except Exception as e:
            print(f"Error updating state file: {e}")
            raise
    
    def _get_default_starting_block(self) -> int:
        """Get default starting block based on network."""
        # These should be updated to actual deployment blocks
        defaults = {
            "sepolia": 7000000,  # Approximate recent Base Sepolia block
            "mainnet": 10000000,  # Approximate recent Base mainnet block
        }
        return defaults.get(self.network, 0)