#!/bin/bash

# RWA Creation Endpoint Test Script
# Tests POST /api/rwa/create with validation, rate limiting, and full flow

echo "========================================"
echo "RWA Creation Endpoint Test"
echo "========================================"
echo ""

BASE_URL="http://localhost:3001"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if server is running
echo "Checking if server is running..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Server is not running!${NC}"
  echo "Please start the server first:"
  echo "  cd backend && npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

echo -e "${BLUE}Test 1: Valid RWA Creation Request${NC}"
echo "POST $BASE_URL/api/rwa/create"
curl -s -X POST "$BASE_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "invoice",
    "zkProofInput": {
      "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "secret": "test_secret_456",
      "nullifier": "test_nullifier_123"
    }
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}Test 2: Invalid Address (Should Fail Validation)${NC}"
echo "POST $BASE_URL/api/rwa/create"
curl -s -X POST "$BASE_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "invalid_address",
    "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "invoice",
    "zkProofInput": {
      "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "nullifier": "test_nullifier_123"
    }
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}Test 3: Missing Required Fields (Should Fail Validation)${NC}"
echo "POST $BASE_URL/api/rwa/create"
curl -s -X POST "$BASE_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg"
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}Test 4: Invalid Asset Type (Should Fail Validation)${NC}"
echo "POST $BASE_URL/api/rwa/create"
curl -s -X POST "$BASE_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "crypto",
    "zkProofInput": {
      "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "nullifier": "test_nullifier_123"
    }
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}Test 5: Invalid Fraction Count (Should Fail Validation)${NC}"
echo "POST $BASE_URL/api/rwa/create"
curl -s -X POST "$BASE_URL/api/rwa/create" \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg",
    "totalValue": 100000,
    "fractionCount": 0,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "invoice",
    "zkProofInput": {
      "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "nullifier": "test_nullifier_123"
    }
  }' | jq '.'
echo ""
echo ""

echo -e "${YELLOW}Test 6: Rate Limiting (11th Request in 1 Minute)${NC}"
echo "Sending 11 requests rapidly..."
for i in {1..11}; do
  echo -n "Request $i: "
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/rwa/create" \
    -H "Content-Type: application/json" \
    -d '{
      "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
      "documentHash": "QmX4Zq8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg",
      "totalValue": 100000,
      "fractionCount": 100,
      "minFractionSize": 1,
      "lockupPeriod": 0,
      "assetType": "invoice",
      "zkProofInput": {
        "commitment": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        "secret": "test_secret_456",
        "nullifier": "test_nullifier_123"
      }
    }')
  
  if [ "$STATUS" = "429" ]; then
    echo -e "${RED}RATE LIMITED (429)${NC}"
    break
  else
    echo "HTTP $STATUS"
  fi
done
echo ""
echo ""

echo "========================================"
echo "Test Summary"
echo "========================================"
echo ""
echo "Expected Results:"
echo "✓ Test 1: Should succeed or fail with ZK proof generation error"
echo "✓ Test 2: Should return 400 with validation error (Invalid address)"
echo "✓ Test 3: Should return 400 with validation errors (Missing fields)"
echo "✓ Test 4: Should return 400 with validation error (Invalid asset type)"
echo "✓ Test 5: Should return 400 with validation error (Invalid fraction count)"
echo "✓ Test 6: 11th request should return 429 (Rate limit exceeded)"
echo ""
echo "Features Tested:"
echo "✓ Joi validation schema"
echo "✓ Rate limiting (10 req/min per IP)"
echo "✓ Error handling and detailed error messages"
echo "✓ Request body validation and sanitization"
echo ""
echo "========================================"
