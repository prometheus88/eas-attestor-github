// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AttestationRegistry
 * @notice Registry for GitHub username to Ethereum address attestations
 * @dev This contract stores verified attestations linking GitHub usernames to Ethereum addresses
 */
contract AttestationRegistry is Ownable, ReentrancyGuard {
    
    /**
     * @notice Structure representing an attestation
     */
    struct Attestation {
        address ethAddress;      // Ethereum address
        string githubUsername;   // GitHub username
        string gistUrl;         // Source gist URL
        uint256 timestamp;      // When attestation was created
        address attestor;       // Who created the attestation (should be automated system)
        bool isValid;          // Whether attestation is still valid
    }
    
    /**
     * @notice Emitted when a new attestation is created
     */
    event AttestationCreated(
        address indexed ethAddress,
        string indexed githubUsername,
        string gistUrl,
        address indexed attestor,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when an attestation is revoked
     */
    event AttestationRevoked(
        address indexed ethAddress,
        string indexed githubUsername,
        address indexed revoker,
        uint256 timestamp
    );
    
    /**
     * @notice Mapping from Ethereum address to GitHub username
     */
    mapping(address => string) public addressToGithub;
    
    /**
     * @notice Mapping from GitHub username to Ethereum address
     */
    mapping(string => address) public githubToAddress;
    
    /**
     * @notice Mapping to store full attestation details
     */
    mapping(address => Attestation) public attestations;
    
    /**
     * @notice Mapping of authorized attestors (automated systems)
     */
    mapping(address => bool) public authorizedAttestors;
    
    /**
     * @notice Total number of active attestations
     */
    uint256 public totalAttestations;
    
    /**
     * @dev Modifier to check if caller is an authorized attestor
     */
    modifier onlyAttestor() {
        require(authorizedAttestors[msg.sender], "Not an authorized attestor");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        // Owner is initially an authorized attestor
        authorizedAttestors[msg.sender] = true;
    }
    
    /**
     * @notice Add an authorized attestor
     * @param attestor The address to authorize
     */
    function addAttestor(address attestor) external onlyOwner {
        require(attestor != address(0), "Invalid attestor address");
        authorizedAttestors[attestor] = true;
    }
    
    /**
     * @notice Remove an authorized attestor
     * @param attestor The address to remove authorization from
     */
    function removeAttestor(address attestor) external onlyOwner {
        authorizedAttestors[attestor] = false;
    }
    
    /**
     * @notice Create a new attestation
     * @param ethAddress The Ethereum address to attest
     * @param githubUsername The GitHub username to link
     * @param gistUrl The source gist URL
     */
    function createAttestation(
        address ethAddress,
        string calldata githubUsername,
        string calldata gistUrl
    ) external onlyAttestor nonReentrant {
        require(ethAddress != address(0), "Invalid Ethereum address");
        require(bytes(githubUsername).length > 0, "GitHub username cannot be empty");
        require(bytes(gistUrl).length > 0, "Gist URL cannot be empty");
        
        // Check for existing conflicting attestations
        require(
            bytes(addressToGithub[ethAddress]).length == 0 || 
            keccak256(bytes(addressToGithub[ethAddress])) == keccak256(bytes(githubUsername)),
            "Address already linked to different GitHub username"
        );
        
        require(
            githubToAddress[githubUsername] == address(0) ||
            githubToAddress[githubUsername] == ethAddress,
            "GitHub username already linked to different address"
        );
        
        // If this is a new attestation (not updating existing), increment counter
        bool isNewAttestation = bytes(addressToGithub[ethAddress]).length == 0;
        
        // Create the attestation
        addressToGithub[ethAddress] = githubUsername;
        githubToAddress[githubUsername] = ethAddress;
        
        attestations[ethAddress] = Attestation({
            ethAddress: ethAddress,
            githubUsername: githubUsername,
            gistUrl: gistUrl,
            timestamp: block.timestamp,
            attestor: msg.sender,
            isValid: true
        });
        
        if (isNewAttestation) {
            totalAttestations++;
        }
        
        emit AttestationCreated(ethAddress, githubUsername, gistUrl, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Revoke an attestation
     * @param ethAddress The Ethereum address whose attestation to revoke
     */
    function revokeAttestation(address ethAddress) external onlyAttestor {
        require(bytes(addressToGithub[ethAddress]).length > 0, "No attestation exists for this address");
        
        string memory githubUsername = addressToGithub[ethAddress];
        
        // Remove mappings
        delete addressToGithub[ethAddress];
        delete githubToAddress[githubUsername];
        
        // Mark as invalid
        attestations[ethAddress].isValid = false;
        totalAttestations--;
        
        emit AttestationRevoked(ethAddress, githubUsername, msg.sender, block.timestamp);
    }
    
    /**
     * @notice Get GitHub username for an Ethereum address
     * @param ethAddress The Ethereum address to query
     * @return The linked GitHub username, or empty string if none
     */
    function getGithubUsername(address ethAddress) external view returns (string memory) {
        return addressToGithub[ethAddress];
    }
    
    /**
     * @notice Get Ethereum address for a GitHub username
     * @param githubUsername The GitHub username to query
     * @return The linked Ethereum address, or zero address if none
     */
    function getEthAddress(string calldata githubUsername) external view returns (address) {
        return githubToAddress[githubUsername];
    }
    
    /**
     * @notice Get full attestation details
     * @param ethAddress The Ethereum address to query
     * @return The attestation struct
     */
    function getAttestation(address ethAddress) external view returns (Attestation memory) {
        return attestations[ethAddress];
    }
    
    /**
     * @notice Check if an address has a valid attestation
     * @param ethAddress The Ethereum address to check
     * @return True if the address has a valid attestation
     */
    function hasValidAttestation(address ethAddress) external view returns (bool) {
        return attestations[ethAddress].isValid && bytes(addressToGithub[ethAddress]).length > 0;
    }
    
    /**
     * @notice Check if a GitHub username has a valid attestation
     * @param githubUsername The GitHub username to check
     * @return True if the username has a valid attestation
     */
    function githubHasValidAttestation(string calldata githubUsername) external view returns (bool) {
        address ethAddress = githubToAddress[githubUsername];
        return ethAddress != address(0) && attestations[ethAddress].isValid;
    }
}