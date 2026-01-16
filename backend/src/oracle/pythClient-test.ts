import { HermesClient } from '@pythnetwork/hermes-client';

/**
 * Simple test script to fetch Pyth price feeds from Hermes API
 * Usage: npm run test:pyth
 */

// Pyth Price Feed IDs (from AGENTS.md)
const PRICE_FEEDS = {
  ETH_USD: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  BTC_USD: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  USDC_USD: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
};

// Mantle Testnet Pyth Contract Address
const MANTLE_TESTNET_PYTH = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603';

async function testPythPriceFeeds() {
  console.log('🔍 Testing Pyth Hermes Client...\n');
  console.log(`Mantle Testnet Pyth Contract: ${MANTLE_TESTNET_PYTH}\n`);

  // Initialize Hermes client
  const hermesClient = new HermesClient('https://hermes.pyth.network', {
    timeout: 10000,
  });

  const priceIds = Object.values(PRICE_FEEDS);

  try {
    console.log('📊 Fetching latest price updates...\n');

    // Fetch latest prices with parsed data
    const priceUpdates = await hermesClient.getLatestPriceUpdates(priceIds, {
      parsed: true,
    });

    if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
      console.error('❌ No price data received');
      return;
    }

    console.log('✅ Price Feeds Retrieved:\n');
    console.log('='.repeat(80));

    // Display each price feed
    for (const feed of priceUpdates.parsed) {
      const price = feed.price;
      
      // Match feed ID without 0x prefix
      const feedName = Object.keys(PRICE_FEEDS).find(
        (key) => PRICE_FEEDS[key as keyof typeof PRICE_FEEDS] === feed.id
      ) || 'UNKNOWN';

      // Calculate human-readable price (price * 10^expo)
      const humanPrice = parseFloat(price.price) * Math.pow(10, price.expo);
      const confidence = parseFloat(price.conf) * Math.pow(10, price.expo);
      const prevPrice = price.prev_price ? parseFloat(price.prev_price as string) * Math.pow(10, price.expo) : null;

      console.log(`\n📈 ${feedName}`);
      console.log(`   Feed ID: ${feed.id}`);
      console.log(`   Price: $${humanPrice.toFixed(2)}`);
      console.log(`   Confidence: ±$${confidence.toFixed(2)}`);
      console.log(`   Exponent: ${price.expo}`);
      console.log(`   Publish Time: ${new Date(price.publish_time * 1000).toISOString()}`);
      if (prevPrice !== null && !isNaN(prevPrice)) {
        console.log(`   Previous Price: $${prevPrice.toFixed(2)}`);
      }
    }

    console.log('\n' + '='.repeat(80));

    // Also get price update data (for on-chain submission)
    console.log('\n📦 Getting price update data (hex format)...\n');
    
    const updateData = await hermesClient.getLatestPriceUpdates(priceIds, {
      encoding: 'hex',
    });

    if (updateData.binary && updateData.binary.data) {
      console.log(`✅ Received ${updateData.binary.data.length} price update VAA(s)`);
      console.log(`   First VAA (hex): ${updateData.binary.data[0].substring(0, 66)}...`);
      console.log(`   VAA Length: ${updateData.binary.data[0].length} characters`);
      
      // Show that VAAs need 0x prefix for ethers.js
      const formattedVAA = updateData.binary.data[0].startsWith('0x') 
        ? updateData.binary.data[0] 
        : `0x${updateData.binary.data[0]}`;
      console.log(`   Formatted for ethers.js: ${formattedVAA.substring(0, 66)}...`);
    }

    console.log('\n✅ Test completed successfully!\n');
    console.log('💡 Next Steps:');
    console.log('   1. Update PythOracleReader contract with these price feeds');
    console.log('   2. Implement backend cron job for automatic price updates');
    console.log('   3. Test on-chain price submission with update fee\n');

  } catch (error: any) {
    console.error('\n❌ Error fetching price feeds:');
    console.error(error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testPythPriceFeeds().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});