# Sherlock Backend API Documentation

## Overview
Sherlock Backend is a Node.js/Express.js API server for Real World Asset (RWA) tokenization on Mantle Network. It provides endpoints for:
- Creating RWA tokens with ZK-proof eligibility verification
- Purchasing tokenized asset fractions
- Querying token metadata and economics
- Generating ZK proofs (eligibility and range proofs)
- Fetching real-time oracle prices from Pyth Network
- Automated oracle price updates via cron jobs

## Base URL
```
http://localhost:3001
```

## Authentication
- **Current:** None (MVP - suitable for hackathon/testing)
- **Production:** Add API key authentication via `Authorization: Bearer <token>` header

## Table of Contents
1. [Quick Start](#quick-start)
2. [Health Check](#health-check)
3. [RWA Endpoints](#rwa-endpoints)
4. [ZK Proof Endpoints](#zk-proof-endpoints)
5. [Oracle Endpoints](#oracle-endpoints)
6. [Rate Limits](#rate-limits)
7. [Error Codes](#error-codes)
8. [Examples](#examples)

---

## Quick Start

### Installation
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your private key
nano .env
```

### Development Mode
```bash
npm run dev  # Starts on http://localhost:3001
```

### Production Mode
```bash
npm run build
npm start
```

---

## Health Check

### GET /health
Check API server health and circuit readiness.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "network": "Mantle Testnet",
  "chainId": 5003,
  "circuits": {
    "ready": true,
    "status": {
      "eligibility": "ready",
      "range": "ready"
    }
  }
}
```

**Example:**
```bash
curl http://localhost:3001/health
```

---

## RWA Endpoints

### POST /api/rwa/create
Mint a new RWA token with fractional ownership.

**Rate Limit:** 10 requests/minute per IP

**Request Body:**
```json
{
  "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "documentHash": "QmX4H3TKfG9Q8hn7TZRz2k8F...",
  "totalValue": 100000,
  "fractionCount": 100,
  "minFractionSize": 1,
  "lockupPeriod": 0,
  "assetType": "invoice",
  "zkProofInput": {
    "commitment": "0x160219875247ebb0c1eb30415191b3b6664f3809edac8e03a627dbb83bd46635",
    "secret": "issuer_secret_123",
    "nullifier": "issuer_nullifier_456"
  }
}
```

**Parameters:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issuerAddress` | string | Yes | Ethereum address (0x + 40 hex chars) |
| `documentHash` | string | Yes | SHA256 hash or IPFS CID |
| `totalValue` | number | Yes | Total value in USD cents |
| `fractionCount` | number | Yes | Total fractions (1-1,000,000) |
| `minFractionSize` | number | Yes | Min transferable size |
| `lockupPeriod` | number | No | Lockup weeks (0-520) |
| `assetType` | string | Yes | `invoice`, `bond`, `real-estate` |
| `zkProofInput.commitment` | string | Yes | 32-byte hex commitment |
| `zkProofInput.secret` | string | Yes | Secret value (1-256 chars) |
| `zkProofInput.nullifier` | string | Yes | Nullifier value (1-256 chars) |

**Success Response (201 Created):**
```json
{
  "success": true,
  "tokenId": 1,
  "txHash": "0x9f4ac84f751a872657ee4ac25ac58ac8d62bcd653aeecd9b4578da8cdc7b3dd6",
  "blockNumber": 33469405,
  "oraclePrice": 336669636463,
  "zkProof": "0x1234..."
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["Invalid Ethereum address format"]
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/rwa/create \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "documentHash": "QmIPFS_HASH",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "invoice",
    "zkProofInput": {
      "commitment": "0x1602...46635",
      "secret": "issuer_secret",
      "nullifier": "issuer_nullifier"
    }
  }'
```

---

### POST /api/rwa/purchase
Purchase fractions of an existing RWA token.

**Rate Limit:** 30 requests/minute per IP

**Request Body:**
```json
{
  "tokenId": 1,
  "amount": 10,
  "buyerAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
  "zkProofInput": {
    "commitment": "0xb6133152a668f4085457fe1c5ea1b2ef298ca7868eddf9ae339b28fb58f9de6f",
    "secret": "buyer_secret_789",
    "nullifier": "buyer_nullifier_012"
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "txHash": "0x09be0df57a68a5b3eb18585a224457ab592f3d4aa1017160cc5c5fcdcd346cc5",
  "blockNumber": 33469845,
  "totalCost": "100.00",
  "currentPrice": "10.00",
  "fractionsBalance": 10
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/rwa/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 1,
    "amount": 10,
    "buyerAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "zkProofInput": {
      "commitment": "0xb613...de6f",
      "secret": "buyer_secret",
      "nullifier": "buyer_nullifier"
    }
  }'
```

---

### GET /api/rwa/:tokenId
Get asset metadata and economics for a specific RWA token.

**Rate Limit:** 30 requests/minute per IP

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenId` | number | ID of the RWA token (non-negative integer) |

**Success Response (200 OK):**
```json
{
  "success": true,
  "tokenId": 1,
  "metadata": {
    "issuer": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "documentHash": "QmX4H3TKfG9Q8hn7TZRz2k8F...",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "mintTimestamp": 1705234567,
    "oraclePriceAtMint": 336669636463,
    "verified": true
  },
  "fractionSpec": {
    "totalSupply": 100,
    "minUnitSize": 1,
    "lockupPeriod": 0,
    "lockupEnd": 0
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

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": "Invalid token ID. Must be a non-negative integer."
}
```

**Error Response (404 Not Found):**
```json
{
  "success": false,
  "error": "Token ID 999 does not exist"
}
```

**Example:**
```bash
# Query token metadata
curl http://localhost:3001/api/rwa/1

# Query token 1
curl http://localhost:3001/api/rwa/1
```

---

## ZK Proof Endpoints

### POST /api/zk/generate-proof
Generate a Zero-Knowledge proof for eligibility or range verification.

**Rate Limit:** 30 requests/minute per IP

**Request Body (Eligibility):**
```json
{
  "proofType": "eligibility",
  "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "inputs": {
    "commitment": "0x1602...46635",
    "secret": "issuer_secret",
    "nullifier": "issuer_nullifier"
  }
}
```

**Request Body (Range):**
```json
{
  "proofType": "range",
  "userAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
  "inputs": {
    "tokenId": 1,
    "actualAmount": 50,
    "minRange": 10,
    "maxRange": 100
  }
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "proof": "0x1a2b3c4d5e6f...",
  "publicSignals": ["0x1602...46635"]
}
```

**Example:**
```bash
curl -X POST http://localhost:3001/api/zk/generate-proof \
  -H "Content-Type: application/json" \
  -d '{
    "proofType": "eligibility",
    "userAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "inputs": {
      "commitment": "0x1602...46635",
      "secret": "issuer_secret",
      "nullifier": "issuer_nullifier"
    }
  }'
```

---

## Oracle Endpoints

### GET /api/oracle/prices
Fetch latest prices from Pyth Network API.

**Response:**
```json
{
  "success": true,
  "prices": [
    {
      "feedId": "ETH/USD",
      "priceId": "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
      "price": 3366.69636463,
      "expo": -8,
      "timestamp": 1705234567,
      "confidence": "0.25"
    }
  ]
}
```

**Example:**
```bash
curl http://localhost:3001/api/oracle/prices
```

---

### POST /api/oracle/update-prices
Submit price updates to PythOracleReader contract on-chain.

**Rate Limit:** 30 requests/minute per IP

**Request Body (Optional):**
```json
{
  "priceIds": ["0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"]
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "txHash": "0xabcdef1234567890...",
  "blockNumber": 33469900,
  "updatedFeeds": 3,
  "gasUsed": "150000"
}
```

**Example:**
```bash
# Update all default feeds (ETH, BTC, USDC)
curl -X POST http://localhost:3001/api/oracle/update-prices \
  -H "Content-Type: application/json"

# Update specific feeds
curl -X POST http://localhost:3001/api/oracle/update-prices \
  -H "Content-Type: application/json" \
  -d '{"priceIds": ["0xff614..."]}'
```

---

### GET /api/oracle/metrics
Get oracle service metrics and statistics.

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

**Example:**
```bash
curl http://localhost:3001/api/oracle/metrics
```

---

## Rate Limits

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| POST /api/rwa/create | 10 req | 1 min | IP |
| POST /api/rwa/purchase | 30 req | 1 min | IP |
| POST /api/zk/generate-proof | 30 req | 1 min | IP |
| POST /api/oracle/update-prices | 30 req | 1 min | IP |
| GET endpoints | 30 req | 1 min | IP |

**Rate Limit Response (429):**
```json
{
  "success": false,
  "error": "Too many requests. Please try again in 1 minute."
}
```

---

## Error Codes

| Code | Description | Example Scenarios |
|------|-------------|-------------------|
| **200 OK** | Request successful | GET requests |
| **201 Created** | Resource created | RWA token minted |
| **400 Bad Request** | Validation error | Invalid address format |
| **429 Too Many Requests** | Rate limit exceeded | >10 creates in 1 min |
| **500 Internal Server Error** | Contract revert | Insufficient gas |
| **503 Service Unavailable** | Oracle unavailable | Pyth API down |

### Common Error Messages

**Validation (400):**
- `"Invalid Ethereum address format"`
- `"Total value must be at least 1"`
- `"Asset type must be one of: invoice, bond, real-estate"`

**Contract (500):**
- `"Insufficient funds for gas"`
- `"Contract execution failed"`
- `"IssuerNotEligible()"`
- `"InsufficientFractionsAvailable()"`

**Oracle (500/503):**
- `"Failed to fetch prices from Pyth API"`
- `"Failed to update prices on-chain"`

---

## Examples

### Complete Flow: Mint → Purchase

**1. Check Health:**
```bash
curl http://localhost:3001/health
```

**2. Create RWA Token:**
```bash
curl -X POST http://localhost:3001/api/rwa/create \
  -H "Content-Type: application/json" \
  -d '{
    "issuerAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "documentHash": "QmIPFS...",
    "totalValue": 100000,
    "fractionCount": 100,
    "minFractionSize": 1,
    "lockupPeriod": 0,
    "assetType": "invoice",
    "zkProofInput": {
      "commitment": "0x1602...46635",
      "secret": "issuer_secret",
      "nullifier": "issuer_nullifier"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "tokenId": 1,
  "txHash": "0x9f4a...",
  "blockNumber": 33469405
}
```

**3. Purchase Fractions:**
```bash
curl -X POST http://localhost:3001/api/rwa/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": 1,
    "amount": 10,
    "buyerAddress": "0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199",
    "zkProofInput": {
      "commitment": "0xb613...de6f",
      "secret": "buyer_secret",
      "nullifier": "buyer_nullifier"
    }
  }'
```

**4. Check Oracle Metrics:**
```bash
curl http://localhost:3001/api/oracle/metrics
```

---

## Architecture

```
backend/
├── src/
│   ├── api/
│   │   ├── routes.ts         # All API endpoints
│   │   └── validation.ts     # Joi schemas
│   ├── services/
│   │   ├── contractService.ts
│   │   └── rwaService.ts
│   ├── oracle/
│   │   └── pythClient.ts     # Pyth + cron
│   ├── zk/
│   │   └── prover.ts         # ZK proof gen
│   ├── utils/
│   │   ├── config.ts
│   │   └── logger.ts
│   └── server.ts
├── logs/
│   └── error-log.txt         # Auto-created
└── scripts/
    ├── mint-rwa-token.ts     # CLI minting
    ├── purchase-rwa-token.ts # CLI purchase
    └── query-token.ts        # CLI query
```

---

## Testing

### CLI Scripts
```bash
# Mint RWA token
npx ts-node scripts/mint-rwa-token.ts

# Purchase fractions
npx ts-node scripts/purchase-rwa-token.ts <tokenId> <amount>

# Query token state
npx ts-node scripts/query-token.ts <tokenId>

# View error logs
./test-error-logging.sh
```

---

## Deployment

### Environment Variables
Create `.env` file:
```env
PORT=3001
NODE_ENV=development
MANTLE_RPC_URL=https://rpc.testnet.mantle.xyz
CHAIN_ID=5003
PRIVATE_KEY=0x...

CONTRACT_ADDRESS_ZK_VERIFIER=0x...
CONTRACT_ADDRESS_PYTH_ORACLE_READER=0x...
CONTRACT_ADDRESS_FRACTION_MANAGER=0x...
CONTRACT_ADDRESS_RWA_FACTORY=0x...
CONTRACT_ADDRESS_YIELD_CALCULATOR=0x...
PYTH_CONTRACT_ADDRESS=0x98046Bd286715D3B0BC227Dd7a956b83D8978603

PYTH_API_URL=https://hermes.pyth.network
PYTH_PRICE_FEED_ETH_USD=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
PYTH_PRICE_FEED_BTC_USD=0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
PYTH_PRICE_FEED_USDC_USD=0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
```

### Mantle Testnet
- Chain ID: `5003`
- RPC: `https://rpc.testnet.mantle.xyz`
- Explorer: `https://explorer.testnet.mantle.xyz`
- Faucet: `https://faucet.testnet.mantle.xyz`

---

## Troubleshooting

### RPC Issues
- Verify `MANTLE_RPC_URL` in `.env`
- Check Mantle testnet status

### Transaction Failures
- Ensure wallet has testnet MNT for gas
- Get MNT from faucet: https://faucet.testnet.mantle.xyz

### Contract Errors
- Verify addresses match `contracts/deployments.json`
- Check if contracts are deployed

### Oracle Issues
- Check `./test-error-logging.sh` for errors
- Verify Pyth API is accessible

---

## Future Enhancements

### Production Roadmap
1. **Authentication** - API key or JWT
2. **GET /api/rwa/:tokenId** - Query token metadata
3. **WebSocket** - Real-time price feeds
4. **Database** - PostgreSQL for analytics
5. **Monitoring** - Prometheus + Grafana
6. **Mainnet** - Deploy on Mantle mainnet

---

## Resources

- **Project Guide**: See `AGENTS.md`
- **Contracts**: See `contracts/README.md`
- **Pyth Docs**: https://docs.pyth.network
- **Mantle Docs**: https://docs.mantle.xyz

---

**Last Updated:** January 15, 2026  
**API Version:** v1.0.0 (MVP)  
**License:** MIT
