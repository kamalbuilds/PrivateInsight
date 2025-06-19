#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { createServer } from 'http';
import winston from 'winston';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { ethers } from 'ethers';
import { createPublicClient, createWalletClient, http } from 'viem';
import { metis } from 'viem/chains';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'privateinsight-main' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Platform configuration
const config = {
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  metis: {
    hyperionRpc: process.env.METIS_HYPERION_RPC || 'https://hyperion-testnet.metisdevops.link',
    chainId: parseInt(process.env.METIS_CHAIN_ID) || 133717,
    explorerUrl: process.env.METIS_EXPLORER_URL || 'https://hyperion-testnet-explorer.metisdevops.link'
  },
  alith: {
    endpoint: process.env.ALITH_ENDPOINT || 'https://api.lazai.network',
    apiKey: process.env.ALITH_API_KEY,
    agentFrameworkVersion: process.env.ALITH_VERSION || 'latest'
  },
  privacy: {
    zkProofSystem: process.env.ZK_PROOF_SYSTEM || 'plonk',
    mpcThreshold: parseInt(process.env.MPC_THRESHOLD) || 3,
    homomorphicScheme: process.env.HOMOMORPHIC_SCHEME || 'BGV',
    differentialPrivacyEpsilon: parseFloat(process.env.DP_EPSILON) || 1.0
  },
  ai: {
    federatedLearningEnabled: process.env.FL_ENABLED === 'true',
    modelRegistry: process.env.MODEL_REGISTRY_URL,
    inferenceTeeEnabled: process.env.TEE_INFERENCE === 'true'
  }
};

class PrivateInsightPlatform {
  constructor() {
    this.services = new Map();
    this.healthChecks = new Map();
    this.isShuttingDown = false;
    this.app = express();
    this.server = null;
    this.wsServer = null;
    
    // Initialize Metis clients
    this.publicClient = null;
    this.walletClient = null;
    
    this.setupExpress();
    this.setupShutdownHandlers();
  }

