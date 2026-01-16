#!/bin/bash

# Check backend wallet balance
source /home/sigma_coder/Hacks/Mantle/Sherlock/backend/.env

echo "======================================"
echo "Backend Wallet Diagnostics"
echo "======================================"
echo ""

# Extract address from private key using cast
WALLET_ADDRESS=$(cast wallet address $PRIVATE_KEY 2>/dev/null || echo "Error getting address")

echo "Wallet Address: $WALLET_ADDRESS"
echo "Network: Mantle Sepolia Testnet"
echo "RPC: $MANTLE_RPC_URL"
echo ""

if [ "$WALLET_ADDRESS" = "Error getting address" ]; then
    echo "✗ Could not derive wallet address from PRIVATE_KEY"
    echo "Please check your .env file"
    exit 1
fi

echo "Checking balance..."
BALANCE=$(cast balance $WALLET_ADDRESS --rpc-url $MANTLE_RPC_URL 2>&1)

if [[ $BALANCE == *"error"* ]] || [[ $BALANCE == *"Error"* ]]; then
    echo "✗ Error checking balance: $BALANCE"
    exit 1
fi

BALANCE_ETH=$(cast to-unit $BALANCE ether 2>/dev/null || echo "0")

echo "Balance: $BALANCE wei"
echo "Balance: $BALANCE_ETH MNT"
echo ""

# Check if balance is sufficient (need at least 0.01 MNT for gas)
MIN_BALANCE="10000000000000000" # 0.01 MNT in wei

if [ "$BALANCE" -lt "$MIN_BALANCE" ]; then
    echo "⚠️  WARNING: Balance is low!"
    echo "Recommended minimum: 0.01 MNT"
    echo ""
    echo "Get testnet MNT from faucet:"
    echo "https://faucet.testnet.mantle.xyz"
    echo ""
    echo "Or use this command to request funds:"
    echo "cast send --rpc-url https://rpc.testnet.mantle.xyz --value 0.1ether $WALLET_ADDRESS"
else
    echo "✓ Balance is sufficient for transactions"
fi

echo ""
echo "Contract Addresses:"
echo "  RWA Factory: $CONTRACT_ADDRESS_RWA_FACTORY"
echo "  ZK Verifier: $CONTRACT_ADDRESS_ZK_VERIFIER"
echo "  Pyth Oracle: $CONTRACT_ADDRESS_PYTH_ORACLE_READER"
echo ""

# Check if wallet has any past transactions
TX_COUNT=$(cast nonce $WALLET_ADDRESS --rpc-url $MANTLE_RPC_URL 2>/dev/null || echo "0")
echo "Transaction Count: $TX_COUNT"

if [ "$TX_COUNT" = "0" ]; then
    echo "ℹ️  No transactions yet from this wallet"
else
    echo "✓ Wallet has sent $TX_COUNT transactions"
fi

echo ""
echo "======================================"
