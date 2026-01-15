/**
 * Script to purchase fractions of an RWA token on Mantle Testnet
 * 
 * Steps:
 * 1. Register buyer commitment on ZKVerifier (if not already registered)
 * 2. Calculate purchase cost
 * 3. Purchase fractions from issuer
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Contract addresses
const ZK_VERIFIER_ADDRESS = process.env.CONTRACT_ADDRESS_ZK_VERIFIER!;
const RWA_FACTORY_ADDRESS = process.env.CONTRACT_ADDRESS_RWA_FACTORY!;

// Network configuration
const RPC_URL = process.env.MANTLE_RPC_URL!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;

// ABIs
const ZK_VERIFIER_ABI = [
  'function registerCommitment(bytes32 commitment) external',
  'function userCommitments(address user) external view returns (bytes32 commitmentHash, uint256 timestamp, bool isActive)',
];

const RWA_FACTORY_ABI = [
  'function purchaseFraction(uint256 tokenId, uint256 amount, bytes memory buyerZKProof) external payable',
  'function getAssetMetadata(uint256 tokenId) external view returns (tuple(address issuer, string documentHash, uint256 totalValue, uint256 fractionCount, uint256 minFractionSize, uint256 mintTimestamp, uint256 oraclePriceAtMint, bytes32 priceId, bool verified))',
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'event FractionPurchased(uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 cost)',
];

/**
 * Compute commitment using keccak256 (simple hash-based commitment)
 */
function computeCommitment(secret: string): string {
  const secretBytes = ethers.toUtf8Bytes(secret);
  const commitment = ethers.keccak256(secretBytes);
  
  console.log(`Secret: ${secret}`);
  console.log(`Commitment: ${commitment}`);
  
  return commitment;
}

