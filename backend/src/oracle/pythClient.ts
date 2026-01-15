import { HermesClient } from '@pythnetwork/hermes-client';
import { ethers } from 'ethers';
import { config } from '../utils/config';
import { contractService } from '../utils/contractInteraction';
import { PriceData, OraclePriceResponse, OracleUpdateResponse, APIError } from '../types';
import Logger from '../utils/logger';

const logger = new Logger('PythClient');

// Pyth Contract ABI for direct calls
const PYTH_ABI = [
  'function getUpdateFee(bytes[] calldata updateData) external view returns (uint feeAmount)',
  'function updatePriceFeeds(bytes[] calldata updateData) external payable',
];

/**
 * Pyth Oracle Integration Service
 * Fetches prices from Pyth Price Service API and submits to PythOracleReader contract
 */
export class PythClient {
  private connection: HermesClient;
  private updateIntervalId?: NodeJS.Timeout;
  private pythContract: ethers.Contract;

  constructor() {
    this.connection = new HermesClient(config.pyth.apiUrl, {
      timeout: 10000,
    });

    // Initialize direct connection to Pyth contract for fee queries
    // Mantle Testnet Pyth Contract Address
    const MANTLE_TESTNET_PYTH = '0x98046Bd286715D3B0BC227Dd7a956b83D8978603';
    
    this.pythContract = new ethers.Contract(
      MANTLE_TESTNET_PYTH,
      PYTH_ABI,
      contractService.getProvider()
    );
  }

  /**
   * Fetch latest prices from Pyth API
   */
  async fetchLatestPrices(priceIds: string[]): Promise<OraclePriceResponse> {
    try {
      logger.info(`Fetching prices for ${priceIds.length} feeds`);

      // HermesClient uses getLatestPriceUpdates to get actual price data
      const priceUpdate = await this.connection.getLatestPriceUpdates(priceIds, {
        parsed: true,
      });

      if (!priceUpdate || !priceUpdate.parsed || priceUpdate.parsed.length === 0) {
        throw new APIError(404, 'No price feeds found');
      }

      const prices: PriceData[] = priceUpdate.parsed.map((feed: any) => {
        const price = feed.price;
        
        return {
          feedId: feed.id,
          price: parseFloat(price.price) * Math.pow(10, price.expo),
          timestamp: price.publish_time,
          confidence: parseFloat(price.conf) * Math.pow(10, price.expo),
          expo: price.expo,
        };
      });

      return {
        success: true,
        prices,
      };
    } catch (error: any) {
      logger.error('Failed to fetch prices from Pyth', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch prices',
      };
    }
  }