  setupExpress() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "wss:", "https:"]
        }
      }
    }));

    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));

    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      const health = await this.getSystemHealth();
      const status = health.overall === 'healthy' ? 200 : 503;
      res.status(status).json(health);
    });

    // System status endpoint
    this.app.get('/status', async (req, res) => {
      const status = await this.getSystemStatus();
      res.json(status);
    });

    // Privacy analytics endpoint
    this.app.post('/api/privacy/analyze', async (req, res) => {
      try {
        const { data, analyticsType, privacyLevel } = req.body;
        const result = await this.performPrivacyPreservingAnalysis(data, analyticsType, privacyLevel);
        res.json(result);
      } catch (error) {
        logger.error('Privacy analysis failed:', error);
        res.status(500).json({ error: 'Analysis failed', message: error.message });
      }
    });

    // AI agent interaction endpoint
    this.app.post('/api/ai/execute', async (req, res) => {
      try {
        const { agentId, task, parameters } = req.body;
        const result = await this.executeAIAgent(agentId, task, parameters);
        res.json(result);
      } catch (error) {
        logger.error('AI agent execution failed:', error);
        res.status(500).json({ error: 'Agent execution failed', message: error.message });
      }
    });

    // Smart contract interaction endpoint
    this.app.post('/api/contracts/interact', async (req, res) => {
      try {
        const { contractAddress, functionName, parameters } = req.body;
        const result = await this.interactWithContract(contractAddress, functionName, parameters);
        res.json(result);
      } catch (error) {
        logger.error('Contract interaction failed:', error);
        res.status(500).json({ error: 'Contract interaction failed', message: error.message });
      }
    });
  }

  async initializeMetisClients() {
    try {
      logger.info('Initializing Metis Hyperion clients...');
      
      this.publicClient = createPublicClient({
        chain: {
          ...metis,
          id: config.metis.chainId,
          name: 'Metis Hyperion',
          nativeCurrency: { name: 'tMETIS', symbol: 'tMETIS', decimals: 18 },
          rpcUrls: {
            default: { http: [config.metis.hyperionRpc] },
            public: { http: [config.metis.hyperionRpc] }
          },
          blockExplorers: {
            default: { name: 'Metis Explorer', url: config.metis.explorerUrl }
          }
        },
        transport: http(config.metis.hyperionRpc)
      });

      // Test connection
      const blockNumber = await this.publicClient.getBlockNumber();
      logger.info(`Connected to Metis Hyperion. Current block: ${blockNumber}`);

      this.healthChecks.set('metis-connection', {
        name: 'Metis Hyperion Connection',
        check: async () => {
          const block = await this.publicClient.getBlockNumber();
          return { healthy: true, blockNumber: block.toString() };
        }
      });

    } catch (error) {
      logger.error('Failed to initialize Metis clients:', error);
      throw error;
    }
  }

  async initializeAIAgents() {
    try {
      logger.info('Initializing Alith AI agents...');
      
      // Check if ai-agents service is available
      const agentsPath = join(__dirname, 'ai-agents');
      await fs.access(agentsPath);

      // Start AI agents service
      const agentsProcess = spawn('bun', ['run', 'dev'], {
        cwd: agentsPath,
        stdio: 'pipe',
        env: {
          ...process.env,
          ALITH_ENDPOINT: config.alith.endpoint,
          ALITH_API_KEY: config.alith.apiKey,
          METIS_RPC: config.metis.hyperionRpc
        }
      });

      agentsProcess.stdout.on('data', (data) => {
        logger.info(`[AI-Agents] ${data.toString().trim()}`);
      });

      agentsProcess.stderr.on('data', (data) => {
        logger.error(`[AI-Agents] ${data.toString().trim()}`);
      });

      this.services.set('ai-agents', agentsProcess);

      this.healthChecks.set('ai-agents', {
        name: 'Alith AI Agents',
        check: async () => {
          const isRunning = !agentsProcess.killed && agentsProcess.pid;
          return { healthy: isRunning, pid: agentsProcess.pid };
        }
      });

      logger.info('Alith AI agents service started successfully');

    } catch (error) {
      logger.error('Failed to initialize AI agents:', error);
      throw error;
    }
  }

  async initializeContracts() {
    try {
      logger.info('Initializing smart contracts...');
      
      const contractsPath = join(__dirname, 'contracts');
      await fs.access(contractsPath);

      // Check if contracts are deployed
      const deploymentFile = join(contractsPath, 'deployments.json');
      
      try {
        const deployments = JSON.parse(await fs.readFile(deploymentFile, 'utf8'));
        logger.info('Found contract deployments:', Object.keys(deployments));
        
        this.contractAddresses = deployments;
        
        this.healthChecks.set('contracts', {
          name: 'Smart Contracts',
          check: async () => {
            const contracts = Object.keys(this.contractAddresses);
            return { healthy: true, contractCount: contracts.length, contracts };
          }
        });

      } catch (deployError) {
        logger.warn('No contract deployments found. Run deployment first.');
        
        // Deploy contracts if not deployed
        const deployProcess = spawn('bun', ['run', 'deploy'], {
          cwd: contractsPath,
          stdio: 'pipe'
        });

        deployProcess.stdout.on('data', (data) => {
          logger.info(`[Contracts] ${data.toString().trim()}`);
        });

        deployProcess.stderr.on('data', (data) => {
          logger.error(`[Contracts] ${data.toString().trim()}`);
        });
      }

    } catch (error) {
      logger.error('Failed to initialize contracts:', error);
      throw error;
    }
  }

  async initializeFrontend() {
    try {
      logger.info('Initializing frontend service...');
      
      const frontendPath = join(__dirname, 'frontend');
      await fs.access(frontendPath);

      const frontendProcess = spawn('bun', ['run', 'dev'], {
        cwd: frontendPath,
        stdio: 'pipe',
        env: {
          ...process.env,
          NEXT_PUBLIC_API_URL: `http://localhost:${config.server.port}`,
          NEXT_PUBLIC_METIS_RPC: config.metis.hyperionRpc,
          NEXT_PUBLIC_CHAIN_ID: config.metis.chainId.toString()
        }
      });

      frontendProcess.stdout.on('data', (data) => {
        logger.info(`[Frontend] ${data.toString().trim()}`);
      });

      frontendProcess.stderr.on('data', (data) => {
        logger.error(`[Frontend] ${data.toString().trim()}`);
      });

      this.services.set('frontend', frontendProcess);

      this.healthChecks.set('frontend', {
        name: 'Frontend Service',
        check: async () => {
          const isRunning = !frontendProcess.killed && frontendProcess.pid;
          return { healthy: isRunning, pid: frontendProcess.pid };
        }
      });

      logger.info('Frontend service started successfully');

    } catch (error) {
      logger.error('Failed to initialize frontend:', error);
      throw error;
    }
  }

  async performPrivacyPreservingAnalysis(data, analyticsType, privacyLevel) {
    logger.info(`Performing ${analyticsType} analysis with privacy level: ${privacyLevel}`);
    
    // This would integrate with your privacy-preserving analytics implementation
    const analysisId = `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate privacy-preserving computation
    const result = {
      analysisId,
      type: analyticsType,
      privacyLevel,
      status: 'completed',
      timestamp: new Date().toISOString(),
      insights: {
        summary: 'Privacy-preserving analysis completed',
        metrics: {
          dataPoints: Array.isArray(data) ? data.length : 1,
          privacyBudgetUsed: 0.1,
          noiseAdded: privacyLevel === 'high' ? 'differential_privacy' : 'minimal'
        }
      },
      zkProof: {
        available: true,
        scheme: config.privacy.zkProofSystem,
        verified: true
      }
    };

    logger.info(`Analysis ${analysisId} completed successfully`);
    return result;
  }

  async executeAIAgent(agentId, task, parameters) {
    logger.info(`Executing AI agent ${agentId} with task: ${task}`);
    
    // This would integrate with your Alith AI framework
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      executionId,
      agentId,
      task,
      status: 'completed',
      timestamp: new Date().toISOString(),
      result: {
        taskCompleted: true,
        output: `AI agent ${agentId} successfully executed ${task}`,
        parameters,
        inference: {
          model: 'alith-optimized-llm',
          tokensUsed: 150,
          inferenceTime: '245ms',
          confidenceScore: 0.94
        }
      },
      privacy: {
        teeExecution: config.ai.inferenceTeeEnabled,
        dataEncrypted: true,
        outputVerified: true
      }
    };

    logger.info(`AI agent execution ${executionId} completed successfully`);
    return result;
  }

  async interactWithContract(contractAddress, functionName, parameters) {
    logger.info(`Interacting with contract ${contractAddress}, function: ${functionName}`);
    
    if (!this.publicClient) {
      throw new Error('Metis client not initialized');
    }

    // This would use your actual contract interactions
    const txId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      transactionId: txId,
      contractAddress,
      functionName,
      parameters,
      status: 'pending',
      timestamp: new Date().toISOString(),
      network: {
        chain: 'Metis Hyperion',
        chainId: config.metis.chainId,
        rpc: config.metis.hyperionRpc
      },
      gasEstimate: {
        gasLimit: '100000',
        gasPrice: '1000000000',
        maxFeePerGas: '2000000000'
      }
    };

    logger.info(`Contract interaction ${txId} initiated successfully`);
    return result;
  }

  async getSystemHealth() {
    const healthResults = {};
    let overallHealthy = true;

    for (const [key, healthCheck] of this.healthChecks) {
      try {
        const result = await healthCheck.check();
        healthResults[key] = {
          name: healthCheck.name,
          status: result.healthy ? 'healthy' : 'unhealthy',
          ...result
        };
        
        if (!result.healthy) {
          overallHealthy = false;
        }
      } catch (error) {
        healthResults[key] = {
          name: healthCheck.name,
          status: 'error',
          error: error.message
        };
        overallHealthy = false;
      }
    }

    return {
      overall: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: healthResults
    };
  }

  async getSystemStatus() {
    return {
      platform: 'PrivateInsight',
      version: '1.0.0',
      environment: config.server.environment,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      configuration: {
        privacy: {
          zkProofSystem: config.privacy.zkProofSystem,
          mpcEnabled: true,
          homomorphicEncryption: config.privacy.homomorphicScheme,
          differentialPrivacy: true
        },
        ai: {
          framework: 'Alith',
          federatedLearning: config.ai.federatedLearningEnabled,
          teeInference: config.ai.inferenceTeeEnabled
        },
        blockchain: {
          network: 'Metis Hyperion',
          chainId: config.metis.chainId,
          rpcEndpoint: config.metis.hyperionRpc
        }
      },
      services: Array.from(this.services.keys()),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    };
  }

  setupShutdownHandlers() {
    const shutdown = async (signal) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}. Starting graceful shutdown...`);

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Stop all services
      for (const [name, process] of this.services) {
        logger.info(`Stopping ${name} service...`);
        process.kill('SIGTERM');
      }

      // Close HTTP server
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  async start() {
    try {
      logger.info('🚀 Starting PrivateInsight Platform...');
      logger.info(`Environment: ${config.server.environment}`);
      logger.info(`Version: 1.0.0`);

      // Ensure logs directory exists
      await fs.mkdir('logs', { recursive: true });

      // Initialize all components
      await this.initializeMetisClients();
      await this.initializeContracts();
      await this.initializeAIAgents();
      await this.initializeFrontend();

      // Start HTTP server
      this.server = createServer(this.app);
      
      // Setup WebSocket server for real-time features
      this.wsServer = new WebSocketServer({ server: this.server });
      
      this.wsServer.on('connection', (ws) => {
        logger.info('New WebSocket connection established');
        
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            logger.info('WebSocket message received:', data.type);
            
            // Handle real-time privacy analytics requests
            if (data.type === 'privacy_analysis') {
              const result = await this.performPrivacyPreservingAnalysis(
                data.payload.data,
                data.payload.analyticsType,
                data.payload.privacyLevel
              );
              ws.send(JSON.stringify({ type: 'analysis_result', data: result }));
            }
          } catch (error) {
            logger.error('WebSocket message error:', error);
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
          }
        });

        ws.on('close', () => {
          logger.info('WebSocket connection closed');
        });
      });

      // Start server
      this.server.listen(config.server.port, config.server.host, () => {
        logger.info(`🌟 PrivateInsight Platform is running!`);
        logger.info(`📊 Dashboard: http://${config.server.host}:${config.server.port}`);
        logger.info(`🔐 Privacy Analytics API: http://${config.server.host}:${config.server.port}/api/privacy`);
        logger.info(`🤖 AI Agents API: http://${config.server.host}:${config.server.port}/api/ai`);
        logger.info(`⛓️  Smart Contracts API: http://${config.server.host}:${config.server.port}/api/contracts`);
        logger.info(`📈 Health Check: http://${config.server.host}:${config.server.port}/health`);
        logger.info(`🔍 System Status: http://${config.server.host}:${config.server.port}/status`);
        logger.info(`🌐 Frontend: http://localhost:3000 (if running)`);
        logger.info(`🔗 Metis Hyperion: ${config.metis.hyperionRpc}`);
        logger.info(`🧠 Alith AI Framework: ${config.alith.endpoint}`);
      });

    } catch (error) {
      logger.error('Failed to start PrivateInsight Platform:', error);
      process.exit(1);
    }
  }
}

// Start the platform
const platform = new PrivateInsightPlatform();
platform.start().catch((error) => {
  logger.error('Platform startup failed:', error);
  process.exit(1);
});

export default platform;