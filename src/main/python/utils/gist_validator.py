"""GitHub Gist validation and content fetching."""

import json
import re
from typing import Dict, Optional
from urllib.parse import urlparse

import requests
from eth_account.messages import encode_defunct
from web3 import Web3
from github import Github


class GistValidator:
    """Validates GitHub Gists containing verification data."""
    
    def __init__(self, github_client: Optional[Github] = None):
        self.github = github_client
    
    def fetch_and_validate_gist(self, gist_url: str) -> Optional[Dict]:
        """
        Fetch and validate a GitHub Gist containing verification data.
        
        Args:
            gist_url: The GitHub Gist URL
            
        Returns:
            Dictionary containing validated gist data, or None if invalid
        """
        try:
            # Extract gist ID from URL
            gist_id = self._extract_gist_id(gist_url)
            if not gist_id:
                print(f"Invalid gist URL format: {gist_url}")
                return None
            
            # Fetch gist content
            gist_data = self._fetch_gist_content(gist_id)
            if not gist_data:
                return None
            
            # Validate the JSON structure
            if not self._validate_json_structure(gist_data):
                return None
            
            # Validate signature
            if not self._validate_signature(gist_data):
                return None
            
            # Validate timestamp (not too old)
            if not self._validate_timestamp(gist_data):
                return None
            
            return gist_data
            
        except Exception as e:
            print(f"Error validating gist {gist_url}: {e}")
            return None
    
    def verify_signature_matches_address(self, gist_data: Dict, submitter_address: str) -> bool:
        """
        Verify that the signature in the gist matches the submitter address.
        
        Args:
            gist_data: The validated gist data
            submitter_address: The address that submitted the gist
            
        Returns:
            True if signature matches the submitter address
        """
        try:
            # The signature should recover to the submitter address
            recovered_address = self._recover_address_from_signature(gist_data)
            
            return (recovered_address and 
                    recovered_address.lower() == submitter_address.lower())
                    
        except Exception as e:
            print(f"Error verifying signature match: {e}")
            return False
    
    def _extract_gist_id(self, gist_url: str) -> Optional[str]:
        """Extract gist ID from GitHub Gist URL."""
        try:
            # Parse URL
            parsed = urlparse(gist_url)
            
            # Check if it's a GitHub gist
            if parsed.netloc != 'gist.github.com':
                return None
            
            # Extract path and get gist ID
            path_parts = parsed.path.strip('/').split('/')
            if len(path_parts) < 2:
                return None
            
            # Gist ID is typically the second part: /username/gist_id
            gist_id = path_parts[1]
            
            # Validate gist ID format (hexadecimal string)
            if not re.match(r'^[a-fA-F0-9]+$', gist_id):
                return None
            
            return gist_id
            
        except Exception:
            return None
    
    def _fetch_gist_content(self, gist_id: str) -> Optional[Dict]:
        """Fetch gist content from GitHub API."""
        try:
            if self.github:
                # Use authenticated GitHub client
                gist = self.github.get_gist(gist_id)
                
                # Look for verification file
                for filename, file_obj in gist.files.items():
                    if filename.endswith('.json') or 'verification' in filename.lower():
                        return json.loads(file_obj.content)
            
            # Fallback to public API
            url = f"https://api.github.com/gists/{gist_id}"
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            gist_data = response.json()
            
            # Find the verification JSON file
            for filename, file_info in gist_data.get('files', {}).items():
                if (filename.endswith('.json') or 
                    'verification' in filename.lower() or
                    'attestation' in filename.lower()):
                    
                    content = file_info.get('content', '')
                    if content:
                        return json.loads(content)
            
            print(f"No verification JSON found in gist {gist_id}")
            return None
            
        except Exception as e:
            print(f"Error fetching gist content: {e}")
            return None
    
    def _validate_json_structure(self, data: Dict) -> bool:
        """Validate that the JSON has required fields."""
        required_fields = [
            'message',
            'signature', 
            'address',
            'github_username',
            'timestamp'
        ]
        
        for field in required_fields:
            if field not in data:
                print(f"Missing required field: {field}")
                return False
            
            if not data[field]:
                print(f"Empty required field: {field}")
                return False
        
        # Validate address format
        if not Web3.is_address(data['address']):
            print(f"Invalid Ethereum address: {data['address']}")
            return False
        
        # Validate signature format
        if not data['signature'].startswith('0x') or len(data['signature']) != 132:
            print(f"Invalid signature format: {data['signature']}")
            return False
        
        return True
    
    def _validate_signature(self, data: Dict) -> bool:
        """Validate the cryptographic signature."""
        try:
            message = data['message']
            signature = data['signature']
            expected_address = data['address']
            
            # Create the message hash
            message_hash = encode_defunct(text=message)
            
            # Recover the address from signature
            recovered_address = Web3().eth.account.recover_message(message_hash, signature=signature)
            
            # Check if recovered address matches claimed address
            if recovered_address.lower() != expected_address.lower():
                print(f"Signature verification failed: {recovered_address} != {expected_address}")
                return False
            
            return True
            
        except Exception as e:
            print(f"Error validating signature: {e}")
            return False
    
    def _validate_timestamp(self, data: Dict, max_age_hours: int = 24) -> bool:
        """Validate that the timestamp is recent enough."""
        try:
            import time
            
            timestamp = int(data['timestamp'])
            current_time = int(time.time())
            
            # Check if timestamp is too old
            max_age_seconds = max_age_hours * 3600
            if current_time - timestamp > max_age_seconds:
                print(f"Gist is too old: {current_time - timestamp} seconds ago")
                return False
            
            # Check if timestamp is in the future (with 5 minute tolerance)
            if timestamp > current_time + 300:
                print(f"Gist timestamp is in the future: {timestamp} vs {current_time}")
                return False
            
            return True
            
        except Exception as e:
            print(f"Error validating timestamp: {e}")
            return False
    
    def _recover_address_from_signature(self, data: Dict) -> Optional[str]:
        """Recover Ethereum address from message signature."""
        try:
            message = data['message']
            signature = data['signature']
            
            message_hash = encode_defunct(text=message)
            recovered_address = Web3().eth.account.recover_message(message_hash, signature=signature)
            
            return recovered_address
            
        except Exception as e:
            print(f"Error recovering address: {e}")
            return None