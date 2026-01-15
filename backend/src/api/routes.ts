import { Router, Request, Response } from 'express';
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

const router = Router();
const logger = new Logger('Routes');

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
 */
router.post('/api/rwa/create', async (req: Request, res: Response) => {
  try {
    const request: RWACreateRequest = req.body;
    logger.info(`Received RWA creation request from ${request.issuerAddress}`);

    const result = await rwaService.createRWAToken(request);

    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error: any) {
    logger.error('RWA creation failed', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * POST /api/rwa/purchase
 * Purchase fractions of an RWA token
 */
router.post('/api/rwa/purchase', async (req: Request, res: Response) => {
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
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// ============ ZK Proof Endpoints ============

/**
 * POST /api/zk/generate-proof
 * Generate a ZK proof (eligibility or range)
 */
router.post('/api/zk/generate-proof', async (req: Request, res: Response) => {
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
 */
router.post('/api/oracle/update-prices', async (req: Request, res: Response) => {
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
