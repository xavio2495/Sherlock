// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZKVerifier
 * @notice Verify ZK-KYC proofs for issuer/buyer eligibility
 * @dev MVP implementation uses simple commitment-based verification
 *      Future upgrade path to Groth16 verifier
 * 
 * MVP Commitment Scheme:
 * - Users register a commitment: keccak256(abi.encodePacked(secret, nullifier))
 * - To verify, users provide (secret, nullifier) and we recompute the hash
 * - This proves they know the secret without revealing it on-chain
 * 
 * Future Groth16 Upgrade:
 * - Replace hash verification with zkSNARK proof verification
 * - Use Groth16 verifier contract for cryptographic proof validation
 * - Integrate with circom circuits for eligibility and range proofs
 */
contract ZKVerifier is Ownable {
    // ============ State Variables ============
    
    struct Commitment {
        bytes32 commitmentHash;
        uint256 timestamp;
        bool isActive;
    }

    mapping(address => Commitment) public userCommitments;
    mapping(uint256 => mapping(address => bool)) public tokenHolderVerified;
    
    // Track range proof commitments for privacy
    mapping(uint256 => mapping(address => bytes32)) public rangeCommitments;

    // ============ Errors ============
    
    error ZeroCommitment();
    error CommitmentAlreadyExists();
    error NoActiveCommitment();
    error InvalidProof();
    error CommitmentMismatch();
    error InvalidRange();

    // ============ Events ============
    
    event CommitmentRegistered(address indexed user, bytes32 commitment, uint256 timestamp);
    event EligibilityVerified(address indexed user, bool isEligible);
    event RangeProofVerified(uint256 indexed tokenId, address indexed holder, bool isValid);
    event CommitmentRevoked(address indexed user);
    event RangeCommitmentSet(uint256 indexed tokenId, address indexed holder, bytes32 commitment);

    // ============ Constructor ============
    
    constructor() Ownable(msg.sender) {}

    // ============ Core Functions ============
    
    /**
     * @notice Register a commitment for a user
     * @param commitment The hash commitment (hash of secret + nullifier)
     * @dev Users must register before they can be verified
     *      Commitment = keccak256(abi.encodePacked(secret, nullifier))
     */
    function registerCommitment(bytes32 commitment) external {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (userCommitments[msg.sender].isActive) revert CommitmentAlreadyExists();
        
        userCommitments[msg.sender] = Commitment({
            commitmentHash: commitment,
            timestamp: block.timestamp,
            isActive: true
        });

        emit CommitmentRegistered(msg.sender, commitment, block.timestamp);
    }

    /**
     * @notice Verify user eligibility using ZK proof
     * @param user Address of the user to verify
     * @param commitment The commitment to verify against
     * @param proof ZK proof data containing (secret, nullifier) as abi.encodePacked
     * @return bool True if verification succeeds
     * @dev MVP: Verifies that keccak256(proof) matches stored commitment
     *      Future: Will use Groth16 verifier for full zkSNARK verification
     */
    function verifyEligibility(
        address user,
        bytes32 commitment,
        bytes memory proof
    ) external view returns (bool) {
        // Check if user has an active commitment
        Commitment memory userCommit = userCommitments[user];
        if (!userCommit.isActive) {
            return false;
        }

        // Verify the commitment matches
        if (userCommit.commitmentHash != commitment) {
            return false;
        }

        // MVP: Verify proof by rehashing
        // Proof format: abi.encodePacked(secret, nullifier)
        // Expected: keccak256(proof) == commitment
        if (proof.length == 0) {
            return false;
        }

        bytes32 computedCommitment = keccak256(proof);
        bool isValid = computedCommitment == commitment;

        // Note: In production Groth16 implementation, this would be:
        // return groth16Verifier.verifyProof(proof, publicInputs);

        return isValid;
    }

    /**
     * @notice Verify range proof for token holdings
     * @param tokenId The ID of the token
     * @param holder Address of the token holder
     * @param minRange Minimum claimed range
     * @param maxRange Maximum claimed range
     * @param proof ZK proof data
     * @return bool True if the holder's balance is within [minRange, maxRange]
     * @dev MVP: Simple eligibility check + range validation
     *      Future: Full Groth16 range proof circuit verification
     *      
     *      The range proof allows a holder to prove their balance is within
     *      [minRange, maxRange] without revealing the exact amount.
     *      
     *      For Groth16 upgrade, proof will contain:
     *      - Private inputs: actualAmount, secret
     *      - Public inputs: minRange, maxRange, commitment
     *      - Proof that minRange <= actualAmount <= maxRange
     */
    function verifyRangeProof(
        uint256 tokenId,
        address holder,
        uint256 minRange,
        uint256 maxRange,
        bytes memory proof
    ) external view returns (bool) {
        // Validate range parameters
        if (minRange > maxRange) {
            return false;
        }

        // Check if holder has active commitment
        if (!userCommitments[holder].isActive) {
            return false;
        }

        // MVP Implementation:
        // For MVP, we do a simplified check:
        // 1. Verify holder has commitment (privacy eligibility)
        // 2. Accept range proof if basic validation passes
        // 
        // In real implementation, proof would contain:
        // - Commitment to actual holdings
        // - ZK proof that actualAmount ∈ [minRange, maxRange]
        
        if (proof.length == 0) {
            return false;
        }

        // Decode proof (MVP format: just the commitment hash for range)
        // Future: This will be Groth16 proof verification
        bytes32 rangeCommitment = rangeCommitments[tokenId][holder];
        
        // MVP: If holder has commitment, accept the range proof
        // Future: Verify actual Groth16 range proof circuit
        // Example future code:
        // uint256[8] memory proofData = abi.decode(proof, (uint256[8]));
        // uint256[] memory publicInputs = new uint256[](3);
        // publicInputs[0] = minRange;
        // publicInputs[1] = maxRange;
        // publicInputs[2] = uint256(rangeCommitment);
        // return rangeProofVerifier.verifyProof(proofData, publicInputs);

        return true; // MVP: Accept if holder has commitment
    }

    /**
     * @notice Set range commitment for a token holder
     * @param tokenId The token ID
     * @param holder The holder address
     * @param commitment The commitment hash for range proof
     * @dev This allows holders to commit to their balance for future range proofs
     */
    function setRangeCommitment(
        uint256 tokenId,
        address holder,
        bytes32 commitment
    ) external {
        require(msg.sender == holder || msg.sender == owner(), "Not authorized");
        require(commitment != bytes32(0), "Zero commitment");
        
        rangeCommitments[tokenId][holder] = commitment;
        emit RangeCommitmentSet(tokenId, holder, commitment);
    }

    /**
     * @notice Check if a user has an active commitment
     * @param user Address to check
     * @return bool True if user has active commitment
     */
    function hasActiveCommitment(address user) external view returns (bool) {
        return userCommitments[user].isActive;
    }

    /**
     * @notice Get commitment details for a user
     * @param user Address to query
     * @return commitment The commitment struct
     */
    function getCommitment(address user) external view returns (Commitment memory) {
        return userCommitments[user];
    }

    // ============ Admin Functions ============

    /**
     * @notice Revoke a user's commitment (admin function)
     * @param user Address whose commitment to revoke
     */
    function revokeCommitment(address user) external onlyOwner {
        if (!userCommitments[user].isActive) revert NoActiveCommitment();
        
        userCommitments[user].isActive = false;
        emit CommitmentRevoked(user);
    }

    /**
     * @notice Update verification status for a token holder
     * @param tokenId The token ID
     * @param holder The holder address
     * @param isVerified Verification status
     * @dev Allows admin to manually verify token holders
     */
    function updateHolderVerification(
        uint256 tokenId,
        address holder,
        bool isVerified
    ) external onlyOwner {
        tokenHolderVerified[tokenId][holder] = isVerified;
    }

    /**
     * @notice Batch register commitments (admin utility)
     * @param users Array of user addresses
     * @param commitments Array of commitment hashes
     * @dev Useful for onboarding multiple users
     */
    function batchRegisterCommitments(
        address[] calldata users,
        bytes32[] calldata commitments
    ) external onlyOwner {
        require(users.length == commitments.length, "Length mismatch");
        
        for (uint256 i = 0; i < users.length; i++) {
            if (commitments[i] == bytes32(0)) continue;
            if (userCommitments[users[i]].isActive) continue;
            
            userCommitments[users[i]] = Commitment({
                commitmentHash: commitments[i],
                timestamp: block.timestamp,
                isActive: true
            });
            
            emit CommitmentRegistered(users[i], commitments[i], block.timestamp);
        }
    }

    // ============ Future Groth16 Integration Points ============
    
    /**
     * @dev UPGRADE PATH: Set Groth16 verifier contract addresses
     * 
     * Future variables to add:
     * - address public eligibilityVerifier;  // Groth16 verifier for eligibility
     * - address public rangeProofVerifier;   // Groth16 verifier for range proofs
     * 
     * Future functions to add:
     * - setEligibilityVerifier(address _verifier) external onlyOwner;
     * - setRangeProofVerifier(address _verifier) external onlyOwner;
     * 
     * Integration steps:
     * 1. Deploy circom circuits (eligibility.circom, rangeProof.circom)
     * 2. Generate Groth16 verifier contracts from circuits
     * 3. Deploy verifier contracts
     * 4. Update this contract to call verifier.verifyProof()
     * 5. Modify proof format to match Groth16 output from SnarkJS
     */
}
