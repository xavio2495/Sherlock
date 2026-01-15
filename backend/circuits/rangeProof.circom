pragma circom 2.0.0;

include "../node_modules/circomlib/circuits/comparators.circom";
include "../node_modules/circomlib/circuits/poseidon.circom";

/**
 * @title RangeProof Circuit
 * @notice Proves that a private value lies within a public range without revealing the exact value
 * @dev Used for privacy-preserving balance/holdings verification
 * 
 * Private Inputs:
 *   - actualAmount: The actual balance/holdings (kept private)
 * 
 * Public Inputs:
 *   - minRange: Minimum claimed range (e.g., "I hold at least 10 tokens")
 *   - maxRange: Maximum claimed range (e.g., "I hold at most 100 tokens")
 *   - commitment: Commitment to the actual amount for consistency
 * 
 * Constraints:
 *   - minRange <= actualAmount <= maxRange
 *   - commitment = Poseidon(actualAmount)
 * 
 * Example: Prove "I hold between 10-100 tokens" without revealing exact amount of 42
 */
template RangeProof() {
    // Private input - the actual amount to prove
    signal input actualAmount;
    
    // Public inputs - the range boundaries and commitment
    signal input minRange;
    signal input maxRange;
    signal input commitment;
    
    // Constraint 1: Verify commitment matches actualAmount
    component hasher = Poseidon(1);
    hasher.inputs[0] <== actualAmount;
    commitment === hasher.out;
    
    // Constraint 2: actualAmount <= maxRange
    // LessThan returns 1 if in[0] < in[1], so we check actualAmount < maxRange + 1
    component lessThan = LessThan(64);
    lessThan.in[0] <== actualAmount;
    lessThan.in[1] <== maxRange + 1;
    lessThan.out === 1;
    
    // Constraint 3: actualAmount >= minRange
    // GreaterThan returns 1 if in[0] > in[1], so we check actualAmount > minRange - 1
    component greaterThan = GreaterThan(64);
    greaterThan.in[0] <== actualAmount;
    greaterThan.in[1] <== minRange - 1;
    greaterThan.out === 1;
}

// Main component - declare public inputs explicitly
component main {public [minRange, maxRange, commitment]} = RangeProof();
