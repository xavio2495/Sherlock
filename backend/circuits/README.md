# ZK Circuits for Sherlock RWA Platform

This directory will contain Circom circuits for zero-knowledge proofs used in the platform.

## Planned Circuits

### 1. eligibility.circom
**Purpose**: Prove user eligibility without revealing credentials

**Inputs**:
- `secret` (private): User's secret credential
- `nullifier` (private): Prevents double-spending
- `commitment` (public): Hash of secret + nullifier

**Logic**: Verifies that the user knows the preimage of the commitment without revealing it.

### 2. rangeProof.circom
**Purpose**: Prove holdings are within a range without revealing exact amount

**Inputs**:
- `actualAmount` (private): Exact token holdings
- `minRange` (public): Minimum claimed range
- `maxRange` (public): Maximum claimed range
- `commitment` (public): Commitment to holdings

**Logic**: Verifies that `minRange <= actualAmount <= maxRange` without revealing `actualAmount`.

## Circuit Development Workflow

### Setup
```bash
# Install Circom compiler
npm install -g circom

# Install SnarkJS
npm install -g snarkjs
```

### Compilation
```bash
# Compile circuit to R1CS and WASM
circom eligibility.circom --r1cs --wasm --sym -o build/

# View circuit info
snarkjs r1cs info build/eligibility.r1cs
```

### Trusted Setup (Groth16)
```bash
# Download powers of tau (Phase 1)
wget https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau

# Phase 2 setup
snarkjs groth16 setup build/eligibility.r1cs powersOfTau28_hez_final_12.ptau build/eligibility_0000.zkey

# Contribute to ceremony (optional)
snarkjs zkey contribute build/eligibility_0000.zkey build/eligibility_final.zkey --name="Contribution 1"

# Export verification key
snarkjs zkey export verificationkey build/eligibility_final.zkey build/verification_key.json
```

### Generate Proof (Testing)
```bash
# Create input file (input.json)
echo '{
  "secret": "12345",
  "nullifier": "67890"
}' > input.json

# Generate witness
node build/eligibility_js/generate_witness.js \
  build/eligibility_js/eligibility.wasm \
  input.json \
  witness.wtns

# Generate proof
snarkjs groth16 prove \
  build/eligibility_final.zkey \
  witness.wtns \
  proof.json \
  public.json

# Verify proof
snarkjs groth16 verify \
  build/verification_key.json \
  public.json \
  proof.json
```

### Export Solidity Verifier (Optional)
```bash
# Generate Solidity verifier contract
snarkjs zkey export solidityverifier \
  build/eligibility_final.zkey \
  ../contracts/src/EligibilityVerifier.sol
```

## Integration with Backend

Once circuits are compiled, the backend (`src/zk/prover.ts`) will:
1. Load the WASM file and proving key
2. Generate witness from user inputs
3. Create Groth16 proof
4. Return proof and public signals for on-chain verification

## Resources

- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [Groth16 Paper](https://eprint.iacr.org/2016/260.pdf)
- [Hermez Powers of Tau](https://github.com/iden3/snarkjs#7-prepare-phase-2)

## Status

⚠️ **Circuits not yet implemented** - This is a placeholder directory. Circuit implementation is pending as part of Phase 2.
