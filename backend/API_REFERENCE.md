# Sherlock API Reference

Quick reference for all available API endpoints.

## Base URL
```
http://localhost:3001
```

---

## Endpoints

### Health Check
```http
GET /health
```
Returns server status and circuit readiness.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "network": "Mantle Testnet",
  "chainId": 5003,
  "circuits": {
    "ready": true,
    "status": { ... }
  }
}
```

---

### 1. Create RWA Token
```http
POST /api/rwa/create
Rate Limit: 10 req/min
```

**Request:**
```json
{
  "issuerAddress": "0x...",
  "documentHash": "QmIPFS...",
  "totalValue": 100000,
  "fractionCount": 100,
  "minFractionSize": 1,
  "lockupPeriod": 0,
  "assetType": "invoice",
  "zkProofInput": {
    "commitment": "0x...",
    "secret": "issuer_secret",
    "nullifier": "issuer_nullifier"
  }
}
```

**Response:**
```json
{
  "success": true,
  "tokenId": 1,
  "txHash": "0x...",
  "blockNumber": 33469405,
  "oraclePrice": 336669636463,
  "zkProof": "0x..."
}
```

---

### 2. Purchase Fractions
```http
POST /api/rwa/purchase
Rate Limit: 30 req/min
```

**Request:**
```json
{
  "tokenId": 1,
  "amount": 10,
  "buyerAddress": "0x...",
  "zkProofInput": {
    "commitment": "0x...",
    "secret": "buyer_secret",
    "nullifier": "buyer_nullifier"
  }
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 33469845,
  "totalCost": "100.00",
  "currentPrice": "10.00",
  "fractionsBalance": 10
}
```

---

### 3. Get Token Metadata
```http
GET /api/rwa/:tokenId
Rate Limit: 30 req/min
```

**Response:**
```json
{
  "success": true,
  "tokenId": 1,
  "metadata": {
    "issuer": "0x...",
    "documentHash": "QmIPFS...",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "mintTimestamp": 1768483483,
    "oraclePriceAtMint": 336669636463,
    "verified": true
  },
  "fractionSpec": {
    "totalSupply": 100,
    "minUnitSize": 1,
    "lockupPeriod": 0,
    "lockupEnd": 1768483483,
    "isActive": true
  },
  "economics": {
    "pricePerFraction": "1000.00",
    "availableFractions": 90,
    "soldFractions": 10,
    "availableValue": "90000.00",
    "soldValue": "10000.00"
  }
}
```

---

### 4. Generate ZK Proof
```http
POST /api/zk/generate-proof
Rate Limit: 30 req/min
```

**Request (Eligibility):**
```json
{
  "proofType": "eligibility",
  "userAddress": "0x...",
  "inputs": {
    "commitment": "0x...",
    "secret": "user_secret",
    "nullifier": "user_nullifier"
  }
}
```

**Request (Range):**
```json
{
  "proofType": "range",
  "userAddress": "0x...",
  "inputs": {
    "tokenId": 1,
    "actualAmount": 50,
    "minRange": 10,
    "maxRange": 100
  }
}
```

**Response:**
```json
{
  "success": true,
  "proof": "0x1a2b3c4d...",
  "publicSignals": ["0x..."]
}
```

---

### 5. Get Oracle Prices
```http
GET /api/oracle/prices
Rate Limit: 30 req/min
```

**Response:**
```json
{
  "success": true,
  "prices": [
    {
      "feedId": "ETH/USD",
      "priceId": "0xff614...",
      "price": 3366.69636463,
      "expo": -8,
      "timestamp": 1705234567,
      "confidence": "0.25"
    }
  ]
}
```

---

### 6. Update Oracle Prices
```http
POST /api/oracle/update-prices
Rate Limit: 30 req/min
```

**Request (Optional):**
```json
{
  "priceIds": ["0xff614..."]
}
```

**Response:**
```json
{
  "success": true,
  "txHash": "0x...",
  "blockNumber": 33469900,
  "updatedFeeds": 3,
  "gasUsed": "150000"
}
```

---

### 7. Get Oracle Metrics
```http
GET /api/oracle/metrics
```

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalUpdates": 288,
    "successfulUpdates": 288,
    "failedUpdates": 0,
    "lastUpdateTimestamp": 1705234567000,
    "isRunning": true,
    "lastUpdateDate": "2026-01-15T10:29:27.000Z",
    "successRate": "100.00%",
    "uptime": 86400
  }
}
```

---

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /api/rwa/create | 10 requests | 1 minute |
| POST /api/rwa/purchase | 30 requests | 1 minute |
| POST /api/zk/generate-proof | 30 requests | 1 minute |
| POST /api/oracle/update-prices | 30 requests | 1 minute |
| GET /api/rwa/:tokenId | 30 requests | 1 minute |
| GET /api/oracle/prices | 30 requests | 1 minute |
| GET /api/oracle/metrics | No limit | - |
| GET /health | No limit | - |

All limits are per IP address.

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | OK - Request successful |
| 201 | Created - Resource created (RWA token minted) |
| 400 | Bad Request - Invalid input or validation error |
| 404 | Not Found - Token does not exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Contract revert or server error |
| 503 | Service Unavailable - Oracle service unavailable |

---

## Common Error Responses

**Validation Error (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["Invalid Ethereum address format"]
}
```

**Not Found (404):**
```json
{
  "success": false,
  "error": "Token ID 999 does not exist"
}
```

**Rate Limit (429):**
```json
{
  "success": false,
  "error": "Too many requests. Please try again in 1 minute."
}
```

**Server Error (500):**
```json
{
  "success": false,
  "error": "Contract execution failed",
  "details": "InsufficientFractionsAvailable()"
}
```

---

## Quick Examples

### Create Token
```bash
curl -X POST http://localhost:3001/api/rwa/create \
  -H "Content-Type: application/json" \
  -d '{"issuerAddress":"0x...","documentHash":"QmIPFS...","totalValue":100000,"fractionCount":100,"minFractionSize":1,"lockupPeriod":0,"assetType":"invoice","zkProofInput":{"commitment":"0x...","secret":"issuer_secret","nullifier":"issuer_nullifier"}}'
```

### Purchase Fractions
```bash
curl -X POST http://localhost:3001/api/rwa/purchase \
  -H "Content-Type: application/json" \
  -d '{"tokenId":1,"amount":10,"buyerAddress":"0x...","zkProofInput":{"commitment":"0x...","secret":"buyer_secret","nullifier":"buyer_nullifier"}}'
```

### Get Token Info
```bash
curl http://localhost:3001/api/rwa/1
```

### Get Oracle Prices
```bash
curl http://localhost:3001/api/oracle/prices
```

### Check Health
```bash
curl http://localhost:3001/health
```

---

## Authentication

**Current:** None (MVP)  
**Production:** Add API key via `Authorization: Bearer <token>` header

---

## Network Details

- **Network:** Mantle Testnet
- **Chain ID:** 5003
- **RPC:** https://rpc.testnet.mantle.xyz
- **Explorer:** https://explorer.testnet.mantle.xyz

---

## Notes

- All amounts in `totalValue` are in USD cents (e.g., 100000 = $1,000.00)
- All Ethereum addresses must be checksummed or lowercase
- ZK proof commitments must be 32-byte hex strings with `0x` prefix
- Oracle prices are updated automatically every 5 minutes
- Transaction hashes can be viewed on Mantle Testnet Explorer

---

**Last Updated:** January 15, 2026  
**API Version:** v1.0.0
