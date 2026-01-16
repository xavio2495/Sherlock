#!/bin/bash

# Pyth Oracle Integration Test Script
# Tests the enhanced PythClient with retry logic, cron scheduling, and metrics

echo "========================================"
echo "Pyth Oracle Integration Test"
echo "========================================"
echo ""

BASE_URL="http://localhost:3001"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}Test 1: Health Check${NC}"
echo "GET $BASE_URL/health"
curl -s "$BASE_URL/health" | jq '.' || echo "Server not running or jq not installed"
echo ""
echo ""

echo -e "${BLUE}Test 2: Fetch Latest Prices (Pyth API)${NC}"
echo "GET $BASE_URL/api/oracle/prices"
curl -s "$BASE_URL/api/oracle/prices" | jq '.' || echo "Failed to fetch prices"
echo ""
echo ""

echo -e "${BLUE}Test 3: Oracle Metrics (NEW)${NC}"
echo "GET $BASE_URL/api/oracle/metrics"
curl -s "$BASE_URL/api/oracle/metrics" | jq '.' || echo "Failed to fetch metrics"
echo ""
echo ""

echo -e "${YELLOW}Test 4: Trigger Manual Price Update (Requires Funded Wallet)${NC}"
echo "POST $BASE_URL/api/oracle/update-prices"
echo "This will submit prices to the blockchain (costs gas)."
read -p "Do you want to proceed? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    curl -s -X POST "$BASE_URL/api/oracle/update-prices" \
         -H "Content-Type: application/json" \
         -d '{}' | jq '.' || echo "Failed to update prices"
    echo ""
    echo ""
    
    echo -e "${BLUE}Check metrics after update:${NC}"
    sleep 2
    curl -s "$BASE_URL/api/oracle/metrics" | jq '.metrics' || echo "Failed to fetch metrics"
else
    echo "Skipped manual update."
fi
echo ""
echo ""

echo "========================================"
echo "Test Complete!"
echo ""
echo "Expected Behavior:"
echo "✓ Health check shows circuits ready"
echo "✓ Prices endpoint returns ETH/USD, BTC/USD, USDC/USD prices"
echo "✓ Metrics endpoint shows:"
echo "  - totalUpdates, successfulUpdates, failedUpdates"
echo "  - lastUpdateDate, successRate, uptime"
echo "  - lastUpdateStatus (idle/running/success/error)"
echo ""
echo "Automatic Updates:"
echo "- Cron job runs every 5 minutes (check server logs)"
echo "- 3 retry attempts with 15-second delays"
echo "- Initial update runs 5 seconds after startup"
echo "========================================"
