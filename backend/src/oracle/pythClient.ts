import { PriceServiceConnection } from '@pythnetwork/price-service-client';
import { config } from '../utils/config';
import { contractService } from '../utils/contractInteraction';
import { PriceData, OraclePriceResponse, OracleUpdateResponse, APIError } from '../types';
import Logger from '../utils/logger';

const logger = new Logger('PythClient');

/**
 * Pyth Oracle Integration Service
 * Fetches prices from Pyth Price Service API and submits to PythOracleReader contract
 */
export class PythClient {
  private connection: PriceServiceConnection;
  private updateIntervalId?: NodeJS.Timeout;

  constructor() {
    this.connection = new PriceServiceConnection(config.pyth.apiUrl, {
      logger: {
        trace: (msg: string) => logger.debug(msg),
        debug: (msg: string) => logger.debug(msg),
        info: (msg: string) => logger.info(msg),
        warn: (msg: string) => logger.warn(msg),
        error: (msg: string) => logger.error(msg),
      },
    });
  }

  /**
   * Fetch latest prices from Pyth API
   */
  async fetchLatestPrices(priceIds: string[]): Promise<OraclePriceResponse> {
    try {
      logger.info(`Fetching prices for ${priceIds.length} feeds`);

      const priceFeeds = await this.connection.getLatestPriceFeeds(priceIds);

      if (!priceFeeds || priceFeeds.length === 0) {
        throw new APIError(404, 'No price feeds found');
      }

      const prices: PriceData[] = priceFeeds.map((feed: any) => {
        const price = feed.getPriceNoOlderThan(60); // 60 seconds staleness tolerance
        if (!price) {
          throw new APIError(500, `Price data too old for feed ${feed.id}`);
        }

        return {
          feedId: feed.id,
          price: parseFloat(price.price) * Math.pow(10, price.expo),
          timestamp: price.publishTime,
          confidence: parseFloat(price.conf),
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
   * Converts base64 VAA data to hex format for ethers.js
   */
  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    try {
      const priceUpdateData = await this.connection.getLatestVaas(priceIds);
      
      // Convert base64 to hex (0x-prefixed) for ethers.js
      const hexUpdateData = priceUpdateData.map((base64Data) => {
        const buffer = Buffer.from(base64Data, 'base64');
        return '0x' + buffer.toString('hex');
      });
      
      return hexUpdateData;
    } catch (error: any) {
      logger.error('Failed to get price update data', error);
      throw new APIError(500, 'Failed to get price update data');
    }
  }

  /**
   * Submit price updates to PythOracleReader contract
   */
  async updatePricesOnChain(priceIds: string[]): Promise<OracleUpdateResponse> {
    try {
      logger.info(`Updating ${priceIds.length} price feeds on-chain`);

      // Get price update data from Pyth API
      const updateData = await this.getPriceUpdateData(priceIds);

      // Get update fee from contract
      const updateFee = await contractService.contracts.pythOracleReader.getUpdateFee(updateData);

      logger.info(`Update fee: ${updateFee.toString()} wei`);

      // Submit update to PythOracleReader contract
      // Note: PythOracleReader will forward the call to the Pyth contract
      const tx = await contractService.contracts.pythOracleReader.updatePrice(
        priceIds[0], // Primary price feed
        updateData,
        { value: updateFee }
      );

      logger.info(`Price update transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      logger.info(`Price update confirmed in block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: receipt.hash,
        updatedFeeds: priceIds,
      };
    } catch (error: any) {
      logger.error('Failed to update prices on-chain', error);
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
