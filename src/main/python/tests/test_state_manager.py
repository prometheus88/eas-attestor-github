"""Tests for StateManager."""

import json
import tempfile
from pathlib import Path
import pytest

from scripts.task.app.utils.state_manager import StateManager


class TestStateManager:
    
    def test_initial_state(self, tmp_path):
        """Test initial state when no state file exists."""
        # Change to temp directory for isolation
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)
            
            manager = StateManager("sepolia")
            block = manager.get_last_processed_block()
            
            assert isinstance(block, int)
            assert block > 0  # Should return a reasonable default
            
        finally:
            os.chdir(original_cwd)
    
    def test_state_persistence(self, tmp_path):
        """Test that state is properly saved and loaded."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)
            
            manager = StateManager("sepolia")
            
            # Update state
            test_block = 12345
            manager.update_last_processed_block(test_block)
            
            # Create new manager instance and verify state persisted
            new_manager = StateManager("sepolia")
            loaded_block = new_manager.get_last_processed_block()
            
            assert loaded_block == test_block
            
        finally:
            os.chdir(original_cwd)
    
    def test_network_isolation(self, tmp_path):
        """Test that different networks have separate state."""
        original_cwd = Path.cwd()
        try:
            import os
            os.chdir(tmp_path)
            
            sepolia_manager = StateManager("sepolia")
            mainnet_manager = StateManager("mainnet")
            
            # Set different blocks for each network
            sepolia_manager.update_last_processed_block(1000)
            mainnet_manager.update_last_processed_block(2000)
            
            # Verify isolation
            assert sepolia_manager.get_last_processed_block() == 1000
            assert mainnet_manager.get_last_processed_block() == 2000
            
        finally:
            os.chdir(original_cwd)