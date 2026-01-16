import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './utils/config';
import routes from './api/routes';
import { pythClient } from './oracle/pythClient';
import Logger from './utils/logger';

const logger = new Logger('Server');

/**
 * Sherlock Backend API Server
 * Express.js server for RWA tokenization with ZK proofs and Pyth oracles
 */
class Server {
  private app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = config.port;
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req, _res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });
  }

  /**
   * Configure API routes
   */
  private setupRoutes(): void {
    this.app.use('/', routes);

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({
        success: false,
        error: 'Route not found',
      });
    });
  }

  /**
   * Start the server and initialize services
   */
  public async start(): Promise<void> {
    try {
      // Start Express server
      this.app.listen(this.port, () => {
        logger.info(`Server running on port ${this.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info(`Network: Mantle Testnet (Chain ID: ${config.chainId})`);
        logger.info(`RPC URL: ${config.rpcUrl}`);
      });

      // Start Pyth price update cron job if enabled
      if (config.oracle.autoUpdateEnabled) {
        logger.info('Starting Pyth oracle price update service');
        pythClient.startPriceUpdateCron();
      } else {
        logger.info('Oracle auto-updates disabled (set ORACLE_AUTO_UPDATE_ENABLED=true to enable)');
      }

      logger.info('Sherlock Backend API started successfully');
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down server gracefully...');
    
    // Stop price update cron
    pythClient.stopPriceUpdateCron();
    
    logger.info('Server shut down complete');
    process.exit(0);
  }
}

// Initialize and start server
const server = new Server();
server.start();

// Handle shutdown signals
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

export default server;
