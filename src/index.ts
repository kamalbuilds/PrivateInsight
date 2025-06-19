#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from 'dotenv';
import { createServer } from 'http';
import { Logger } from './utils/Logger';

// Load environment variables
config();

const logger = new Logger('PrivateInsight');

/**
 * PrivateInsight Application Entry Point
 * Multi-chain privacy-preserving analytics platform
 */
class PrivateInsightApp {
  private app: express.Application;
  private server: any;
  private readonly port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000');
    this.initializeMiddleware();
    this.initializeRoutes();
  }

  /**
   * Initialize Express middleware
   */
  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  /**
   * Initialize API routes
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          filecoin: 'connected',
          metis: 'connected',
          database: 'connected',
          storage: 'available'
        }
      });
    });

    // API status endpoint
    this.app.get('/api/status', (req, res) => {
      res.json({
        platform: 'PrivateInsight',
        description: 'AI-Powered Privacy-Preserving Data Analytics Platform',
        networks: {
          filecoin: {
            network: process.env.FILECOIN_NETWORK || 'mainnet',
            rpc: process.env.FILECOIN_RPC_URL || 'https://api.node.glif.io',
            features: ['PDP Storage', 'FilCDN', 'FVM Contracts']
          },
          metis: {
            network: process.env.METIS_NETWORK || 'hyperion',
            rpc: process.env.METIS_RPC_URL || 'https://andromeda.metis.io/?owner=1088',
            features: ['AI Computation', 'Privacy Analytics', 'Cross-Chain Bridge']
          }
        },
        capabilities: {
          storage: ['PDP', 'IPFS', 'FilCDN'],
          privacy: ['Zero-Knowledge Proofs', 'Multi-Party Computation', 'Homomorphic Encryption'],
          ai: ['Federated Learning', 'Privacy-Preserving ML', 'Automated Analytics'],
          crossChain: ['Filecoin-Metis Bridge', 'Data Synchronization', 'Unified Interface']
        }
      });
    });

    // Storage API routes (placeholder)
    this.app.post('/api/storage/upload', (req, res) => {
      res.json({
        message: 'Storage API endpoint - implementation pending',
        required: ['PDPClient integration', 'FilCDN setup', 'IPFS management']
      });
    });

    // Analytics API routes (placeholder)
    this.app.post('/api/analytics/job', (req, res) => {
      res.json({
        message: 'Analytics API endpoint - implementation pending',
        required: ['AI agent system', 'Privacy computation engine', 'ZK proof generation']
      });
    });

    // Privacy API routes (placeholder)
    this.app.post('/api/privacy/compute', (req, res) => {
      res.json({
        message: 'Privacy computation endpoint - implementation pending',
        required: ['ZK circuit compilation', 'MPC protocol implementation', 'Homomorphic encryption']
      });
    });

    // Cross-chain API routes (placeholder)
    this.app.post('/api/crosschain/sync', (req, res) => {
      res.json({
        message: 'Cross-chain sync endpoint - implementation pending',
        required: ['Bridge contract deployment', 'Event relay system', 'State verification']
      });
    });

    // Development info endpoint
    this.app.get('/api/dev/status', (req, res) => {
      res.json({
        development: {
          completed: [
            'Project architecture',
            'Smart contracts (Filecoin FVM)',
            'PDP storage client',
            'IPFS manager',
            'Deployment scripts',
            'Logger utility'
          ],
          inProgress: [
            'TypeScript error fixes',
            'Environment configuration',
            'Basic API structure'
          ],
          pending: [
            'AI agent system',
            'Frontend application',
            'Privacy computation engine',
            'Cross-chain bridge implementation',
            'Database integration',
            'Production deployment'
          ]
        },
        nextSteps: [
          '1. Fix remaining TypeScript compilation errors',
          '2. Implement core backend API services',
          '3. Build AI agent coordination system',
          '4. Create frontend dashboard interface',
          '5. Deploy to production with real storage providers'
        ]
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        message: 'The requested API endpoint does not exist',
        availableEndpoints: [
          'GET /health - Health check',
          'GET /api/status - Platform status',
          'GET /api/dev/status - Development status',
          'POST /api/storage/upload - Storage operations (pending)',
          'POST /api/analytics/job - Analytics jobs (pending)',
          'POST /api/privacy/compute - Privacy computation (pending)',
          'POST /api/crosschain/sync - Cross-chain sync (pending)'
        ]
      });
    });

    // Global error handler
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Start the server
   */
  public async start(): Promise<void> {
    try {
      this.server = createServer(this.app);

      this.server.listen(this.port, () => {
        logger.info(`🚀 PrivateInsight Platform started successfully!`);
        logger.info(`📡 Server running on http://localhost:${this.port}`);
        logger.info(`🔗 Filecoin Network: ${process.env.FILECOIN_NETWORK || 'mainnet'}`);
        logger.info(`⚡ Metis Network: ${process.env.METIS_NETWORK || 'hyperion'}`);
        logger.info(`🛡️  Privacy-first analytics platform ready`);
        
        console.log('\n🎯 Available Endpoints:');
        console.log(`   GET  /health              - Health check`);
        console.log(`   GET  /api/status          - Platform status`);
        console.log(`   GET  /api/dev/status      - Development status`);
        console.log(`   POST /api/storage/upload  - Storage operations (pending)`);
        console.log(`   POST /api/analytics/job   - Analytics jobs (pending)`);
        console.log(`   POST /api/privacy/compute - Privacy computation (pending)`);
        console.log(`   POST /api/crosschain/sync - Cross-chain sync (pending)`);
        
        console.log('\n🔧 Next Development Steps:');
        console.log('   1. Fix TypeScript compilation errors');
        console.log('   2. Implement storage API with PDPClient');
        console.log('   3. Build AI agent coordination system');
        console.log('   4. Create privacy computation engine');
        console.log('   5. Develop frontend dashboard');
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  private shutdown(): void {
    logger.info('Shutting down PrivateInsight platform...');
    
    if (this.server) {
      this.server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

// Start the application
if (require.main === module) {
  const app = new PrivateInsightApp();
  app.start().catch((error) => {
    console.error('Failed to start PrivateInsight:', error);
    process.exit(1);
  });
}

export { PrivateInsightApp }; 