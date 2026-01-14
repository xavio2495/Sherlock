// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ZKVerifier.sol";

contract ZKVerifierTest is Test {
    ZKVerifier public zkVerifier;

    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    function setUp() public {
        vm.prank(owner);
        zkVerifier = new ZKVerifier();
    }

    function testRegisterCommitment() public {
        vm.startPrank(user1);
        
        bytes32 commitment = keccak256(abi.encodePacked("secret", "nullifier"));
        
        // TODO: Uncomment when implementation is ready
        // zkVerifier.registerCommitment(commitment);
        
        // bool hasCommitment = zkVerifier.hasActiveCommitment(user1);
        // assertTrue(hasCommitment);
        
        vm.stopPrank();
    }

    function testVerifyEligibility() public view {
        // TODO: Test eligibility verification with mock proof
        bytes32 commitment = keccak256(abi.encodePacked("secret", "nullifier"));
        bytes memory mockProof = abi.encode("mock_proof_data");
        
        // bool isEligible = zkVerifier.verifyEligibility(user1, commitment, mockProof);
        // assertTrue(isEligible);
    }

    function testVerifyRangeProof() public view {
        // TODO: Test range proof verification
        uint256 tokenId = 1;
        uint256 minRange = 10;
        uint256 maxRange = 100;
        bytes memory mockProof = abi.encode("mock_range_proof");
        
        // bool isValid = zkVerifier.verifyRangeProof(
        //     tokenId,
        //     user1,
        //     minRange,
        //     maxRange,
        //     mockProof
        // );
    }

    function testRevokeCommitment() public {
        // TODO: Test commitment revocation by owner
        vm.startPrank(owner);
        // zkVerifier.revokeCommitment(user1);
        vm.stopPrank();
    }

    function testFailUnauthorizedRevoke() public {
        // Should fail when non-owner tries to revoke
        vm.prank(user2);
        zkVerifier.revokeCommitment(user1);
    }
}
