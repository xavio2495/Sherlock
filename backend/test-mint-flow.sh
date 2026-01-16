#!/bin/bash

# Test script for RWA minting flow
# Tests the complete mint workflow including ZK proof generation and on-chain transaction

API_URL="http://localhost:3001"
TEST_ISSUER="0xce4389ACb79463062c362fACB8CB04513fA3D8D8"

echo "======================================"
echo "RWA Minting Flow Test"
echo "======================================"
echo ""

echo "Step 1: Check backend health..."
HEALTH=$(curl -s "$API_URL/health")
echo "$HEALTH" | jq .
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend is not responding properly"
    exit 1
fi
echo ""

echo "Step 2: Check oracle prices..."
PRICES=$(curl -s "$API_URL/api/oracle/prices")
echo "$PRICES" | jq .
if echo "$PRICES" | jq -e '.success == true' > /dev/null; then
    echo "✓ Oracle prices available"
else
    echo "✗ Oracle prices not available"
fi
echo ""

echo "Step 3: Attempt to mint RWA token..."
echo "This will test the complete flow:"
echo "  - ZK proof generation"
echo "  - Pyth price fetch"
echo "  - On-chain transaction"
echo "  - Event parsing"
echo ""
echo "Note: This will take 30-90 seconds..."
echo ""

START_TIME=$(date +%s)

MINT_REQUEST='{
  "issuerAddress": "'$TEST_ISSUER'",
  "documentHash": "QmTestHash123456789ABCDEF",
  "totalValue": 500000,
  "fractionCount": 500,
  "minFractionSize": 1,
  "lockupPeriod": 0,
  "assetType": "invoice",
  "zkProofInput": {
    "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "secret": "test_secret_12345",
    "nullifier": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
  }
}'

echo "Sending mint request..."
MINT_RESPONSE=$(curl -s -X POST "$API_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d "$MINT_REQUEST" \
  --max-time 180)

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo "Response received in ${ELAPSED} seconds:"
echo "$MINT_RESPONSE" | jq .
echo ""

if echo "$MINT_RESPONSE" | jq -e '.success == true' > /dev/null; then
    TOKEN_ID=$(echo "$MINT_RESPONSE" | jq -r '.tokenId')
    TX_HASH=$(echo "$MINT_RESPONSE" | jq -r '.txHash')
    echo "✓✓✓ SUCCESS! ✓✓✓"
    echo "Token ID: $TOKEN_ID"
    echo "Transaction Hash: $TX_HASH"
    echo "View on explorer: https://sepolia.explorer.mantle.xyz/tx/$TX_HASH"
    echo ""
    
    echo "Step 4: Verify minted token metadata..."
    sleep 2
    METADATA=$(curl -s "$API_URL/api/rwa/$TOKEN_ID")
    echo "$METADATA" | jq .
    
    if echo "$METADATA" | jq -e '.success == true' > /dev/null; then
        echo "✓ Token metadata verified on-chain"
    else
        echo "✗ Could not fetch token metadata"
    fi
else
    ERROR=$(echo "$MINT_RESPONSE" | jq -r '.error')
    echo "✗✗✗ MINTING FAILED ✗✗✗"
    echo "Error: $ERROR"
    echo ""
    echo "Common issues:"
    echo "  1. Backend wallet insufficient funds - Check wallet balance"
    echo "  2. Contract revert - Check contract state and permissions"
    echo "  3. Pyth oracle issue - Check oracle service status"
    echo "  4. RPC connection issue - Check Mantle Testnet RPC"
    exit 1
fi

echo ""
echo "======================================"
echo "Test Complete!"
echo "======================================"
