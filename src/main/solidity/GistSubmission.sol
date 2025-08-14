// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GistSubmission
 * @notice Contract for users to submit GitHub Gist URLs containing their verification data
 * @dev This contract allows users to submit gist URLs on-chain for automated processing
 */
contract GistSubmission is Ownable, ReentrancyGuard {
    
    constructor() Ownable(msg.sender) {}
    
    /**
     * @notice Emitted when a user submits a gist URL for verification
     * @param submitter The address that submitted the gist
     * @param gistUrl The GitHub Gist URL containing verification data
     * @param timestamp When the submission was made
     */
    event GistSubmitted(
        address indexed submitter,
        string gistUrl,
        uint256 timestamp
    );
    
    /**
     * @notice Mapping to track if a gist URL has already been submitted
     */
    mapping(bytes32 => bool) public submittedGists;
    
    /**
     * @notice Mapping to track submissions by address
     */
    mapping(address => string[]) public submissionsByAddress;
    
    /**
     * @notice Total number of submissions
     */
    uint256 public totalSubmissions;
    
    /**
     * @notice Submit a GitHub Gist URL for verification
     * @param gistUrl The URL of the GitHub Gist containing verification data
     * @dev The gist should contain a JSON with signature, address, and GitHub username
     */
    function submitGist(string calldata gistUrl) external nonReentrant {
        require(bytes(gistUrl).length > 0, "Gist URL cannot be empty");
        require(_isValidGistUrl(gistUrl), "Invalid GitHub Gist URL format");
        
        bytes32 gistHash = keccak256(bytes(gistUrl));
        require(!submittedGists[gistHash], "Gist URL already submitted");
        
        // Mark as submitted
        submittedGists[gistHash] = true;
        submissionsByAddress[msg.sender].push(gistUrl);
        totalSubmissions++;
        
        emit GistSubmitted(msg.sender, gistUrl, block.timestamp);
    }
    
    /**
     * @notice Get all submissions by a specific address
     * @param submitter The address to query
     * @return Array of gist URLs submitted by the address
     */
    function getSubmissionsByAddress(address submitter) external view returns (string[] memory) {
        return submissionsByAddress[submitter];
    }
    
    /**
     * @notice Check if a gist URL has been submitted
     * @param gistUrl The gist URL to check
     * @return True if the gist URL has been submitted
     */
    function isGistSubmitted(string calldata gistUrl) external view returns (bool) {
        bytes32 gistHash = keccak256(bytes(gistUrl));
        return submittedGists[gistHash];
    }
    
    /**
     * @notice Get the number of submissions by a specific address
     * @param submitter The address to query
     * @return Number of submissions
     */
    function getSubmissionCount(address submitter) external view returns (uint256) {
        return submissionsByAddress[submitter].length;
    }
    
    /**
     * @dev Internal function to validate GitHub Gist URL format
     * @param gistUrl The URL to validate
     * @return True if the URL appears to be a valid GitHub Gist URL
     */
    function _isValidGistUrl(string calldata gistUrl) internal pure returns (bool) {
        bytes memory urlBytes = bytes(gistUrl);
        
        // Check minimum length and https://gist.github.com/ prefix
        if (urlBytes.length < 25) return false;
        
        // Check for "https://gist.github.com/" prefix (case insensitive)
        bytes memory prefix = bytes("https://gist.github.com/");
        
        if (urlBytes.length < prefix.length) return false;
        
        for (uint i = 0; i < prefix.length; i++) {
            if (urlBytes[i] != prefix[i] && 
                urlBytes[i] != bytes1(uint8(prefix[i]) + 32)) { // Simple case conversion
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @notice Emergency function to pause contract (if needed for upgrades)
     * @dev Only owner can call this function
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = owner().call{value: balance}("");
            require(success, "Withdrawal failed");
        }
    }
}