/**
 * Query token information and holder balances
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const RWA_FACTORY_ADDRESS = process.env.CONTRACT_ADDRESS_RWA_FACTORY!;
const RPC_URL = process.env.MANTLE_RPC_URL!;

const RWA_FACTORY_ABI = [
  'function getAssetMetadata(uint256 tokenId) external view returns (tuple(address issuer, string documentHash, uint256 totalValue, uint256 fractionCount, uint256 minFractionSize, uint256 mintTimestamp, uint256 oraclePriceAtMint, bytes32 priceId, bool verified))',
  'function balanceOf(address account, uint256 id) external view returns (uint256)',
  'function nextTokenId() external view returns (uint256)',
];

async function main() {
  const args = process.argv.slice(2);
  const tokenId = args[0] ? parseInt(args[0]) : 1;
  
  console.log('========================================');
  console.log('RWA Token Information');
  console.log('========================================\n');
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const rwaFactory = new ethers.Contract(RWA_FACTORY_ADDRESS, RWA_FACTORY_ABI, provider);
  
  // Get next token ID (total minted)
  const nextId = await rwaFactory.nextTokenId();
  console.log(`Total Tokens Minted: ${(Number(nextId) - 1)}\n`);
  
  console.log(`Token ID: ${tokenId}`);
  console.log('─────────────────────────────────────────────────\n');
  
  try {
    const metadata = await rwaFactory.getAssetMetadata(tokenId);
    
    console.log('📋 Metadata:');
    console.log(`  Issuer: ${metadata.issuer}`);
    console.log(`  Document Hash: ${metadata.documentHash}`);
    console.log(`  Total Value: $${(Number(metadata.totalValue) / 100).toFixed(2)}`);
    console.log(`  Fraction Count: ${metadata.fractionCount.toString()}`);
    console.log(`  Min Fraction Size: ${metadata.minFractionSize.toString()}`);
    console.log(`  Mint Timestamp: ${new Date(Number(metadata.mintTimestamp) * 1000).toISOString()}`);
    console.log(`  Oracle Price at Mint: ${metadata.oraclePriceAtMint.toString()}`);
    console.log(`  Price Feed ID: ${metadata.priceId}`);
    console.log(`  Verified: ${metadata.verified}\n`);
    
    console.log('💰 Holdings:');
    const issuerBalance = await rwaFactory.balanceOf(metadata.issuer, tokenId);
    console.log(`  Issuer (${metadata.issuer}): ${issuerBalance.toString()} fractions`);
    
    const pricePerFraction = Number(metadata.totalValue) / Number(metadata.fractionCount) / 100;
    console.log(`\n📊 Economics:`);
    console.log(`  Price per Fraction: $${pricePerFraction.toFixed(2)}`);
    console.log(`  Total Available: ${issuerBalance.toString()} fractions`);
    console.log(`  Available Value: $${(Number(issuerBalance) * pricePerFraction).toFixed(2)}`);
    
    if (args[1]) {
      // Check specific address balance
      const address = args[1];
      const balance = await rwaFactory.balanceOf(address, tokenId);
      console.log(`\n  Address ${address}: ${balance.toString()} fractions`);
    }
    
    console.log('\n========================================');
    
  } catch (error: any) {
    console.error(`❌ Token ID ${tokenId} not found or error: ${error.message}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