  /**
   * Get price update data for on-chain submission
   * Gets binary VAA data in hex format for ethers.js
   */
  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    try {
      // Request hex encoding directly from Hermes
      const priceUpdate = await this.connection.getLatestPriceUpdates(priceIds, {
        encoding: 'hex',
      });
      
      // binary.data contains hex strings without 0x prefix - need to add it for ethers.js
      if (!priceUpdate.binary || !priceUpdate.binary.data) {
        throw new APIError(500, 'No price update data received');
      }
      
      // Add 0x prefix if not already present
      return priceUpdate.binary.data.map((hexString: string) => 
        hexString.startsWith('0x') ? hexString : `0x${hexString}`
      );
    } catch (error: any) {
      logger.error('Failed to get price update data', error);
      throw new APIError(500, 'Failed to get price update data');
    }
  }

  /**
   * Submit price updates to PythOracleReader contract
   * Updates each price feed individually to avoid batching issues
   */
  async updatePricesOnChain(priceIds: string[]): Promise<OracleUpdateResponse> {
    try {
      logger.info(`Updating ${priceIds.length} price feeds on-chain`);

      const updatedFeeds: string[] = [];
      const txHashes: string[] = [];

      // Update each price feed individually
      for (const priceId of priceIds) {
        try {
          logger.info(`Updating price feed: ${priceId}`);

          // Convert priceId to bytes32 format first
          const priceIdBytes32 = priceId.startsWith('0x') ? priceId : `0x${priceId}`;

          // Check if feed is supported before trying to update
          const isSupported = await contractService.contracts.pythOracleReader.isSupportedFeed(priceIdBytes32);
          if (!isSupported) {
            logger.error(`Price feed ${priceId} is not supported in the contract`);
            continue;
          }
          logger.info(`Price feed ${priceId} is supported`);

          // Get price update data for this specific feed
          const updateData = await this.getPriceUpdateData([priceId]);

          logger.info(`Received ${updateData.length} VAA updates for ${priceId}`);

          // Get update fee from Pyth contract directly
          const updateFee = await this.pythContract.getUpdateFee(updateData);

          logger.info(`Update fee for ${priceId}: ${updateFee.toString()} wei (${ethers.formatEther(updateFee)} MNT)`);

          // Try to estimate gas first to catch errors early
          try {
            const gasEstimate = await contractService.contracts.pythOracleReader.updatePrice.estimateGas(
              priceIdBytes32,
              updateData,
              { value: updateFee }
            );
            logger.info(`Estimated gas for ${priceId}: ${gasEstimate.toString()}`);
          } catch (estimateError: any) {
            logger.error(`Gas estimation failed for ${priceId}:`, estimateError.message);
            throw estimateError;
          }

          // Submit update to PythOracleReader contract
          const tx = await contractService.contracts.pythOracleReader.updatePrice(
            priceIdBytes32,
            updateData,
            { 
              value: updateFee
            }
          );

          logger.info(`Price update transaction sent for ${priceId}: ${tx.hash}`);

          const receipt = await tx.wait();

          logger.info(`Price update confirmed for ${priceId} in block ${receipt.blockNumber}`);

          updatedFeeds.push(priceId);
          txHashes.push(receipt.hash);

        } catch (error: any) {
          logger.error(`Failed to update price feed ${priceId}:`, error.message);
          // Continue with other feeds even if one fails
        }
      }

      if (updatedFeeds.length === 0) {
        throw new Error('All price updates failed');
      }

      logger.info(`Successfully updated ${updatedFeeds.length}/${priceIds.length} price feeds`);

      return {
        success: true,
        txHash: txHashes[0], // Return first tx hash for backwards compatibility
        txHashes, // Return all tx hashes
        updatedFeeds,
      };
    } catch (error: any) {
      logger.error('Failed to update prices on-chain', error);
      
      // More detailed error logging
      if (error.data) {
        logger.error('Error data:', error.data);
      }
      if (error.transaction) {
        logger.error('Failed transaction:', error.transaction);
      }
      
      return {
        success: false,
        error: error.message || 'Failed to update prices on-chain',
      };
    }
  }

  /**
   * Start automatic price update cron job
   */
  startPriceUpdateCron(): void {
    const intervalMs = config.oracle.updateIntervalMs;
    logger.info(`Starting price update cron job (interval: ${intervalMs}ms)`);

    const allPriceFeeds = [
      config.pyth.priceFeeds.ethUsd,
      config.pyth.priceFeeds.btcUsd,
      config.pyth.priceFeeds.usdcUsd,
    ];

    this.updateIntervalId = setInterval(async () => {
      try {
        logger.info('Running scheduled price update');
        await this.updatePricesOnChain(allPriceFeeds);
      } catch (error) {
        logger.error('Scheduled price update failed', error);
      }
    }, intervalMs);

    // Run initial update after 5 seconds to allow provider initialization
    setTimeout(() => {
      this.updatePricesOnChain(allPriceFeeds).catch((error) => {
        logger.error('Initial price update failed', error);
      });
    }, 5000);
  }

  /**
   * Stop the price update cron job
   */
  stopPriceUpdateCron(): void {
    if (this.updateIntervalId) {
      clearInterval(this.updateIntervalId);
      logger.info('Price update cron job stopped');
    }
  }
}

export const pythClient = new PythClient();