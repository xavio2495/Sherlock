# Sherlock Backend API

Express.js backend for the Sherlock RWA tokenization platform on Mantle Network.

## Features

- **RWA Token Creation**: Mint new RWA tokens with ZK proof verification
- **ZK Proof Generation**: Generate eligibility and range proofs using SnarkJS
- **Pyth Oracle Integration**: Fetch and submit price updates to on-chain contracts
- **Automated Price Updates**: Cron job for continuous oracle updates

## Setup

### Prerequisites

- Node.js 18+ and npm
- Access to Mantle Testnet RPC
- Deployed smart contracts (see `contracts/deployments.json`)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your private key and configuration
nano .env
```

### Environment Variables

The `.env.example` file is pre-populated with deployed contract addresses from Mantle Testnet. Update the following:

- `PRIVATE_KEY`: Your wallet private key (for submitting oracle updates)
- `MANTLE_RPC_URL`: Mantle testnet RPC endpoint (default provided)
- Other values are pre-configured from deployment

## Development

```bash
# Start development server with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

### RWA Token Creation
```bash
POST /api/rwa/create
Content-Type: application/json

{
  "issuerAddress": "0x...",
  "documentHash": "QmXXX...",
  "totalValue": 100000,
  "fractionCount": 100,
  "minFractionSize": 1,
  "lockupPeriod": 0,
  "assetType": "invoice",
  "zkProofInput": {
    "commitment": "0x...",
    "nullifier": "0x..."
  }
}
```

### Purchase Fractions
```bash
POST /api/rwa/purchase
Content-Type: application/json

{
  "tokenId": 1,
  "amount": 10,
  "buyerAddress": "0x...",
  "zkProof": "0x...",
  "secret": "buyer_secret",
  "nullifier": "buyer_nullifier"
}
```

### Generate ZK Proof
```bash
POST /api/zk/generate-proof
Content-Type: application/json

{
  "proofType": "eligibility",
  "userAddress": "0x...",
  "inputs": {
    "commitment": "0x...",
    "secret": "xxx"
  }
}
```

### Get Oracle Prices
```bash
GET /api/oracle/prices
```

### Update Oracle Prices
```bash
POST /api/oracle/update-prices
Content-Type: application/json

{
  "priceIds": ["0xff614...", "0xe62df..."]
}
```

## Architecture

```
src/
├── api/
│   └── routes.ts           # Express routes
├── zk/
│   └── prover.ts           # SnarkJS proof generation
├── oracle/
│   └── pythClient.ts       # Pyth price service integration
├── services/
│   └── rwaService.ts       # RWA business logic
├── utils/
│   ├── config.ts           # Configuration management
│   ├── contractInteraction.ts  # Ethers.js contract calls
│   └── logger.ts           # Logging utility
├── types/
│   └── index.ts            # TypeScript type definitions
└── server.ts               # Express app entry point
```

## ZK Circuits

The `circuits/` directory will contain Circom circuits for:
- `eligibility.circom` - Commitment-based eligibility proof
- `rangeProof.circom` - Privacy-preserving range proof

*Note: Circuit implementation is pending. Current ZK proof generation returns mock proofs.*

## Automated Oracle Updates

The backend automatically fetches prices from Pyth and submits updates to the `PythOracleReader` contract every 5 minutes (configurable via `ORACLE_UPDATE_INTERVAL_MS`).

Monitor logs to see update transactions:
```
[INFO] [PythClient] Running scheduled price update
[INFO] [PythClient] Updating 3 price feeds on-chain
[INFO] [PythClient] Price update transaction sent: 0x...
```

## Troubleshooting

### RPC Connection Issues
- Verify `MANTLE_RPC_URL` in `.env`
- Check Mantle testnet status

### Transaction Failures
- Ensure wallet has sufficient MNT for gas
- Get testnet MNT from: https://faucet.testnet.mantle.xyz

### Contract Call Errors
- Verify contract addresses in `.env` match `contracts/deployments.json`
- Check if contracts are deployed and verified

## License

MIT
