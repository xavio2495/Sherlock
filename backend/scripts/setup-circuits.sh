#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Sherlock ZK Circuit Setup Script${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo -e "${RED}ERROR: circom compiler not found!${NC}"
    echo ""
    echo "Please install circom first:"
    echo "  git clone https://github.com/iden3/circom.git"
    echo "  cd circom"
    echo "  cargo build --release"
    echo "  cargo install --path circom"
    echo ""
    echo "Or download prebuilt binary from:"
    echo "  https://github.com/iden3/circom/releases"
    exit 1
fi

echo -e "${GREEN}✓ circom compiler found: $(circom --version)${NC}"
echo ""

# Check if snarkjs is installed
if ! command -v snarkjs &> /dev/null; then
    echo -e "${YELLOW}⚠ snarkjs CLI not found globally, using npx...${NC}"
    SNARKJS="npx snarkjs"
else
    echo -e "${GREEN}✓ snarkjs found: $(snarkjs --version)${NC}"
    SNARKJS="snarkjs"
fi
echo ""

# Create build directories
mkdir -p circuits/build
mkdir -p circuits/keys
mkdir -p circuits/ptau

# Download Powers of Tau if not present
PTAU_FILE="circuits/ptau/powersOfTau28_hez_final_15.ptau"
if [ ! -f "$PTAU_FILE" ]; then
    echo -e "${YELLOW}Downloading Powers of Tau ceremony file (36 MB)...${NC}"
    wget -O "$PTAU_FILE" https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_15.ptau
    echo -e "${GREEN}✓ Downloaded Powers of Tau file${NC}"
else
    echo -e "${GREEN}✓ Powers of Tau file already exists${NC}"
fi
echo ""

# Compile eligibility circuit
echo -e "${BLUE}[1/2] Compiling eligibility.circom...${NC}"
circom circuits/eligibility.circom \
    --r1cs \
    --wasm \
    --sym \
    -o circuits/build \
    --O2

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ eligibility.circom compiled successfully${NC}"
    
    # Print circuit info
    echo -e "${YELLOW}Circuit info:${NC}"
    $SNARKJS r1cs info circuits/build/eligibility.r1cs
else
    echo -e "${RED}✗ Failed to compile eligibility.circom${NC}"
    exit 1
fi
echo ""

# Generate proving key for eligibility
echo -e "${BLUE}Generating eligibility proving key...${NC}"
$SNARKJS groth16 setup \
    circuits/build/eligibility.r1cs \
    "$PTAU_FILE" \
    circuits/keys/eligibility_0000.zkey

# Contribute to phase 2 ceremony (random beacon)
echo -e "${BLUE}Contributing to Phase 2 ceremony...${NC}"
$SNARKJS zkey contribute \
    circuits/keys/eligibility_0000.zkey \
    circuits/keys/eligibility_final.zkey \
    --name="Sherlock Eligibility" \
    -e="$(date +%s)" \
    -v

# Export verification key
$SNARKJS zkey export verificationkey \
    circuits/keys/eligibility_final.zkey \
    circuits/keys/eligibility_verification_key.json

echo -e "${GREEN}✓ Eligibility circuit setup complete${NC}"
echo ""

# Compile range proof circuit
echo -e "${BLUE}[2/2] Compiling rangeProof.circom...${NC}"
circom circuits/rangeProof.circom \
    --r1cs \
    --wasm \
    --sym \
    -o circuits/build \
    --O2

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ rangeProof.circom compiled successfully${NC}"
    
    # Print circuit info
    echo -e "${YELLOW}Circuit info:${NC}"
    $SNARKJS r1cs info circuits/build/rangeProof.r1cs
else
    echo -e "${RED}✗ Failed to compile rangeProof.circom${NC}"
    exit 1
fi
echo ""

# Generate proving key for range proof
echo -e "${BLUE}Generating range proof proving key...${NC}"
$SNARKJS groth16 setup \
    circuits/build/rangeProof.r1cs \
    "$PTAU_FILE" \
    circuits/keys/rangeProof_0000.zkey

# Contribute to phase 2 ceremony
echo -e "${BLUE}Contributing to Phase 2 ceremony...${NC}"
$SNARKJS zkey contribute \
    circuits/keys/rangeProof_0000.zkey \
    circuits/keys/rangeProof_final.zkey \
    --name="Sherlock RangeProof" \
    -e="$(date +%s)" \
    -v

# Export verification key
$SNARKJS zkey export verificationkey \
    circuits/keys/rangeProof_final.zkey \
    circuits/keys/rangeProof_verification_key.json

echo -e "${GREEN}✓ Range proof circuit setup complete${NC}"
echo ""

# Summary
echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Setup Complete!${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "${GREEN}Generated files:${NC}"
echo "  circuits/build/eligibility_js/eligibility.wasm"
echo "  circuits/keys/eligibility_final.zkey"
echo "  circuits/keys/eligibility_verification_key.json"
echo "  circuits/build/rangeProof_js/rangeProof.wasm"
echo "  circuits/keys/rangeProof_final.zkey"
echo "  circuits/keys/rangeProof_verification_key.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Update prover.ts to use compiled circuits"
echo "  2. Test proof generation: npm run test:zk"
echo "  3. Deploy verification keys to smart contracts"
echo ""