async function main() {
  console.log('========================================');
  console.log('RWA Token Purchase Script');
  console.log('========================================\n');
  
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx ts-node scripts/purchase-rwa-token.ts <tokenId> <amount>');
    console.error('Example: npx ts-node scripts/purchase-rwa-token.ts 1 10');
    process.exit(1);
  }
  
  const tokenId = parseInt(args[0]);
  const amount = parseInt(args[1]);
  
  console.log(`Token ID: ${tokenId}`);
  console.log(`Amount: ${amount} fractions\n`);
  
  // Setup provider and wallet
  console.log('Connecting to Mantle Testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const buyerAddress = await wallet.getAddress();
  
  console.log(`Buyer Address: ${buyerAddress}`);
  
  // Check balance
  const balance = await provider.getBalance(buyerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} MNT\n`);
  
  if (balance === 0n) {
    console.error('❌ Error: Wallet has no funds. Get testnet MNT from https://faucet.testnet.mantle.xyz');
    process.exit(1);
  }
  
  // Connect to contracts
  const zkVerifier = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI, wallet);
  const rwaFactory = new ethers.Contract(RWA_FACTORY_ADDRESS, RWA_FACTORY_ABI, wallet);
  
  // Step 1: Check and register buyer commitment
  console.log('Step 1: Checking buyer commitment on ZKVerifier');
  console.log('─────────────────────────────────────────────────');
  
  const commitmentData = await zkVerifier.userCommitments(buyerAddress);
  const isRegistered = commitmentData.isActive;
  console.log(`Already registered: ${isRegistered}\n`);
  
  let commitment: string;
  
  if (!isRegistered) {
    // Generate commitment (different secret from issuer)
    const secret = 'buyer_secret_98765';
    commitment = computeCommitment(secret);
    
    console.log('Registering buyer commitment...');
    const tx = await zkVerifier.registerCommitment(commitment);
    console.log(`Transaction hash: ${tx.hash}`);
    
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✓ Commitment registered in block ${receipt.blockNumber}\n`);
  } else {
    console.log('⚠ Buyer already registered, skipping commitment registration\n');
    commitment = computeCommitment('buyer_secret_98765');
  }
  
  // Step 2: Get token metadata and calculate cost
  console.log('Step 2: Fetching token metadata');
  console.log('─────────────────────────────────────────────────');
  
  let metadata;
  try {
    metadata = await rwaFactory.getAssetMetadata(tokenId);
  } catch (error) {
    console.error(`❌ Error: Token ID ${tokenId} not found`);
    process.exit(1);
  }
  
  console.log(`Issuer: ${metadata.issuer}`);
  console.log(`Document Hash: ${metadata.documentHash}`);
  console.log(`Total Value: $${(Number(metadata.totalValue) / 100).toFixed(2)}`);
  console.log(`Fraction Count: ${metadata.fractionCount.toString()}`);
  console.log(`Min Fraction Size: ${metadata.minFractionSize.toString()}\n`);
  
  // Check issuer balance
  const issuerBalance = await rwaFactory.balanceOf(metadata.issuer, tokenId);
  console.log(`Issuer has ${issuerBalance.toString()} fractions available\n`);
  
  if (issuerBalance < BigInt(amount)) {
    console.error(`❌ Error: Issuer only has ${issuerBalance.toString()} fractions, cannot purchase ${amount}`);
    process.exit(1);
  }
  
  // Calculate cost
  const totalValue = BigInt(metadata.totalValue);
  const fractionCount = BigInt(metadata.fractionCount);
  const cost = (totalValue * BigInt(amount)) / fractionCount;
  
  console.log('Purchase Calculation:');
  console.log(`  Price per fraction: $${(Number(totalValue) / Number(fractionCount) / 100).toFixed(2)}`);
  console.log(`  Amount: ${amount} fractions`);
  console.log(`  Total cost: $${(Number(cost) / 100).toFixed(2)} (${cost.toString()} cents)\n`);
  
  // Step 3: Purchase fractions
  console.log('Step 3: Purchasing fractions');
  console.log('─────────────────────────────────────────────────');
  
  // Convert cost from cents to wei (1 cent = 1 wei for simplicity in testnet)
  const costInWei = cost;
  const zkProof = '0x'; // Empty proof for MVP
  
  console.log(`Sending ${ethers.formatEther(costInWei)} MNT...`);
  console.log('Calling purchaseFraction()...');
  
  const purchaseTx = await rwaFactory.purchaseFraction(
    tokenId,
    amount,
    zkProof,
    { value: costInWei }
  );
  
  console.log(`Transaction hash: ${purchaseTx.hash}`);
  console.log('Waiting for confirmation...');
  
  const purchaseReceipt = await purchaseTx.wait();
  console.log(`✓ Purchase confirmed in block ${purchaseReceipt.blockNumber}\n`);
  
  // Parse FractionPurchased event
  const purchaseEvent = purchaseReceipt.logs
    .map((log: any) => {
      try {
        return rwaFactory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event && event.name === 'FractionPurchased');
  
  if (purchaseEvent) {
    console.log('========================================');
    console.log('✓ SUCCESS');
    console.log('========================================');
    console.log(`Token ID: ${purchaseEvent.args.tokenId.toString()}`);
    console.log(`Buyer: ${purchaseEvent.args.buyer}`);
    console.log(`Amount Purchased: ${purchaseEvent.args.amount.toString()} fractions`);
    console.log(`Cost Paid: $${(Number(purchaseEvent.args.cost) / 100).toFixed(2)}`);
    console.log(`\nExplorer: https://explorer.sepolia.mantle.xyz/tx/${purchaseTx.hash}`);
    console.log('========================================');
  } else {
    console.log('⚠ Warning: FractionPurchased event not found in transaction logs');
  }
  
  // Check final balances
  console.log('\nFinal Balances:');
  console.log('─────────────────────────────────────────────────');
  const buyerFinalBalance = await rwaFactory.balanceOf(buyerAddress, tokenId);
  const issuerFinalBalance = await rwaFactory.balanceOf(metadata.issuer, tokenId);
  console.log(`Buyer (${buyerAddress}): ${buyerFinalBalance.toString()} fractions`);
  console.log(`Issuer (${metadata.issuer}): ${issuerFinalBalance.toString()} fractions`);
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
    process.exit(1);
  });
