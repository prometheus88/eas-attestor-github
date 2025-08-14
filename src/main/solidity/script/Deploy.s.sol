// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../GistSubmission.sol";
import "../AttestationRegistry.sol";

/**
 * @title Deploy Script
 * @notice Script to deploy the Contributor Attestation Service contracts
 */
contract DeployScript is Script {
    
    function run() external {
        // Get the deployer's private key from environment
        uint256 deployerPrivateKey = vm.envUint("DEPLOY_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with address:", deployer);
        console.log("Deployer balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy AttestationRegistry first
        AttestationRegistry attestationRegistry = new AttestationRegistry();
        console.log("AttestationRegistry deployed at:", address(attestationRegistry));
        
        // Deploy GistSubmission
        GistSubmission gistSubmission = new GistSubmission();
        console.log("GistSubmission deployed at:", address(gistSubmission));
        
        vm.stopBroadcast();
        
        // Log deployment information
        console.log("\n=== Deployment Summary ===");
        console.log("Network:", block.chainid);
        console.log("Block number:", block.number);
        console.log("AttestationRegistry:", address(attestationRegistry));
        console.log("GistSubmission:", address(gistSubmission));
        console.log("Deployer:", deployer);
        
        // Verify initial state
        console.log("\n=== Initial State ===");
        console.log("AttestationRegistry owner:", attestationRegistry.owner());
        console.log("AttestationRegistry total attestations:", attestationRegistry.totalAttestations());
        console.log("GistSubmission owner:", gistSubmission.owner());
        console.log("GistSubmission total submissions:", gistSubmission.totalSubmissions());
        
        // Save deployment addresses to file for later use
        _saveDeploymentAddresses(address(attestationRegistry), address(gistSubmission));
    }
    
    /**
     * @dev Save deployment addresses to a JSON file
     */
    function _saveDeploymentAddresses(address attestationRegistry, address gistSubmission) internal {
        string memory chainId = vm.toString(block.chainid);
        string memory networkName = _getNetworkName(block.chainid);
        
        string memory json = string.concat(
            '{\n',
            '  "network": "', networkName, '",\n',
            '  "chainId": ', chainId, ',\n',
            '  "blockNumber": ', vm.toString(block.number), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "AttestationRegistry": "', vm.toString(attestationRegistry), '",\n',
            '    "GistSubmission": "', vm.toString(gistSubmission), '"\n',
            '  },\n',
            '  "deployer": "', vm.toString(msg.sender), '"\n',
            '}'
        );
        
        string memory filename = string.concat("deployments/", networkName, ".json");
        vm.writeFile(filename, json);
        
        console.log("Deployment addresses saved to:", filename);
    }
    
    /**
     * @dev Get network name from chain ID
     */
    function _getNetworkName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == 8453) return "base";
        if (chainId == 84532) return "base-sepolia";
        if (chainId == 31337) return "anvil";
        return "unknown";
    }
}