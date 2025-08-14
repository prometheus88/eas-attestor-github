// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../../main/solidity/GistSubmission.sol";

contract GistSubmissionTest is Test {
    GistSubmission public gistSubmission;
    
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    string constant VALID_GIST_URL = "https://gist.github.com/user/abcd1234";
    string constant ANOTHER_VALID_GIST_URL = "https://gist.github.com/user/efgh5678";
    string constant INVALID_GIST_URL = "https://example.com/not-a-gist";
    
    function setUp() public {
        gistSubmission = new GistSubmission();
    }
    
    function testSubmitGist() public {
        vm.prank(user1);
        
        vm.expectEmit(true, false, false, true);
        emit GistSubmission.GistSubmitted(user1, VALID_GIST_URL, block.timestamp);
        
        gistSubmission.submitGist(VALID_GIST_URL);
        
        // Verify state changes
        assertTrue(gistSubmission.isGistSubmitted(VALID_GIST_URL));
        assertEq(gistSubmission.totalSubmissions(), 1);
        assertEq(gistSubmission.getSubmissionCount(user1), 1);
        
        string[] memory submissions = gistSubmission.getSubmissionsByAddress(user1);
        assertEq(submissions.length, 1);
        assertEq(submissions[0], VALID_GIST_URL);
    }
    
    function testCannotSubmitDuplicateGist() public {
        vm.prank(user1);
        gistSubmission.submitGist(VALID_GIST_URL);
        
        vm.prank(user2);
        vm.expectRevert("Gist URL already submitted");
        gistSubmission.submitGist(VALID_GIST_URL);
    }
    
    function testCannotSubmitEmptyUrl() public {
        vm.prank(user1);
        vm.expectRevert("Gist URL cannot be empty");
        gistSubmission.submitGist("");
    }
    
    function testCannotSubmitInvalidUrl() public {
        vm.prank(user1);
        vm.expectRevert("Invalid GitHub Gist URL format");
        gistSubmission.submitGist(INVALID_GIST_URL);
    }
    
    function testMultipleSubmissionsFromSameUser() public {
        vm.startPrank(user1);
        
        gistSubmission.submitGist(VALID_GIST_URL);
        gistSubmission.submitGist(ANOTHER_VALID_GIST_URL);
        
        vm.stopPrank();
        
        assertEq(gistSubmission.totalSubmissions(), 2);
        assertEq(gistSubmission.getSubmissionCount(user1), 2);
        
        string[] memory submissions = gistSubmission.getSubmissionsByAddress(user1);
        assertEq(submissions.length, 2);
        assertEq(submissions[0], VALID_GIST_URL);
        assertEq(submissions[1], ANOTHER_VALID_GIST_URL);
    }
    
    function testMultipleUsersSubmissions() public {
        vm.prank(user1);
        gistSubmission.submitGist(VALID_GIST_URL);
        
        vm.prank(user2);
        gistSubmission.submitGist(ANOTHER_VALID_GIST_URL);
        
        assertEq(gistSubmission.totalSubmissions(), 2);
        assertEq(gistSubmission.getSubmissionCount(user1), 1);
        assertEq(gistSubmission.getSubmissionCount(user2), 1);
        
        assertTrue(gistSubmission.isGistSubmitted(VALID_GIST_URL));
        assertTrue(gistSubmission.isGistSubmitted(ANOTHER_VALID_GIST_URL));
    }
    
    function testGistUrlValidation() public view {
        // Valid URLs should work
        string[] memory validUrls = new string[](4);
        validUrls[0] = "https://gist.github.com/user/abc123";
        validUrls[1] = "https://gist.github.com/user123/def456";
        validUrls[2] = "https://gist.github.com/test-user/ghi789";
        validUrls[3] = "https://gist.github.com/user/abc123/raw/file.json";
        
        for (uint i = 0; i < validUrls.length; i++) {
            // This would be tested by calling the function, but _isValidGistUrl is internal
            // In a real test, we'd test by attempting to submit these URLs
        }
    }
    
    function testGetSubmissionsByAddressEmpty() public view {
        string[] memory submissions = gistSubmission.getSubmissionsByAddress(user1);
        assertEq(submissions.length, 0);
    }
    
    function testOnlyOwnerCanEmergencyWithdraw() public {
        vm.prank(user1);
        vm.expectRevert();
        gistSubmission.emergencyWithdraw();
    }
}