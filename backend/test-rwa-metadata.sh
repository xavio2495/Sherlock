#!/bin/bash

# Test GET /api/rwa/:tokenId endpoint

echo "========================================="
echo "Testing GET /api/rwa/:tokenId Endpoint"
echo "========================================="
echo ""

BASE_URL="http://localhost:3001"

# Test 1: Query existing token (Token ID 1)
echo "Test 1: Query Token ID 1 (should exist)"
echo "----------------------------------------"
curl -s -X GET "$BASE_URL/api/rwa/1" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# Test 2: Query non-existent token
echo "Test 2: Query Token ID 999 (should not exist)"
echo "----------------------------------------------"
curl -s -X GET "$BASE_URL/api/rwa/999" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# Test 3: Invalid token ID (negative)
echo "Test 3: Query Token ID -1 (invalid - negative)"
echo "-----------------------------------------------"
curl -s -X GET "$BASE_URL/api/rwa/-1" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# Test 4: Invalid token ID (non-numeric)
echo "Test 4: Query Token ID 'abc' (invalid - non-numeric)"
echo "-----------------------------------------------------"
curl -s -X GET "$BASE_URL/api/rwa/abc" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

# Test 5: Check health endpoint
echo "Test 5: Health Check"
echo "--------------------"
curl -s -X GET "$BASE_URL/health" \
  -H "Content-Type: application/json" | jq '.'
echo ""
echo ""

echo "========================================="
echo "All tests completed!"
echo "========================================="
