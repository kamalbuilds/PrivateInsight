import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import PQueue from 'p-queue';
import {
  AIAgent,
  AgentConfig,
  AgentStatus,
  AnalyticsJob,
  AnalyticsResult,
  JobStatus,
  PrivacyLevel,
  ZKProof,
  Dataset,
  BlockchainService,
  AlithService,
  PrivacyEngine
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';
import { AlithService as AlithServiceImpl } from '../services/AlithService.js';
import { BlockchainService as BlockchainServiceImpl } from '../services/BlockchainService.js';
import { PrivacyEngine as PrivacyEngineImpl } from '../services/PrivacyEngine.js';

export class PrivateInsightAgent extends EventEmitter implements AIAgent {
  public readonly id: string;
  public readonly config: AgentConfig;
  
  private logger: Logger;
  private status: AgentStatus;
  private jobQueue: PQueue;
  private alithService: AlithService;
  private blockchainService: BlockchainService;
  private privacyEngine: PrivacyEngine;
  private isRunning: boolean = false;
  private startTime: number = 0;

  constructor(config: AgentConfig) {
    super();
    this.id = uuidv4();
    this.config = config;
    this.logger = new Logger(`PrivateInsightAgent-${this.config.name}`);
    
    this.status = {
      id: this.id,
      status: 'idle',
      currentJobs: [],
      totalProcessed: 0,
      errors: 0,
      uptime: 0,
      lastActivity: Date.now()
    };

    this.jobQueue = new PQueue({
      concurrency: config.maxConcurrentJobs,
      intervalCap: 5,
      interval: 1000
    });

    this.initializeServices();
    this.setupEventHandlers();
  }

  private initializeServices(): void {
    this.logger.info('Initializing AI agent services...');

    // Initialize Alith Service
    this.alithService = new AlithServiceImpl(this.config.alith);
    
    // Initialize Blockchain Service
    this.blockchainService = new BlockchainServiceImpl(this.config.blockchain);
    
    // Initialize Privacy Engine
    this.privacyEngine = new PrivacyEngineImpl({
      privacyLevel: this.config.privacyLevel,
      zkCircuits: {},
      differentialPrivacy: {
        enabled: true,
        defaultEpsilon: 1.0,
        mechanism: 'laplace'
      }
    });

    this.logger.info('Services initialized successfully');
  }

  private setupEventHandlers(): void {
    // Alith Service events
    this.alithService.on('authenticated', () => {
      this.logger.info('Alith service authenticated');
    });

    this.alithService.on('inferenceCompleted', (result) => {
      this.logger.info('Inference completed', { id: result.id, confidence: result.confidence });
      this.emit('inferenceCompleted', result);
    });

    this.alithService.on('inferenceError', (error) => {
      this.logger.error('Inference error', error);
      this.status.errors++;
    });

    // Blockchain Service events
    this.blockchainService.on('jobSubmitted', (jobId) => {
      this.logger.info('Job submitted to blockchain', { jobId });
    });

    this.blockchainService.on('proofSubmitted', (jobId, verified) => {
      this.logger.info('Proof submitted', { jobId, verified });
    });

    // Job Queue events
    this.jobQueue.on('active', () => {
      this.status.status = 'busy';
      this.status.lastActivity = Date.now();
    });

    this.jobQueue.on('idle', () => {
      this.status.status = 'idle';
      this.status.lastActivity = Date.now();
    });

    this.jobQueue.on('error', (error) => {
      this.logger.error('Job queue error:', error);
      this.status.errors++;
    });
  }

  async start(): Promise<void> {
    try {
      this.logger.info('Starting PrivateInsight AI Agent...');
      
      if (this.isRunning) {
        this.logger.warn('Agent is already running');
        return;
      }

      this.startTime = Date.now();
      this.isRunning = true;

      // Initialize connections
      await this.alithService.authenticate();
      await this.blockchainService.connect();

      // Start monitoring for new jobs
      this.startJobMonitoring();

      this.logger.info('PrivateInsight AI Agent started successfully');
      this.emit('started', { agentId: this.id, timestamp: this.startTime });

    } catch (error: any) {
      this.logger.error('Failed to start agent:', error);
      this.status.status = 'error';
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping PrivateInsight AI Agent...');
      
      if (!this.isRunning) {
        this.logger.warn('Agent is not running');
        return;
      }

      this.isRunning = false;

      // Wait for current jobs to complete
      await this.jobQueue.onEmpty();
      
      // Disconnect services
      await this.alithService.disconnect();
      await this.blockchainService.disconnect();

      this.status.status = 'stopped';
      this.logger.info('PrivateInsight AI Agent stopped successfully');
      this.emit('stopped', { agentId: this.id, timestamp: Date.now() });

    } catch (error: any) {
      this.logger.error('Error stopping agent:', error);
      throw error;
    }
  }

  async processJob(job: AnalyticsJob): Promise<AnalyticsResult> {
    const startTime = Date.now();
    this.logger.info(`Processing analytics job ${job.id}`, {
      datasetHash: job.datasetHash,
      circuitHash: job.circuitHash,
      privacyBudget: job.privacyBudget
    });

    try {
      // Add job to current jobs list
      this.status.currentJobs.push(job.id);

      // Step 1: Validate privacy budget
      await this.validatePrivacyBudget(job);

      // Step 2: Retrieve and validate dataset
      const dataset = await this.getDataset(job.datasetHash);
      
      // Step 3: Apply privacy-preserving transformations
      const processedData = await this.applyPrivacyPreservation(dataset, job.privacyBudget);

      // Step 4: Perform AI analysis using Alith
      const insights = await this.performAnalysis(processedData, job.circuitHash);

      // Step 5: Generate zero-knowledge proof
      const proof = await this.generateZKProof(job, insights);

      // Step 6: Create analytics result
      const result: AnalyticsResult = {
        insights: insights.result,
        metadata: {
          computationTime: Date.now() - startTime,
          privacySpent: job.privacyBudget,
          accuracy: insights.confidence,
          modelUsed: insights.metadata?.modelId || 'unknown'
        },
        visualizations: this.generateVisualizations(insights.result)
      };

      // Step 7: Submit proof to blockchain
      await this.blockchainService.submitProof(job.id, proof);

      // Update job status
      await this.blockchainService.updateJobStatus(job.id, JobStatus.COMPLETED);

      // Update agent statistics
      this.status.totalProcessed++;
      this.status.currentJobs = this.status.currentJobs.filter(id => id !== job.id);
      this.status.lastActivity = Date.now();

      this.logger.info(`Successfully processed job ${job.id}`, {
        processingTime: Date.now() - startTime,
        privacySpent: job.privacyBudget
      });

      this.emit('jobCompleted', { job, result, proof });
      return result;

    } catch (error: any) {
      this.logger.error(`Failed to process job ${job.id}:`, error);
      
      // Update job status to failed
      await this.blockchainService.updateJobStatus(job.id, JobStatus.FAILED);
      
      // Update agent statistics
      this.status.errors++;
      this.status.currentJobs = this.status.currentJobs.filter(id => id !== job.id);
      this.status.lastActivity = Date.now();

      this.emit('jobFailed', { job, error: error.message });
      throw error;
    }
  }

  private async validatePrivacyBudget(job: AnalyticsJob): Promise<void> {
    const availableBudget = await this.blockchainService.getPrivacyBudget(job.datasetHash);
    
    if (availableBudget < job.privacyBudget) {
      throw new Error(`Insufficient privacy budget. Available: ${availableBudget}, Required: ${job.privacyBudget}`);
    }
  }

  private async getDataset(datasetHash: string): Promise<Dataset> {
    // This would typically fetch from IPFS or other decentralized storage
    // For now, we'll create a mock dataset
    return {
      hash: datasetHash,
      owner: 'demo_owner',
      schema: {
        fields: [
          { name: 'id', type: 'STRING', nullable: false, sensitive: false },
          { name: 'value', type: 'NUMBER', nullable: false, sensitive: true },
          { name: 'category', type: 'STRING', nullable: true, sensitive: false }
        ]
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyHash: 'mock_key_hash'
      },
      privacyLevel: this.config.privacyLevel,
      metadata: {
        name: 'Demo Dataset',
        description: 'Sample dataset for privacy-preserving analytics',
        size: 1000,
        created: Date.now() - 86400000,
        updated: Date.now(),
        tags: ['finance', 'analytics'],
        source: 'demo'
      }
    };
  }

  private async applyPrivacyPreservation(dataset: Dataset, budget: number): Promise<any[]> {
    this.logger.info('Applying privacy preservation techniques');
    
    // Generate mock data for demonstration
    const mockData = Array.from({ length: 100 }, (_, i) => ({
      id: `record_${i}`,
      value: Math.random() * 1000,
      category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
    }));

    // Apply differential privacy noise
    const noisyData = await this.privacyEngine.addNoise(
      mockData,
      'laplace',
      budget
    );

    return noisyData;
  }

  private async performAnalysis(data: any[], circuitHash: string): Promise<any> {
    this.logger.info('Performing AI analysis with Alith');

    // Determine the appropriate model based on the circuit
    const modelId = this.selectModelForCircuit(circuitHash);

    // Prepare data for AI inference
    const analysisInput = {
      data: data,
      task: 'statistical_analysis',
      parameters: {
        aggregation: ['mean', 'median', 'std'],
        groupBy: 'category'
      }
    };

    // Submit to Alith for analysis
    const result = await this.alithService.submitInference(modelId, analysisInput);
    
    return result;
  }

  private selectModelForCircuit(circuitHash: string): string {
    // Map circuit types to appropriate models
    const circuitModelMap: Record<string, string> = {
      'DEFAULT_PRIVACY_ANALYTICS_CIRCUIT_V1': 'statistical_analysis_model',
      'CLASSIFICATION_CIRCUIT': 'classification_model',
      'REGRESSION_CIRCUIT': 'regression_model',
      'CLUSTERING_CIRCUIT': 'clustering_model'
    };

    // Default to the first configured model if circuit not mapped
    return circuitModelMap[circuitHash] || this.config.models[0] || 'default_model';
  }

  private async generateZKProof(job: AnalyticsJob, insights: any): Promise<ZKProof> {
    this.logger.info('Generating zero-knowledge proof');

    const computation = {
      circuit: job.circuitHash,
      inputs: [
        {
          name: 'dataset_hash',
          type: 'bytes32',
          source: job.datasetHash,
          preprocessing: []
        },
        {
          name: 'privacy_budget',
          type: 'uint256',
          source: job.privacyBudget.toString(),
          preprocessing: []
        }
      ],
      outputs: [
        {
          name: 'result_hash',
          type: 'bytes32',
          postprocessing: []
        }
      ],
      constraints: []
    };

    const proof = await this.privacyEngine.generateProof(computation, [job.datasetHash, insights]);
    return proof;
  }

  private generateVisualizations(insights: any): any[] {
    // Generate simple visualizations based on insights
    return [
      {
        type: 'chart',
        data: insights.aggregations || {},
        config: {
          type: 'bar',
          title: 'Statistical Analysis Results'
        }
      }
    ];
  }

  private startJobMonitoring(): void {
    const pollInterval = 10000; // Poll every 10 seconds
    
    const poll = async () => {
      if (!this.isRunning) return;

      try {
        // In a real implementation, this would query the blockchain for new jobs
        // For now, we'll just maintain the monitoring loop
        
        setTimeout(poll, pollInterval);
      } catch (error) {
        this.logger.error('Error polling for jobs:', error);
        setTimeout(poll, pollInterval * 2); // Back off on error
      }
    };

    poll();
  }

  getStatus(): AgentStatus {
    this.status.uptime = this.isRunning ? Date.now() - this.startTime : 0;
    return { ...this.status };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const alithHealthy = await this.alithService.healthCheck();
      const blockchainHealthy = await this.blockchainService.healthCheck();
      
      return alithHealthy && blockchainHealthy;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async getMetrics(): Promise<any> {
    return {
      agent: this.getStatus(),
      alith: await this.alithService.getUsageStats(),
      blockchain: await this.blockchainService.getMetrics(),
      queue: {
        size: this.jobQueue.size,
        pending: this.jobQueue.pending,
        isPaused: this.jobQueue.isPaused
      }
    };
  }

  // Allow manual job submission for testing
  async submitJob(datasetHash: string, circuitHash: string, privacyBudget: number): Promise<string> {
    const job: AnalyticsJob = {
      id: uuidv4(),
      datasetHash,
      circuitHash,
      requester: 'manual_submission',
      timestamp: Date.now(),
      status: JobStatus.PENDING,
      privacyBudget
    };

    // Submit to blockchain
    const jobId = await this.blockchainService.submitJob(job);
    
    // Add to processing queue
    this.jobQueue.add(() => this.processJob(job));

    return jobId;
  }
} 