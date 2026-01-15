import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { rwaService } from '../services/rwaService';
import { zkProver } from '../zk/prover';
import { pythClient } from '../oracle/pythClient';
import {
  RWACreateRequest,
  ZKProofRequest,
  PurchaseRequest,
  OracleUpdateRequest,
  APIError,
} from '../types';
import Logger from '../utils/logger';
import { config } from '../utils/config';
import {
  validateRequest,
  rwaCreateSchema,
  zkProofSchema,
  purchaseSchema,
  oracleUpdateSchema,
} from './validation';

const router = Router();
const logger = new Logger('Routes');

// Rate limiting configuration
const createRWALimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    success: false,
    error: 'Too many RWA creation requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      success: false,
      error: 'Too many RWA creation requests from this IP. Please try again in 1 minute.',
    });
  },
});

const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============ Health Check ============

router.get('/health', (_req: Request, res: Response) => {
  const circuitsReady = zkProver.areCircuitsReady();
  const circuitStatus = zkProver.getCircuitStatus();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    network: 'Mantle Testnet',
    chainId: config.chainId,
    circuits: {
      ready: circuitsReady,
      status: circuitStatus,
    },
  });
});

// ============ RWA Endpoints ============

/**
 * POST /api/rwa/create
 * Create a new RWA token
 * 
 * Rate limited: 10 requests per minute per IP
 * Validation: Full joi schema validation
 * 
 * Flow:
 * 1. Validate request with joi schema
 * 2. Generate ZK eligibility proof for issuer
 * 3. Fetch current oracle price from Pyth (ETH/USD)
 * 4. Call RWATokenFactory.mintRWAToken with backend wallet as signer (gas sponsor)
 * 5. Wait for transaction confirmation
 * 6. Parse AssetMinted event from receipt
 * 7. Return success response with tokenId, txHash, oraclePrice, zkProof
 * 
 * Error handling:
 * - 400: Invalid request data (validation failure)
 * - 400: ZK proof generation failed
 * - 429: Rate limit exceeded
 * - 500: Contract revert, insufficient gas, or other blockchain errors
 */
router.post('/api/rwa/create', createRWALimiter, validateRequest(rwaCreateSchema), async (req: Request, res: Response) => {
  try {
    const request: RWACreateRequest = req.body;
    logger.info(`Received RWA creation request from ${request.issuerAddress}`);
    logger.info(`Asset type: ${request.assetType}, Total value: ${request.totalValue}, Fractions: ${request.fractionCount}`);

    // Call service to create RWA token
    const result = await rwaService.createRWAToken(request);

    if (result.success) {
      logger.info(`RWA token created successfully: tokenId=${result.tokenId}, txHash=${result.txHash}`);
      res.status(201).json(result);
    } else {
      logger.error(`RWA creation failed: ${result.error}`);
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('RWA creation failed with exception', error);
    
    // Enhanced error handling
    if (error instanceof APIError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        details: error.details,
      });
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      res.status(500).json({
        success: false,
        error: 'Insufficient funds for gas. Please ensure the backend wallet is funded.',
      });
    } else if (error.code === 'CALL_EXCEPTION') {
      res.status(500).json({
        success: false,
        error: 'Contract execution failed. The transaction may have been reverted.',
        details: error.reason || error.message,
      });
    } else if (error.code === 'NETWORK_ERROR') {
      res.status(500).json({
        success: false,
        error: 'Network error. Please check your connection and try again.',
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
});

/**
 * POST /api/rwa/purchase
 * Purchase fractions of an RWA token
 * 
 * Rate limited: 30 requests per minute per IP
 * Validation: Full joi schema validation
 */
router.post('/api/rwa/purchase', generalLimiter, validateRequest(purchaseSchema), async (req: Request, res: Response) => {
  try {
    const request: PurchaseRequest = req.body;
    logger.info(`Received purchase request: tokenId=${request.tokenId}, amount=${request.amount}`);

    const result = await rwaService.purchaseFraction(request);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('Purchase failed', error);
    
    if (error instanceof APIError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        details: error.details,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
});

/**
 * GET /api/rwa/:tokenId
 * Get asset metadata for a specific RWA token
 * 
 * Rate limited: 30 requests per minute per IP
 */
router.get('/api/rwa/:tokenId', generalLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const tokenId = parseInt(req.params.tokenId, 10);
    
    if (isNaN(tokenId) || tokenId < 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid token ID. Must be a non-negative integer.',
      });
      return;
    }

    logger.info(`Received request for token metadata: tokenId=${tokenId}`);

    const result = await rwaService.getAssetMetadata(tokenId);

    res.status(200).json(result);
  } catch (error: any) {
    logger.error(`Failed to fetch token metadata for tokenId=${req.params.tokenId}`, error);
    
    if (error instanceof APIError) {
      res.status(error.statusCode).json({
        success: false,
        error: error.message,
        details: error.details,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
      });
    }
  }
});

// ============ ZK Proof Endpoints ============

/**
 * POST /api/zk/generate-proof
 * Generate a ZK proof (eligibility or range)
 * 
 * Rate limited: 30 requests per minute per IP
 * Validation: Full joi schema validation
 */
router.post('/api/zk/generate-proof', generalLimiter, validateRequest(zkProofSchema), async (req: Request, res: Response) => {
  try {
    const request: ZKProofRequest = req.body;
    logger.info(`Received ZK proof generation request: type=${request.proofType}`);

    const result = await zkProver.generateProof(request);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('ZK proof generation failed', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ============ Oracle Endpoints ============

/**
 * GET /api/oracle/prices
 * Get latest prices from Pyth API
 */
router.get('/api/oracle/prices', async (_req: Request, res: Response) => {
  try {
    const priceIds = [
      config.pyth.priceFeeds.ethUsd,
      config.pyth.priceFeeds.btcUsd,
      config.pyth.priceFeeds.usdcUsd,
    ];

    logger.info('Fetching latest oracle prices');
    const result = await pythClient.fetchLatestPrices(priceIds);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('Failed to fetch oracle prices', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/oracle/update-prices
 * Submit price updates to PythOracleReader contract
 * 
 * Rate limited: 30 requests per minute per IP
 * Validation: Optional price IDs array
 */
router.post('/api/oracle/update-prices', generalLimiter, validateRequest(oracleUpdateSchema), async (req: Request, res: Response) => {
  try {
    const request: OracleUpdateRequest = req.body;
    const priceIds = request.priceIds || [
      config.pyth.priceFeeds.ethUsd,
      config.pyth.priceFeeds.btcUsd,
      config.pyth.priceFeeds.usdcUsd,
    ];

    logger.info(`Updating oracle prices for ${priceIds.length} feeds`);
    const result = await pythClient.updatePricesOnChain(priceIds);

    if (result.success) {
      res.status(200).json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('Failed to update oracle prices', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/oracle/metrics
 * Get oracle service metrics and statistics
 */
router.get('/api/oracle/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = pythClient.getMetrics();
    
    res.status(200).json({
      success: true,
      metrics: {
        ...metrics,
        lastUpdateDate: metrics.lastUpdateTimestamp > 0 
          ? new Date(metrics.lastUpdateTimestamp).toISOString() 
          : null,
        successRate: metrics.totalUpdates > 0
          ? ((metrics.successfulUpdates / metrics.totalUpdates) * 100).toFixed(2) + '%'
          : '0%',
        uptime: process.uptime(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to get oracle metrics', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ============ Error Handler ============

router.use((error: Error, _req: Request, res: Response, _next: any) => {
  if (error instanceof APIError) {
    res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details,
    });
  } else {
    logger.error('Unhandled error', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
