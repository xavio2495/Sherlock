/**
 * Script to purchase fractions using a different buyer wallet
 * This demonstrates a real purchase between issuer and buyer
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

// Create a new random wallet for the buyer
const buyerWallet = ethers.Wallet.createRandom();

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

function computeCommitment(secret: string): string {
  const secretBytes = ethers.toUtf8Bytes(secret);
  const commitment = ethers.keccak256(secretBytes);
  return commitment;
}

async function main() {
  console.log('========================================');
  console.log('RWA Token Purchase (New Buyer Wallet)');
  console.log('========================================\n');
  
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: npx ts-node scripts/purchase-as-new-buyer.ts <tokenId> <amount>');
    console.error('Example: npx ts-node scripts/purchase-as-new-buyer.ts 1 5');
    process.exit(1);
  }
  
  const tokenId = parseInt(args[0]);
  const amount = parseInt(args[1]);
  
  console.log(`Token ID: ${tokenId}`);
  console.log(`Amount: ${amount} fractions\n`);
  
  // Setup provider
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  
  // New buyer wallet (not connected yet)
  console.log('Generated New Buyer Wallet:');
  console.log(`Address: ${buyerWallet.address}`);
  console.log(`Private Key: ${buyerWallet.privateKey}`);
  console.log('\n⚠️  IMPORTANT: This wallet needs MNT to pay for the purchase!');
  console.log(`Send testnet MNT to: ${buyerWallet.address}`);
  console.log('Get testnet MNT from: https://faucet.testnet.mantle.xyz\n');
  
  // Connect wallet to provider
  const connectedWallet = buyerWallet.connect(provider);
  
  // Check balance
  const balance = await provider.getBalance(buyerWallet.address);
  console.log(`Current Balance: ${ethers.formatEther(balance)} MNT\n`);
  
  if (balance === 0n) {
    console.error('❌ Error: Wallet has no funds. Please send MNT to the address above and run again.');
    console.error(`\nTo fund this wallet, run:`);
    console.error(`npx ts-node scripts/fund-wallet.ts ${buyerWallet.address} 0.1\n`);
    process.exit(1);
  }
  
  // Connect to contracts
  const zkVerifier = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI, connectedWallet);
  const rwaFactory = new ethers.Contract(RWA_FACTORY_ADDRESS, RWA_FACTORY_ABI, connectedWallet);
  
  // Step 1: Register buyer commitment
  console.log('Step 1: Registering buyer commitment');
  console.log('─────────────────────────────────────────────────');
  
  const secret = `buyer_${buyerWallet.address.slice(2, 10)}`;
  const commitment = computeCommitment(secret);
  
  console.log(`Secret: ${secret}`);
  console.log(`Commitment: ${commitment}`);
  
  const commitmentData = await zkVerifier.userCommitments(buyerWallet.address);
  const isRegistered = commitmentData.isActive;
  
  if (!isRegistered) {
    console.log('Registering commitment...');
    const tx = await zkVerifier.registerCommitment(commitment);
    console.log(`Transaction hash: ${tx.hash}`);
    await tx.wait();
    console.log('✓ Commitment registered\n');
  } else {
    console.log('✓ Already registered\n');
  }
  
  // Step 2: Get token metadata
  console.log('Step 2: Fetching token metadata');
  console.log('─────────────────────────────────────────────────');
  
  const metadata = await rwaFactory.getAssetMetadata(tokenId);
  console.log(`Issuer: ${metadata.issuer}`);
  console.log(`Total Value: $${(Number(metadata.totalValue) / 100).toFixed(2)}`);
  console.log(`Fraction Count: ${metadata.fractionCount.toString()}\n`);
  
  const issuerBalance = await rwaFactory.balanceOf(metadata.issuer, tokenId);
  console.log(`Issuer has ${issuerBalance.toString()} fractions available\n`);
  
  if (issuerBalance < BigInt(amount)) {
    console.error(`❌ Error: Issuer only has ${issuerBalance.toString()} fractions`);
    process.exit(1);
  }
  
  // Calculate cost
  const totalValue = BigInt(metadata.totalValue);
  const fractionCount = BigInt(metadata.fractionCount);
  const cost = (totalValue * BigInt(amount)) / fractionCount;
  const costInWei = cost;
  
  console.log('Purchase Calculation:');
  console.log(`  Price per fraction: $${(Number(totalValue) / Number(fractionCount) / 100).toFixed(2)}`);
  console.log(`  Amount: ${amount} fractions`);
  console.log(`  Total cost: $${(Number(cost) / 100).toFixed(2)}\n`);
  
  // Step 3: Purchase
  console.log('Step 3: Purchasing fractions');
  console.log('─────────────────────────────────────────────────');
  
  const zkProof = '0x';
  const purchaseTx = await rwaFactory.purchaseFraction(tokenId, amount, zkProof, { value: costInWei });
  
  console.log(`Transaction hash: ${purchaseTx.hash}`);
  const purchaseReceipt = await purchaseTx.wait();
  console.log(`✓ Purchase confirmed in block ${purchaseReceipt.blockNumber}\n`);
  
  console.log('========================================');
  console.log('✓ SUCCESS');
  console.log('========================================');
  console.log(`Buyer: ${buyerWallet.address}`);
  console.log(`Token ID: ${tokenId}`);
  console.log(`Amount: ${amount} fractions`);
  console.log(`Cost: $${(Number(cost) / 100).toFixed(2)}`);
  console.log(`\nExplorer: https://explorer.sepolia.mantle.xyz/tx/${purchaseTx.hash}`);
  
  // Final balances
  const buyerFinalBalance = await rwaFactory.balanceOf(buyerWallet.address, tokenId);
  const issuerFinalBalance = await rwaFactory.balanceOf(metadata.issuer, tokenId);
  console.log('\nFinal Balances:');
  console.log(`  Buyer: ${buyerFinalBalance.toString()} fractions`);
  console.log(`  Issuer: ${issuerFinalBalance.toString()} fractions`);
  console.log('========================================');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });
