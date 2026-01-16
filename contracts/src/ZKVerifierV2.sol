// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./EligibilityVerifier.sol";
import "./RangeProofVerifier.sol";

/**
 * @title ZKVerifierV2
 * @notice Enhanced ZK verification with Groth16 proof support
 * @dev Integrates circom-generated Groth16 verifiers for cryptographic proof validation
 * 
 * This contract bridges:
 * - Legacy commitment-based verification (backward compatibility)
 * - Groth16 zkSNARK verification (eligibility and range proofs)
 * 
 * Proof Types:
 * 1. Eligibility Proof: Proves knowledge of (secret, nullifier) → commitment
 * 2. Range Proof: Proves actualAmount ∈ [minRange, maxRange] without revealing actualAmount
 */
contract ZKVerifierV2 is Ownable {
    // ============ State Variables ============
    
    EligibilityVerifier public eligibilityVerifier;
    RangeProofVerifier public rangeProofVerifier;
    
    struct Commitment {
        bytes32 commitmentHash;
        uint256 timestamp;
        bool isActive;
    }

    mapping(address => Commitment) public userCommitments;
    mapping(uint256 => mapping(address => bool)) public tokenHolderVerified;
    mapping(uint256 => mapping(address => bytes32)) public rangeCommitments;

    // ============ Errors ============
    
    error ZeroCommitment();
    error CommitmentAlreadyExists();
    error NoActiveCommitment();
    error InvalidProof();
    error CommitmentMismatch();
    error InvalidRange();
    error VerifierNotSet();
    error InvalidProofFormat();

    // ============ Events ============
    
    event CommitmentRegistered(address indexed user, bytes32 commitment, uint256 timestamp);
    event EligibilityVerified(address indexed user, bool isEligible);
    event RangeProofVerified(uint256 indexed tokenId, address indexed holder, bool isValid);
    event CommitmentRevoked(address indexed user);
    event RangeCommitmentSet(uint256 indexed tokenId, address indexed holder, bytes32 commitment);
    event EligibilityVerifierSet(address verifier);
    event RangeProofVerifierSet(address verifier);
    event Groth16ProofVerified(address indexed user, bytes32 commitment, bool success);

    // ============ Constructor ============
    
    constructor(
        address _eligibilityVerifier,
        address _rangeProofVerifier
    ) Ownable(msg.sender) {
        eligibilityVerifier = EligibilityVerifier(_eligibilityVerifier);
        rangeProofVerifier = RangeProofVerifier(_rangeProofVerifier);
        
        emit EligibilityVerifierSet(_eligibilityVerifier);
        emit RangeProofVerifierSet(_rangeProofVerifier);
    }

    // ============ Core Functions ============
    
    /**
     * @notice Register a commitment for a user
     * @param commitment The hash commitment (from Poseidon hash or keccak256)
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
     * @notice Verify eligibility using Groth16 proof
     * @param user Address of the user to verify
     * @param commitment Expected commitment value (public signal)
     * @param proof Groth16 proof data [pA, pB, pC, publicSignals]
     * @return bool True if verification succeeds
     * @dev Expects proof format from SnarkJS:
     *      - pA: uint[2]
     *      - pB: uint[2][2]
     *      - pC: uint[2]
     *      - publicSignals: uint[1] (commitment)
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

        // Decode Groth16 proof if provided
        if (proof.length > 0) {
            return _verifyGroth16Eligibility(commitment, proof);
        }

        // Fallback to simple hash verification (legacy mode)
        bytes32 proofHash = keccak256(proof);
        return proofHash == commitment;
    }

    /**
     * @notice Verify Groth16 eligibility proof
     * @param commitment Expected commitment (public signal)
     * @param proofData Encoded Groth16 proof
     * @return bool Verification result
     */
    function _verifyGroth16Eligibility(
        bytes32 commitment,
        bytes memory proofData
    ) internal view returns (bool) {
        if (address(eligibilityVerifier) == address(0)) revert VerifierNotSet();

        // Decode proof components
        (
            uint[2] memory pA,
            uint[2][2] memory pB,
            uint[2] memory pC,
            uint[1] memory pubSignals
        ) = abi.decode(proofData, (uint[2], uint[2][2], uint[2], uint[1]));

        // Verify commitment matches public signal
        if (uint256(commitment) != pubSignals[0]) {
            return false;
        }

        // Verify Groth16 proof
        try eligibilityVerifier.verifyProof(pA, pB, pC, pubSignals) returns (bool valid) {
            return valid;
        } catch {
            return false;
        }
    }

    /**
     * @notice Verify range proof using Groth16
     * @param tokenId The token ID
     * @param holder The holder address
     * @param minRange Minimum claimed range (public)
     * @param maxRange Maximum claimed range (public)
     * @param commitment Commitment to actual amount (public)
     * @param proof Groth16 proof data
     * @return bool True if verification succeeds
     * @dev Public signals: [minRange, maxRange, commitment]
     */
    function verifyRangeProof(
        uint256 tokenId,
        address holder,
        uint256 minRange,
        uint256 maxRange,
        bytes32 commitment,
        bytes memory proof
    ) external returns (bool) {
        if (address(rangeProofVerifier) == address(0)) revert VerifierNotSet();
        if (minRange > maxRange) revert InvalidRange();

        // Decode proof components
        (
            uint[2] memory pA,
            uint[2][2] memory pB,
            uint[2] memory pC,
            uint[3] memory pubSignals
        ) = abi.decode(proof, (uint[2], uint[2][2], uint[2], uint[3]));

        // Verify public signals match
        if (pubSignals[0] != minRange || 
            pubSignals[1] != maxRange || 
            pubSignals[2] != uint256(commitment)) {
            emit RangeProofVerified(tokenId, holder, false);
            return false;
        }

        // Verify Groth16 proof
        bool valid = rangeProofVerifier.verifyProof(pA, pB, pC, pubSignals);
        
        if (valid) {
            tokenHolderVerified[tokenId][holder] = true;
            rangeCommitments[tokenId][holder] = commitment;
        }

        emit RangeProofVerified(tokenId, holder, valid);
        return valid;
    }

    /**
     * @notice Set range commitment for a holder
     * @param tokenId Token ID
     * @param holder Holder address
     * @param commitment Commitment hash
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

    // ============ View Functions ============

    function hasActiveCommitment(address user) external view returns (bool) {
        return userCommitments[user].isActive;
    }

    function getCommitment(address user) external view returns (Commitment memory) {
        return userCommitments[user];
    }

    // ============ Admin Functions ============

    function setEligibilityVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Zero address");
        eligibilityVerifier = EligibilityVerifier(_verifier);
        emit EligibilityVerifierSet(_verifier);
    }

    function setRangeProofVerifier(address _verifier) external onlyOwner {
        require(_verifier != address(0), "Zero address");
        rangeProofVerifier = RangeProofVerifier(_verifier);
        emit RangeProofVerifierSet(_verifier);
    }

    function revokeCommitment(address user) external onlyOwner {
        if (!userCommitments[user].isActive) revert NoActiveCommitment();
        userCommitments[user].isActive = false;
        emit CommitmentRevoked(user);
    }

    function updateHolderVerification(
        uint256 tokenId,
        address holder,
        bool isVerified
    ) external onlyOwner {
        tokenHolderVerified[tokenId][holder] = isVerified;
    }

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
}
