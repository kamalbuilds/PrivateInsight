import { ethers, Contract, Provider, Wallet } from 'ethers';
import { EventEmitter } from 'events';
import { 
  BlockchainService as IBlockchainService,
  AnalyticsJob,
  ZKProof,
  JobStatus,
  BlockchainConfig
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';

export class BlockchainService extends EventEmitter implements IBlockchainService {
  private logger: Logger;
  private config: BlockchainConfig;
  private provider: Provider;
  private wallet: Wallet;
  private contracts: Record<string, Contract>;
  private isConnected: boolean = false;

  constructor(config: BlockchainConfig) {
    super();
    this.config = config;
    this.logger = new Logger('BlockchainService');
    this.contracts = {};

    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);
    this.wallet = new ethers.Wallet(this.config.privateKey, this.provider);
  }

  async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to blockchain...');

      // Test connection
      const network = await this.provider.getNetwork();
      this.logger.info(`Connected to network: ${network.name} (${network.chainId})`);

      // Initialize contracts
      await this.initializeContracts();

      this.isConnected = true;
      this.logger.info('Blockchain service connected successfully');
      this.emit('connected', { network: network.name, chainId: network.chainId });

    } catch (error: any) {
      this.logger.error('Failed to connect to blockchain:', error);
      throw new Error(`Blockchain connection failed: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    try {
      this.isConnected = false;
      this.removeAllListeners();
      this.logger.info('Disconnected from blockchain service');
    } catch (error: any) {
      this.logger.error('Error disconnecting from blockchain:', error);
    }
  }

  private async initializeContracts(): Promise<void> {
    // PrivateInsight Core Contract ABI (simplified for demo)
    const privateInsightCoreABI = [
      "function submitAnalyticsJob(bytes32 datasetHash, bytes32 circuitHash, uint256 privacyBudget) external returns (uint256)",
      "function getAnalyticsJob(uint256 jobId) external view returns (tuple(uint256 jobId, address requester, bytes32 datasetHash, bytes32 circuitHash, uint256 privacyBudget, uint8 status, uint256 timestamp))",
      "function submitProof(uint256 jobId, bytes calldata proof, uint256[] calldata publicInputs, bytes32 circuitHash) external returns (bool)",
      "function updateJobStatus(uint256 jobId, uint8 status) external",
      "function getPrivacyBudget(bytes32 datasetHash) external view returns (uint256)",
      "function allocatePrivacyBudget(bytes32 datasetHash, uint256 budget) external",
      "event AnalyticsJobSubmitted(uint256 indexed jobId, address indexed requester, bytes32 datasetHash)",
      "event ProofSubmitted(uint256 indexed jobId, bool verified)",
      "event JobStatusUpdated(uint256 indexed jobId, uint8 status)"
    ];

    // Initialize PrivateInsight Core contract
    this.contracts.privateInsightCore = new ethers.Contract(
      this.config.contractAddresses.privateInsightCore,
      privateInsightCoreABI,
      this.wallet
    );

    // Set up event listeners
    this.setupEventListeners();

    this.logger.info('Smart contracts initialized');
  }

  private setupEventListeners(): void {
    // Listen for analytics job submissions
    this.contracts.privateInsightCore.on('AnalyticsJobSubmitted', (jobId, requester, datasetHash) => {
      this.logger.info('Analytics job submitted', { jobId: jobId.toString(), requester, datasetHash });
      this.emit('jobSubmitted', jobId.toString());
    });

    // Listen for proof submissions
    this.contracts.privateInsightCore.on('ProofSubmitted', (jobId, verified) => {
      this.logger.info('Proof submitted', { jobId: jobId.toString(), verified });
      this.emit('proofSubmitted', jobId.toString(), verified);
    });

    // Listen for job status updates
    this.contracts.privateInsightCore.on('JobStatusUpdated', (jobId, status) => {
      this.logger.info('Job status updated', { jobId: jobId.toString(), status });
      this.emit('jobStatusUpdated', jobId.toString(), status);
    });
  }

  async submitJob(job: AnalyticsJob): Promise<string> {
    try {
      this.logger.info(`Submitting analytics job ${job.id}`, {
        datasetHash: job.datasetHash,
        circuitHash: job.circuitHash,
        privacyBudget: job.privacyBudget
      });

      const tx = await this.contracts.privateInsightCore.submitAnalyticsJob(
        job.datasetHash,
        job.circuitHash,
        ethers.parseEther(job.privacyBudget.toString()),
        {
          gasLimit: this.config.gasLimit,
          gasPrice: ethers.parseUnits(this.config.gasPrice, 'gwei')
        }
      );

      const receipt = await tx.wait();
      
      // Extract job ID from event logs
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.contracts.privateInsightCore.interface.parseLog(log);
          return parsed.name === 'AnalyticsJobSubmitted';
        } catch {
          return false;
        }
      });

      const jobId = event ? 
        this.contracts.privateInsightCore.interface.parseLog(event).args.jobId.toString() : 
        job.id;

      this.logger.info(`Analytics job submitted successfully`, {
        jobId,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      });

      return jobId;

    } catch (error: any) {
      this.logger.error(`Failed to submit analytics job ${job.id}:`, error);
      throw new Error(`Job submission failed: ${error.message}`);
    }
  }

  async getJob(jobId: string): Promise<AnalyticsJob> {
    try {
      this.logger.info(`Fetching job ${jobId}`);

      const jobData = await this.contracts.privateInsightCore.getAnalyticsJob(jobId);
      
      const job: AnalyticsJob = {
        id: jobData.jobId.toString(),
        datasetHash: jobData.datasetHash,
        circuitHash: jobData.circuitHash,
        requester: jobData.requester,
        timestamp: Number(jobData.timestamp),
        status: this.mapJobStatus(jobData.status),
        privacyBudget: Number(ethers.formatEther(jobData.privacyBudget))
      };

      this.logger.info(`Successfully fetched job ${jobId}`);
      return job;

    } catch (error: any) {
      this.logger.error(`Failed to fetch job ${jobId}:`, error);
      throw new Error(`Failed to get job: ${error.message}`);
    }
  }

  async submitProof(jobId: string, proof: ZKProof): Promise<boolean> {
    try {
      this.logger.info(`Submitting proof for job ${jobId}`);

      const tx = await this.contracts.privateInsightCore.submitProof(
        jobId,
        proof.proof,
        proof.publicInputs.map(input => ethers.parseUnits(input, 0)),
        proof.circuitHash,
        {
          gasLimit: this.config.gasLimit,
          gasPrice: ethers.parseUnits(this.config.gasPrice, 'gwei')
        }
      );

      const receipt = await tx.wait();
      
      // Check if proof was verified
      const event = receipt.logs.find((log: any) => {
        try {
          const parsed = this.contracts.privateInsightCore.interface.parseLog(log);
          return parsed.name === 'ProofSubmitted';
        } catch {
          return false;
        }
      });

      const verified = event ? 
        this.contracts.privateInsightCore.interface.parseLog(event).args.verified : 
        true;

      this.logger.info(`Proof submitted for job ${jobId}`, {
        verified,
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString()
      });

      return verified;

    } catch (error: any) {
      this.logger.error(`Failed to submit proof for job ${jobId}:`, error);
      throw new Error(`Proof submission failed: ${error.message}`);
    }
  }

  async updateJobStatus(jobId: string, status: JobStatus): Promise<void> {
    try {
      this.logger.info(`Updating job ${jobId} status to ${status}`);

      const statusCode = this.mapJobStatusToCode(status);
      
      const tx = await this.contracts.privateInsightCore.updateJobStatus(
        jobId,
        statusCode,
        {
          gasLimit: this.config.gasLimit,
          gasPrice: ethers.parseUnits(this.config.gasPrice, 'gwei')
        }
      );

      await tx.wait();
      
      this.logger.info(`Job ${jobId} status updated to ${status}`);

    } catch (error: any) {
      this.logger.error(`Failed to update job ${jobId} status:`, error);
      throw new Error(`Status update failed: ${error.message}`);
    }
  }

  async getPrivacyBudget(datasetHash: string): Promise<number> {
    try {
      this.logger.info(`Fetching privacy budget for dataset ${datasetHash}`);

      const budget = await this.contracts.privateInsightCore.getPrivacyBudget(datasetHash);
      const budgetValue = Number(ethers.formatEther(budget));

      this.logger.info(`Privacy budget for dataset ${datasetHash}: ${budgetValue}`);
      return budgetValue;

    } catch (error: any) {
      this.logger.error(`Failed to fetch privacy budget for dataset ${datasetHash}:`, error);
      throw new Error(`Failed to get privacy budget: ${error.message}`);
    }
  }

  private mapJobStatus(statusCode: number): JobStatus {
    const statusMap: Record<number, JobStatus> = {
      0: JobStatus.PENDING,
      1: JobStatus.PROCESSING,
      2: JobStatus.COMPLETED,
      3: JobStatus.FAILED,
      4: JobStatus.VERIFIED
    };

    return statusMap[statusCode] || JobStatus.PENDING;
  }

  private mapJobStatusToCode(status: JobStatus): number {
    const statusCodeMap: Record<JobStatus, number> = {
      [JobStatus.PENDING]: 0,
      [JobStatus.PROCESSING]: 1,
      [JobStatus.COMPLETED]: 2,
      [JobStatus.FAILED]: 3,
      [JobStatus.VERIFIED]: 4
    };

    return statusCodeMap[status] || 0;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      
      this.logger.info('Blockchain health check', {
        blockNumber,
        balance: ethers.formatEther(balance),
        connected: this.isConnected
      });

      return this.isConnected && blockNumber > 0;
    } catch (error: any) {
      this.logger.error('Blockchain health check failed:', error);
      return false;
    }
  }

  async getMetrics(): Promise<any> {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const balance = await this.provider.getBalance(this.wallet.address);
      const gasPrice = await this.provider.getFeeData();

      return {
        network: {
          blockNumber,
          gasPrice: gasPrice.gasPrice?.toString(),
          maxFeePerGas: gasPrice.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas?.toString()
        },
        wallet: {
          address: this.wallet.address,
          balance: ethers.formatEther(balance)
        },
        connection: {
          isConnected: this.isConnected,
          rpcUrl: this.config.rpcUrl
        }
      };
    } catch (error: any) {
      this.logger.error('Failed to get blockchain metrics:', error);
      throw new Error(`Failed to get metrics: ${error.message}`);
    }
  }

  getConfig(): BlockchainConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<BlockchainConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Blockchain service configuration updated');
  }
} 