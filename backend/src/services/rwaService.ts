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
          secret: request.zkProofInput.nullifier, // Using nullifier as secret for MVP
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
   */
  async purchaseFraction(request: PurchaseRequest): Promise<PurchaseResponse> {
    try {
      logger.info(`Processing purchase: tokenId=${request.tokenId}, amount=${request.amount}, buyer=${request.buyerAddress}`);

      // Validate inputs
      if (!request.tokenId || request.amount <= 0) {
        throw new APIError(400, 'Invalid tokenId or amount');
      }

      // Get asset metadata to calculate cost
      const metadata = await contractService.contracts.rwaFactory.getAssetMetadata(request.tokenId);
      const pricePerFraction = Number(metadata.totalValue) / Number(metadata.fractionCount);
      const totalCost = pricePerFraction * request.amount;

      logger.info(`Purchase cost: ${totalCost} (${pricePerFraction} per fraction)`);

      // Call purchaseFraction on RWATokenFactory
      const secretBytes32 = ethers.encodeBytes32String(request.secret);
      const nullifierBytes32 = ethers.encodeBytes32String(request.nullifier);

      const tx = await contractService.contracts.rwaFactory.purchaseFraction(
        request.tokenId,
        request.amount,
        secretBytes32,
        nullifierBytes32,
        { value: ethers.parseEther('0.01') } // Mock payment value
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
      return {
        success: false,
        error: error.message || 'Failed to purchase fraction',
      };
    }
  }

  /**
   * Validate RWA creation request
   */
  private validateCreateRequest(request: RWACreateRequest): void {
    if (!ethers.isAddress(request.issuerAddress)) {
      throw new APIError(400, 'Invalid issuer address');
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
