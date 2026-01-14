# Sherlock RWA Contracts

Smart contracts for the Sherlock Real World Asset (RWA) tokenization platform on Mantle Network.

## Overview

This directory contains Solidity smart contracts built with Foundry for privacy-focused RWA tokenization with ZK proofs and Pyth oracle integration.

## Contract Architecture

### Core Contracts

1. **RWATokenFactory.sol** - Main ERC-1155 factory for minting RWA tokens
   - Mints fractional RWA tokens with metadata
   - Integrates with ZKVerifier for issuer eligibility
   - Records oracle prices at mint time

2. **ZKVerifier.sol** - Zero-knowledge proof verification
   - Commitment-based eligibility verification
   - Range proofs for privacy-preserving balance checks
   - Future upgrade path to Groth16 verifier

3. **PythOracleReader.sol** - Pyth Network price feed integration
   - Caches oracle prices on-chain
   - Supports multiple price feeds (ETH/USD, BTC/USD, USDC/USD)
   - Records historical prices for tokens

4. **FractionManager.sol** - Fraction specification and transfer management
   - Enforces minimum fraction sizes
   - Lockup period management
   - Fraction recombination logic

5. **YieldCalculator.sol** - Yield calculation and token valuation
   - APY calculations using oracle data
   - Token value preview functionality
   - Simple and compound interest support

## Setup

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Mantle Testnet MNT for deployment

### Installation

```bash
# Install dependencies (already done)
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with verbose output
forge test -vvv
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `MANTLE_RPC_URL` - Mantle testnet RPC endpoint
- `PRIVATE_KEY` - Your deployment wallet private key
- `PYTH_CONTRACT_ADDRESS` - Pyth oracle contract (pre-filled)
- `ETHERSCAN_API_KEY` - For contract verification

## Deployment

### Deploy to Mantle Testnet

```bash
# Load environment variables
source .env

# Run deployment script
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url $MANTLE_RPC_URL \
  --broadcast \
  --verify

# Deployment addresses will be saved to deployments.txt
```

### Deployment Order

The deploy script follows the correct dependency order:
1. ZKVerifier
2. PythOracleReader (requires Pyth contract address)
3. FractionManager
4. YieldCalculator (requires PythOracleReader)
5. RWATokenFactory (requires all above contracts)

## Testing

### Run All Tests

```bash
forge test
```

### Run Specific Test File

```bash
forge test --match-path test/RWATokenFactory.t.sol
```

### Run Specific Test Function

```bash
forge test --match-test testInitialSetup
```

### Test Coverage

```bash
forge coverage
```

## Contract Addresses

### Mantle Testnet

After deployment, addresses will be saved to `deployments.txt`. Update your `.env` file with these addresses.

**Pyth Contract**: `0xA2aa501b19aff244D90cc15a4Cf739D2725B5729`

## Development

### Adding New Functions

1. Update the relevant contract in `src/`
2. Add corresponding tests in `test/`
3. Run `forge test` to verify
4. Update deployment script if needed

### Gas Optimization

Check gas reports:
```bash
forge test --gas-report
```

### Contract Verification

Verify deployed contracts on Mantle Explorer:

```bash
forge verify-contract \
  <CONTRACT_ADDRESS> \
  <CONTRACT_NAME> \
  --chain-id 5003 \
  --watch
```

## Architecture Decisions

- **ERC-1155**: Chosen for fractional ownership with single contract
- **Commitment Scheme**: MVP uses simple hash commitments for ZK proofs
- **Oracle Caching**: Reduces gas costs by caching Pyth prices on-chain
- **Modular Design**: Separate contracts for each concern (ZK, Oracle, Fractions, Yield)

## Security Considerations

⚠️ **These contracts are in development and have NOT been audited**

- Always test on testnet first
- Never use real funds on unaudited contracts
- Review all TODOs before production deployment
- Consider security audit before mainnet launch

## Resources

- [Foundry Book](https://book.getfoundry.sh/)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Pyth Network Docs](https://docs.pyth.network/)
- [Mantle Network Docs](https://docs.mantle.xyz/)

## License

MIT
