pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * @title EligibilityProof Circuit
 * @notice Proves knowledge of a secret that generates a specific commitment
 * @dev Used for privacy-preserving KYC/eligibility verification
 * 
 * Private Inputs:
 *   - secret: User's private credential/secret
 *   - nullifier: Unique identifier to prevent double-spending
 * 
 * Public Outputs:
 *   - commitment: Poseidon hash of (secret, nullifier)
 * 
 * Usage:
 *   User registers commitment = Poseidon(secret, nullifier) on-chain
 *   To prove eligibility, user reveals secret and nullifier
 *   Circuit proves knowledge without revealing values on-chain
 */
template EligibilityProof() {
    // Private inputs
    signal input secret;
    signal input nullifier;
    
    // Public output
    signal output commitment;
    
    // Compute Poseidon hash of secret and nullifier
    component poseidon = Poseidon(2);
    poseidon.inputs[0] <== secret;
    poseidon.inputs[1] <== nullifier;
    
    // Output the commitment
    commitment <== poseidon.out;
}

// Main component - all inputs are private by default
component main = EligibilityProof();
