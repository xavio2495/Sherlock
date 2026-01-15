import { ethers } from 'ethers';
import { RWACreateRequest, RWACreateResponse, PurchaseRequest, PurchaseResponse, APIError } from '../types';
import { contractService } from '../utils/contractInteraction';
import { pythClient } from '../oracle/pythClient';
import { zkProver } from '../zk/prover';
import { config } from '../utils/config';
import Logger from '../utils/logger';

const logger = new Logger('RWAService');

/**
 * RWA Service - Business logic for RWA token creation and management
 */
export class RWAService {
  
  /**
   * Create a new RWA token
   * 1. Generate ZK proof for issuer eligibility
   * 2. Fetch current oracle price
   * 3. Call RWATokenFactory.mintRWAToken()
   */
  async createRWAToken(request: RWACreateRequest): Promise<RWACreateResponse> {
    try {
      logger.info(`Creating RWA token for issuer ${request.issuerAddress}`);

      // Validate input
      this.validateCreateRequest(request);

      // Step 1: Generate ZK proof for issuer eligibility
      const zkProofResult = await zkProver.generateProof({
        proofType: 'eligibility',
        userAddress: request.issuerAddress,
        inputs: {
          commitment: request.zkProofInput.commitment,
          secret: request.zkProofInput.secret,
          nullifier: request.zkProofInput.nullifier,
        },
      });

      if (!zkProofResult.success || !zkProofResult.proof) {
        throw new APIError(400, 'ZK proof generation failed', zkProofResult.error);
      }

      // Step 2: Get price update data from Pyth
      const priceId = config.pyth.priceFeeds.ethUsd; // Default to ETH/USD
      const priceUpdateData = await pythClient.getPriceUpdateData([priceId]);

      // Step 3: Get update fee
      const updateFee = await contractService.contracts.pythOracleReader.getUpdateFee(priceUpdateData);

      logger.info(`Minting RWA token with update fee: ${updateFee.toString()}`);

      // Step 4: Call mintRWAToken on RWATokenFactory
      const tx = await contractService.contracts.rwaFactory.mintRWAToken(
        request.documentHash,
        request.totalValue,
        request.fractionCount,
        request.minFractionSize,
        priceId,
        priceUpdateData,
        request.lockupPeriod,
        { value: updateFee }
      );

      logger.info(`RWA token mint transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      // Parse tokenId from events
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = contractService.contracts.rwaFactory.interface.parseLog(log);
          return parsed?.name === 'AssetMinted';
        } catch {
          return false;
        }
      });

      let tokenId: number | undefined;
      if (event) {
        const parsed = contractService.contracts.rwaFactory.interface.parseLog(event);
        tokenId = Number(parsed?.args?.tokenId || 0);
      }

      // Fetch oracle price from contract
      let oraclePrice = 0;
      if (tokenId) {
        const priceData = await contractService.contracts.pythOracleReader.getPriceAtMint(tokenId);
        oraclePrice = Number(priceData) / 1e8; // Convert from 8 decimals
      }

      logger.info(`RWA token created successfully: tokenId=${tokenId}`);

      return {
        success: true,
        tokenId,
        txHash: receipt.hash,
        oraclePrice,
        zkProof: zkProofResult.proof,
      };
    } catch (error: any) {
      logger.error('Failed to create RWA token', error);
      return {
        success: false,
        error: error.message || 'Failed to create RWA token',
      };
    }
  }

  /**
   * Purchase fractions of an RWA token
   * 1. Validate tokenId exists
   * 2. Generate buyer ZK eligibility proof
   * 3. Calculate cost from oracle price
   * 4. Call RWATokenFactory.purchaseFraction with ETH payment
   */
  async purchaseFraction(request: PurchaseRequest): Promise<PurchaseResponse> {
    try {
      logger.info(`Processing purchase: tokenId=${request.tokenId}, amount=${request.amount}, buyer=${request.buyerAddress}`);

      // Step 1: Validate tokenId exists and get metadata
      let metadata;
      try {
        metadata = await contractService.contracts.rwaFactory.getAssetMetadata(request.tokenId);
        if (!metadata || metadata.issuer === ethers.ZeroAddress) {
          throw new APIError(404, `Token ID ${request.tokenId} does not exist`);
        }
      } catch (error: any) {
        if (error.code === 'CALL_EXCEPTION') {
          throw new APIError(404, `Token ID ${request.tokenId} does not exist`);
        }
        throw error;
      }

      logger.info(`Asset found: issuer=${metadata.issuer}, totalValue=${metadata.totalValue}`);

      // Step 2: Generate ZK proof for buyer eligibility
      const zkProofResult = await zkProver.generateProof({
        proofType: 'eligibility',
        userAddress: request.buyerAddress,
        inputs: {
          commitment: request.zkProofInput.commitment,
          secret: request.zkProofInput.secret,
          nullifier: request.zkProofInput.nullifier,
        },
      });

      if (!zkProofResult.success || !zkProofResult.proof) {
        throw new APIError(400, 'Buyer ZK proof generation failed', zkProofResult.error);
      }

      logger.info(`Buyer ZK proof generated successfully`);

      // Step 3: Calculate cost using oracle price per fraction
      // Get current oracle price for the asset's price feed
      const priceId = config.pyth.priceFeeds.ethUsd; // Use same feed as minting
      let oraclePrice;
      try {
        const priceData = await contractService.contracts.pythOracleReader.getLatestPrice(priceId);
        oraclePrice = Number(priceData[0]) / 1e8; // Pyth returns price with 8 decimals
        logger.info(`Oracle price: ${oraclePrice}`);
      } catch (error: any) {
        logger.warn('Failed to fetch oracle price, using metadata fallback:', error.message);
        oraclePrice = Number(metadata.totalValue) / Number(metadata.fractionCount);
      }

      // Calculate cost based on fraction amount and oracle price
      const pricePerFraction = Number(metadata.totalValue) / Number(metadata.fractionCount);
      const totalCost = pricePerFraction * request.amount;

      logger.info(`Purchase cost: ${totalCost} (${pricePerFraction} per fraction, ${request.amount} fractions)`);

      // Step 4: Call purchaseFraction on RWATokenFactory with ETH payment
      const secretBytes32 = ethers.encodeBytes32String(request.zkProofInput.secret);
      const nullifierBytes32 = ethers.encodeBytes32String(request.zkProofInput.nullifier);

      // Convert totalCost to wei (assuming totalCost is in USD cents, convert to ETH)
      // For testnet, use small amount for testing
      const costInWei = ethers.parseEther((totalCost / 100000).toFixed(6)); // Divide by 100000 for testnet

      const tx = await contractService.contracts.rwaFactory.purchaseFraction(
        request.tokenId,
        request.amount,
        secretBytes32,
        nullifierBytes32,
        { value: costInWei }
      );

      logger.info(`Purchase transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      logger.info(`Purchase confirmed in block ${receipt.blockNumber}`);

      return {
        success: true,
        txHash: receipt.hash,
        totalCost,
        currentPrice: pricePerFraction,
      };
    } catch (error: any) {
      logger.error('Failed to purchase fraction', error);
      
      // Enhanced error handling
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        throw new APIError(400, 'Insufficient funds for purchase');
      }
      
      if (error.code === 'CALL_EXCEPTION') {
        // Parse revert reason from contract
        const reason = error.reason || error.message;
        if (reason.includes('InsufficientFractionsAvailable')) {
          throw new APIError(400, 'Insufficient fractions available for purchase');
        }
        if (reason.includes('InvalidProof')) {
          throw new APIError(400, 'Invalid ZK proof');
        }
        if (reason.includes('PaymentMismatch')) {
          throw new APIError(400, 'Payment amount does not match required cost');
        }
        throw new APIError(400, `Transaction reverted: ${reason}`);
      }

      throw new APIError(500, error.message || 'Failed to purchase fraction');
    }
  }

  /**
   * Validate RWA creation request
   */
  private validateCreateRequest(request: RWACreateRequest): void {
    try {
      // Normalize to lowercase then validate and checksum
      // This accepts addresses regardless of their checksum format
      const normalized = request.issuerAddress.toLowerCase();
      ethers.getAddress(normalized);
    } catch (error: any) {
      logger.error(`Address validation failed for ${request.issuerAddress}:`, error.message);
      throw new APIError(400, `Invalid issuer address: ${error.message}`);
    }

    if (!request.documentHash || request.documentHash.length === 0) {
      throw new APIError(400, 'Document hash is required');
    }

    if (request.totalValue <= 0) {
      throw new APIError(400, 'Total value must be greater than 0');
    }

    if (request.fractionCount <= 0) {
      throw new APIError(400, 'Fraction count must be greater than 0');
    }

    if (request.minFractionSize <= 0) {
      throw new APIError(400, 'Min fraction size must be greater than 0');
    }
  }
}

export const rwaService = new RWAService();
