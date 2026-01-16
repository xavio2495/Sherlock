// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ZKVerifier.sol";

contract ZKVerifierTest is Test {
    ZKVerifier public zkVerifier;

    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    // Test secrets
    string constant SECRET = "my_secret_credential";
    string constant NULLIFIER = "unique_nullifier_123";

    function setUp() public {
        vm.prank(owner);
        zkVerifier = new ZKVerifier();
    }

    function testRegisterCommitment() public {
        vm.startPrank(user1);
        
        // Generate commitment: keccak256(abi.encodePacked(secret, nullifier))
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        
        // Register commitment
        vm.expectEmit(true, false, false, true);
        emit ZKVerifier.CommitmentRegistered(user1, commitment, block.timestamp);
        zkVerifier.registerCommitment(commitment);
        
        // Verify commitment is stored
        assertTrue(zkVerifier.hasActiveCommitment(user1));
        
        ZKVerifier.Commitment memory storedCommit = zkVerifier.getCommitment(user1);
        assertEq(storedCommit.commitmentHash, commitment);
        assertEq(storedCommit.timestamp, block.timestamp);
        assertTrue(storedCommit.isActive);
        
        vm.stopPrank();
    }

    function testRegisterCommitmentFailsForZeroHash() public {
        vm.startPrank(user1);
        
        vm.expectRevert(ZKVerifier.ZeroCommitment.selector);
        zkVerifier.registerCommitment(bytes32(0));
        
        vm.stopPrank();
    }

    function testRegisterCommitmentFailsIfAlreadyExists() public {
        vm.startPrank(user1);
        
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        zkVerifier.registerCommitment(commitment);
        
        // Try to register again
        vm.expectRevert(ZKVerifier.CommitmentAlreadyExists.selector);
        zkVerifier.registerCommitment(commitment);
        
        vm.stopPrank();
    }

    function testVerifyEligibilitySuccess() public {
        // Register commitment for user1
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        // Create proof: the raw secret + nullifier
        bytes memory proof = abi.encodePacked(SECRET, NULLIFIER);
        
        // Verify eligibility
        bool isEligible = zkVerifier.verifyEligibility(user1, commitment, proof);
        assertTrue(isEligible);
    }

    function testVerifyEligibilityFailsWithWrongProof() public {
        // Register commitment for user1
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        // Create wrong proof
        bytes memory wrongProof = abi.encodePacked("wrong_secret", NULLIFIER);
        
        // Verify should fail
        bool isEligible = zkVerifier.verifyEligibility(user1, commitment, wrongProof);
        assertFalse(isEligible);
    }

    function testVerifyEligibilityFailsForUnregisteredUser() public {
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        bytes memory proof = abi.encodePacked(SECRET, NULLIFIER);
        
        // user1 has no commitment registered
        bool isEligible = zkVerifier.verifyEligibility(user1, commitment, proof);
        assertFalse(isEligible);
    }

    function testVerifyEligibilityFailsWithEmptyProof() public {
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        bytes memory emptyProof = "";
        bool isEligible = zkVerifier.verifyEligibility(user1, commitment, emptyProof);
        assertFalse(isEligible);
    }

    function testVerifyRangeProof() public {
        // Register commitment for user1
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        // Set range commitment for token with actual amount
        uint256 tokenId = 1;
        uint256 actualAmount = 50; // Holder has 50 tokens
        bytes32 rangeCommitment = keccak256(abi.encodePacked(tokenId, user1, actualAmount));
        vm.prank(user1);
        zkVerifier.setRangeCommitment(tokenId, user1, rangeCommitment);
        
        // Create range proof with actual amount (MVP format)
        uint256 minRange = 10;
        uint256 maxRange = 100;
        bytes memory proof = abi.encodePacked(actualAmount); // Proof contains actual amount
        
        // Verify range proof (MVP verifies actualAmount is in [minRange, maxRange])
        bool isValid = zkVerifier.verifyRangeProof(tokenId, user1, minRange, maxRange, proof);
        assertTrue(isValid);
    }

    function testVerifyRangeProofFailsWithInvalidRange() public {
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        uint256 tokenId = 1;
        uint256 minRange = 100;
        uint256 maxRange = 10; // Invalid: min > max
        bytes memory proof = abi.encodePacked("proof");
        
        bool isValid = zkVerifier.verifyRangeProof(tokenId, user1, minRange, maxRange, proof);
        assertFalse(isValid);
    }

    function testVerifyRangeProofFailsForUnregisteredUser() public {
        uint256 tokenId = 1;
        uint256 minRange = 10;
        uint256 maxRange = 100;
        bytes memory proof = abi.encodePacked("proof");
        
        // user1 has no commitment
        bool isValid = zkVerifier.verifyRangeProof(tokenId, user1, minRange, maxRange, proof);
        assertFalse(isValid);
    }

    function testSetRangeCommitment() public {
        uint256 tokenId = 1;
        bytes32 rangeCommitment = keccak256("my_range_commitment");
        
        vm.expectEmit(true, true, false, true);
        emit ZKVerifier.RangeCommitmentSet(tokenId, user1, rangeCommitment);
        
        vm.prank(user1);
        zkVerifier.setRangeCommitment(tokenId, user1, rangeCommitment);
    }

    function testRevokeCommitment() public {
        // Register commitment
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        assertTrue(zkVerifier.hasActiveCommitment(user1));
        
        // Owner revokes commitment
        vm.prank(owner);
        vm.expectEmit(true, false, false, false);
        emit ZKVerifier.CommitmentRevoked(user1);
        zkVerifier.revokeCommitment(user1);
        
        assertFalse(zkVerifier.hasActiveCommitment(user1));
    }

    function testRevokeCommitmentFailsForNonOwner() public {
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        // user2 tries to revoke (not owner)
        vm.prank(user2);
        vm.expectRevert();
        zkVerifier.revokeCommitment(user1);
    }

    function testUpdateHolderVerification() public {
        uint256 tokenId = 1;
        
        vm.prank(owner);
        zkVerifier.updateHolderVerification(tokenId, user1, true);
        
        (bool isVerified) = zkVerifier.tokenHolderVerified(tokenId, user1);
        assertTrue(isVerified);
    }

    function testBatchRegisterCommitments() public {
        address[] memory users = new address[](3);
        users[0] = address(10);
        users[1] = address(11);
        users[2] = address(12);
        
        bytes32[] memory commitments = new bytes32[](3);
        commitments[0] = keccak256("commitment1");
        commitments[1] = keccak256("commitment2");
        commitments[2] = keccak256("commitment3");
        
        vm.prank(owner);
        zkVerifier.batchRegisterCommitments(users, commitments);
        
        // Verify all commitments were registered
        assertTrue(zkVerifier.hasActiveCommitment(users[0]));
        assertTrue(zkVerifier.hasActiveCommitment(users[1]));
        assertTrue(zkVerifier.hasActiveCommitment(users[2]));
    }

    function testBatchRegisterCommitmentsSkipsZeroAndDuplicates() public {
        // Register one commitment first
        vm.prank(address(10));
        zkVerifier.registerCommitment(keccak256("existing"));
        
        address[] memory users = new address[](3);
        users[0] = address(10); // Already exists
        users[1] = address(11);
        users[2] = address(12);
        
        bytes32[] memory commitments = new bytes32[](3);
        commitments[0] = keccak256("duplicate");
        commitments[1] = bytes32(0); // Zero commitment
        commitments[2] = keccak256("valid");
        
        vm.prank(owner);
        zkVerifier.batchRegisterCommitments(users, commitments);
        
        // Only address(12) should have new commitment
        assertTrue(zkVerifier.hasActiveCommitment(address(12)));
        
        // address(11) should not have commitment (was zero)
        assertFalse(zkVerifier.hasActiveCommitment(address(11)));
    }

    function testGetCommitment() public {
        bytes32 commitment = keccak256(abi.encodePacked(SECRET, NULLIFIER));
        vm.prank(user1);
        zkVerifier.registerCommitment(commitment);
        
        ZKVerifier.Commitment memory retrievedCommit = zkVerifier.getCommitment(user1);
        assertEq(retrievedCommit.commitmentHash, commitment);
        assertTrue(retrievedCommit.isActive);
    }
}
