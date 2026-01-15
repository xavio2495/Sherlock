/**
 * Script to register issuer and mint RWA token on Mantle Testnet
 * 
 * Steps:
 * 1. Register issuer commitment on ZKVerifier
 * 2. Mint RWA token on RWATokenFactory
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

// Price feed IDs
const ETH_USD_PRICE_ID = process.env.PRICE_FEED_ETH_USD!;

// ABIs (simplified)
const ZK_VERIFIER_ABI = [
  'function registerCommitment(bytes32 commitment) external',
  'function userCommitments(address user) external view returns (bytes32 commitmentHash, uint256 timestamp, bool isActive)',
];

const RWA_FACTORY_ABI = [
  'function mintRWAToken(string memory documentHash, uint256 totalValue, uint256 fractionCount, uint256 minFractionSize, uint256 lockupWeeks, bytes memory zkProof, bytes32 priceId) external returns (uint256)',
  'event AssetMinted(uint256 indexed tokenId, address indexed issuer, string documentHash, uint256 totalValue, uint256 fractionCount, bytes32 priceId, uint256 oraclePrice)',
];

/**
 * Compute commitment using keccak256 (simple hash-based commitment)
 * This matches what the contract expects for MVP
 * Contract expects: keccak256(abi.encodePacked(secret))
 */
function computeCommitment(secret: string): string {
  // Convert secret to bytes and hash (matching Solidity's keccak256(abi.encodePacked(secret)))
  const secretBytes = ethers.toUtf8Bytes(secret);
  const commitment = ethers.keccak256(secretBytes);
  
  console.log(`Secret: ${secret}`);
  console.log(`Commitment: ${commitment}`);
  
  return commitment;
}

async function main() {
  console.log('========================================');
  console.log('RWA Token Minting Script');
  console.log('========================================\n');
  
  // Setup provider and wallet
  console.log('Connecting to Mantle Testnet...');
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const issuerAddress = await wallet.getAddress();
  
  console.log(`Issuer Address: ${issuerAddress}`);
  
  // Check balance
  const balance = await provider.getBalance(issuerAddress);
  console.log(`Balance: ${ethers.formatEther(balance)} MNT\n`);
  
  if (balance === 0n) {
    console.error('❌ Error: Wallet has no funds. Get testnet MNT from https://faucet.testnet.mantle.xyz');
    process.exit(1);
  }
  
  // Step 1: Register commitment on ZKVerifier
  console.log('Step 1: Registering issuer commitment on ZKVerifier');
  console.log('─────────────────────────────────────────────────');
  
  const zkVerifier = new ethers.Contract(ZK_VERIFIER_ADDRESS, ZK_VERIFIER_ABI, wallet);
  
  // Check if already registered
  const commitmentData = await zkVerifier.userCommitments(issuerAddress);
  const isRegistered = commitmentData.isActive;
  console.log(`Already registered: ${isRegistered}\n`);
  
  let commitment: string;
  
  if (!isRegistered) {
    // Generate commitment (use same format as tests)
    const secret = 'issuer_secret_12345';
    commitment = computeCommitment(secret);
    
    console.log('Registering commitment...');
    const tx = await zkVerifier.registerCommitment(commitment);
    console.log(`Transaction hash: ${tx.hash}`);
    
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log(`✓ Commitment registered in block ${receipt.blockNumber}\n`);
  } else {
    console.log('⚠ Issuer already registered, skipping commitment registration\n');
    // For already registered, we'll compute it anyway for reference
    commitment = computeCommitment('issuer_secret_12345');
  }
  
  // Step 2: Check oracle has recent price
  console.log('Step 2: Checking oracle price feed');
  console.log('─────────────────────────────────────────────────');
  
  console.log('Oracle prices should be updated by the backend service.');
  console.log(`Price feed ID: ${ETH_USD_PRICE_ID}\n`);
  
  // Step 3: Mint RWA token
  console.log('Step 3: Minting RWA token');
  console.log('─────────────────────────────────────────────────');
  
  const rwaFactory = new ethers.Contract(RWA_FACTORY_ADDRESS, RWA_FACTORY_ABI, wallet);
  
  // Token parameters
  const documentHash = 'QmX4Z1q8Y9P7RwBvTg6H3Nj8KmL2PqWxY5Zc9VuT6RsD3Fg';
  const totalValue = 100000; // $1,000.00 (in cents)
  const fractionCount = 100;
  const minFractionSize = 1;
  const lockupWeeks = 0;
  const zkProof = '0x'; // Empty proof for MVP
  
  console.log('Token Parameters:');
  console.log(`  Document Hash: ${documentHash}`);
  console.log(`  Total Value: $${(totalValue / 100).toFixed(2)}`);
  console.log(`  Fraction Count: ${fractionCount}`);
  console.log(`  Min Fraction Size: ${minFractionSize}`);
  console.log(`  Lockup Period: ${lockupWeeks} weeks`);
  console.log(`  Price Feed: ETH/USD\n`);
  
  console.log('Minting token...');
  const mintTx = await rwaFactory.mintRWAToken(
    documentHash,
    totalValue,
    fractionCount,
    minFractionSize,
    lockupWeeks,
    zkProof,
    ETH_USD_PRICE_ID
  );
  
  console.log(`Transaction hash: ${mintTx.hash}`);
  console.log('Waiting for confirmation...');
  
  const mintReceipt = await mintTx.wait();
  console.log(`✓ Token minted in block ${mintReceipt.blockNumber}\n`);
  
  // Parse AssetMinted event
  const mintEvent = mintReceipt.logs
    .map((log: any) => {
      try {
        return rwaFactory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((event: any) => event && event.name === 'AssetMinted');
  
  if (mintEvent) {
    const tokenId = mintEvent.args.tokenId.toString();
    const oraclePrice = mintEvent.args.oraclePrice.toString();
    console.log('========================================');
    console.log('✓ SUCCESS');
    console.log('========================================');
    console.log(`Token ID: ${tokenId}`);
    console.log(`Issuer: ${mintEvent.args.issuer}`);
    console.log(`Total Value: $${(mintEvent.args.totalValue.toString() / 100).toFixed(2)}`);
    console.log(`Fraction Count: ${mintEvent.args.fractionCount.toString()}`);
    console.log(`Oracle Price (at mint): ${oraclePrice}`);
    console.log(`\nExplorer: https://explorer.sepolia.mantle.xyz/tx/${mintTx.hash}`);
    console.log('========================================');
  } else {
    console.log('⚠ Warning: AssetMinted event not found in transaction logs');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
    process.exit(1);
  });
