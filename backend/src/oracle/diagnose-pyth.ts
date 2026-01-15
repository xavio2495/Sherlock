import { ethers } from 'ethers';

/**
 * Diagnostic script to check Pyth contract integration
 * Run with: npx ts-node diagnose-pyth.ts
 */

const MANTLE_TESTNET_RPC = 'https://rpc.sepolia.mantle.xyz';
const PYTH_CONTRACT = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603';
const PYTH_ORACLE_READER = '0xFcCF01179c3e6AB33796a9D2804380D1C609b3bA';

const PYTH_ABI = [
  'function getUpdateFee(bytes[] calldata updateData) external view returns (uint)',
  'function updatePriceFeeds(bytes[] calldata updateData) external payable',
  'function getPriceUnsafe(bytes32 id) external view returns (tuple(int64 price, uint64 conf, int32 expo, uint publishTime))',
];

const ORACLE_READER_ABI = [
  'function pyth() external view returns (address)',
  'function supportedFeeds(bytes32) external view returns (bool)',
  'function ETH_USD_FEED() external view returns (bytes32)',
];

async function diagnose() {
  console.log('🔍 Pyth Integration Diagnostic\n');
  console.log('='.repeat(80));

  const provider = new ethers.JsonRpcProvider(MANTLE_TESTNET_RPC);

  // 1. Check if contracts are deployed
  console.log('\n1️⃣ Checking contract deployments...\n');
  
  const pythCode = await provider.getCode(PYTH_CONTRACT);
  const oracleCode = await provider.getCode(PYTH_ORACLE_READER);
  
  console.log(`Pyth Contract (${PYTH_CONTRACT}):`);
  console.log(`   Code size: ${pythCode.length} bytes`);
  console.log(`   Deployed: ${pythCode !== '0x' ? '✅ YES' : '❌ NO'}\n`);
  
  console.log(`PythOracleReader (${PYTH_ORACLE_READER}):`);
  console.log(`   Code size: ${oracleCode.length} bytes`);
  console.log(`   Deployed: ${oracleCode !== '0x' ? '✅ YES' : '❌ NO'}\n`);

  if (oracleCode === '0x') {
    console.error('❌ PythOracleReader is not deployed at this address!');
    return;
  }

  // 2. Check PythOracleReader configuration
  console.log('2️⃣ Checking PythOracleReader configuration...\n');
  
  const oracleReader = new ethers.Contract(PYTH_ORACLE_READER, ORACLE_READER_ABI, provider);
  
  try {
    const pythAddress = await oracleReader.pyth();
    console.log(`   Configured Pyth address: ${pythAddress}`);
    console.log(`   Expected Pyth address:   ${PYTH_CONTRACT}`);
    console.log(`   Match: ${pythAddress.toLowerCase() === PYTH_CONTRACT.toLowerCase() ? '✅ YES' : '❌ NO'}\n`);
    
    if (pythAddress.toLowerCase() !== PYTH_CONTRACT.toLowerCase()) {
      console.error(`❌ ERROR: PythOracleReader is configured with wrong Pyth address!`);
      console.error(`   It's pointing to: ${pythAddress}`);
      console.error(`   But should point to: ${PYTH_CONTRACT}\n`);
      
      // Check if the configured address has code
      const configuredPythCode = await provider.getCode(pythAddress);
      console.log(`   Code at configured address: ${configuredPythCode.length} bytes`);
      console.log(`   Is deployed: ${configuredPythCode !== '0x' ? '✅ YES' : '❌ NO'}\n`);
    }

    // Check ETH_USD feed
    const ethUsdFeed = await oracleReader.ETH_USD_FEED();
    console.log(`   ETH_USD_FEED constant: ${ethUsdFeed}`);
    
    const isSupported = await oracleReader.supportedFeeds(ethUsdFeed);
    console.log(`   Is ETH/USD supported: ${isSupported ? '✅ YES' : '❌ NO'}\n`);

  } catch (error: any) {
    console.error(`❌ Error reading PythOracleReader:`, error.message);
  }

  // 3. Try to read from Pyth contract
  console.log('3️⃣ Testing Pyth contract directly...\n');
  
  const pythContract = new ethers.Contract(PYTH_CONTRACT, PYTH_ABI, provider);
  const ETH_USD_FEED_ID = '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';
  
  try {
    const priceData = await pythContract.getPriceUnsafe(ETH_USD_FEED_ID);
    console.log(`   ✅ Successfully read ETH/USD price from Pyth:`);
    console.log(`      Price: ${priceData.price}`);
    console.log(`      Expo: ${priceData.expo}`);
    console.log(`      Timestamp: ${new Date(Number(priceData.publishTime) * 1000).toISOString()}\n`);
  } catch (error: any) {
    console.error(`   ❌ Failed to read from Pyth contract:`, error.message);
  }

  console.log('='.repeat(80));
  console.log('\n✅ Diagnostic complete!\n');
}

diagnose().catch(console.error);