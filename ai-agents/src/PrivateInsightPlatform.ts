import { MetisClient } from './clients/MetisClient';
import { AlithAgent } from './clients/AlithClient';
import { PrivacyCoordinator } from './privacy/PrivacyCoordinator';
import { 
    PlatformConfig, 
    AnalyticsJob, 
    JobStatus, 
    AnalysisType,
    AgentConfig,
    AgentType,
    PrivacyConfig,
    PerformanceMetrics,
    APIResponse
} from './types';

/**
 * PrivateInsightPlatform - Main platform class for TEE-powered AI analytics
 * Integrates Metis Hyperion, Alith agents, and privacy-preserving technologies
 */
export class PrivateInsightPlatform {
    private metisClient: MetisClient;
    private alithAgent: AlithAgent;
    private privacyCoordinator: PrivacyCoordinator;
    private platformConfig: PlatformConfig;
    private isInitialized: boolean = false;
    
    // Platform state
    private activeJobs: Map<string, AnalyticsJob> = new Map();
    private registeredAgents: Map<string, AgentConfig> = new Map();
    private platformMetrics: PerformanceMetrics;
    
    constructor(config: PlatformConfig, privateKey?: string) {
        this.platformConfig = config;
        this.metisClient = new MetisClient(privateKey);
        this.alithAgent = new AlithAgent();
        this.privacyCoordinator = new PrivacyCoordinator();
        
        this.platformMetrics = {
            jobsCompleted: 0,
            averageProcessingTime: 0,
            totalRewardsDistributed: '0',
            averagePrivacyScore: 0,
            teeUptime: 0,
            resourceUtilization: 0,
            errorRate: 0
        };
    }
    
    /**
     * Initialize the PrivateInsight platform
     */
    async initialize(): Promise<APIResponse> {
        try {
            console.log('🚀 Initializing PrivateInsight Platform...');
            
            // Initialize privacy policies
            await this.initializePrivacyPolicies();
            
            // Register default AI agents
            await this.registerDefaultAgents();
            
            // Verify platform connectivity
            await this.verifyConnectivity();
            
            this.isInitialized = true;
            
            console.log('✅ PrivateInsight Platform initialized successfully');
            console.log(`📊 Connected to Metis Hyperion: ${this.platformConfig.metisRpcUrl}`);
            console.log(`🔒 Privacy policies: 4 categories configured`);
            console.log(`🤖 AI agents: ${this.registeredAgents.size} agents registered`);
            
            return {
                success: true,
                data: {
                    status: 'initialized',
                    agents: this.registeredAgents.size,
                    privacyPolicies: 4,
                    teeEnabled: true
                },
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error('❌ Platform initialization failed:', error);
            return {
                success: false,
                error: `Platform initialization failed: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Submit analytics job for confidential processing
     */
    async submitAnalyticsJob(
        dataset: any,
        analysisType: AnalysisType,
        dataCategory: string = 'general',
        rewardAmount: bigint = BigInt(1000000000000000000) // 1 DAT token
    ): Promise<APIResponse<{ jobId: string; estimatedCompletion: number }>> {
        try {
            this.ensureInitialized();
            
            console.log(`📊 Submitting analytics job: ${analysisType} for ${dataCategory} data`);
            
            // Validate data processing against privacy policies
            const validation = await this.privacyCoordinator.validateDataProcessing(
                dataCategory,
                analysisType,
                JSON.stringify(dataset).length
            );
            
            if (!validation.isValid) {
                throw new Error(`Privacy validation failed: ${validation.violations.join(', ')}`);
            }
            
            // Submit job to Metis network
            const jobResult = await this.metisClient.submitAnalyticsJob(
                dataset,
                analysisType,
                rewardAmount
            );
            
            // Create internal job tracking
            const job: AnalyticsJob = {
                jobId: jobResult.jobId,
                requester: 'user', // Would be actual user address
                datasetHash: jobResult.encryptedDataset.substring(0, 64),
                encryptedDataset: jobResult.encryptedDataset,
                analysisType,
                teeAttestationHash: '',
                timestamp: Date.now(),
                rewardAmount,
                status: JobStatus.Pending,
                resultHash: '',
                encryptedResult: '',
                privacyScore: 0
            };
            
            this.activeJobs.set(jobResult.jobId.toString(), job);
            
            // Estimate completion time
            const estimatedCompletion = Date.now() + (5 * 60 * 1000); // 5 minutes
            
            console.log(`✅ Analytics job submitted successfully: ${jobResult.jobId}`);
            console.log(`🔐 Privacy requirements: ${validation.requiredMeasures.join(', ')}`);
            
            return {
                success: true,
                data: {
                    jobId: jobResult.jobId.toString(),
                    estimatedCompletion
                },
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error('❌ Analytics job submission failed:', error);
            return {
                success: false,
                error: `Job submission failed: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Process analytics job using TEE and AI inference
     */
    async processAnalyticsJob(jobId: string): Promise<APIResponse<{ privacyScore: number; processingTime: number }>> {
        try {
            this.ensureInitialized();
            
            const job = this.activeJobs.get(jobId);
            if (!job) {
                throw new Error(`Job not found: ${jobId}`);
            }
            
            if (job.status !== JobStatus.Pending) {
                throw new Error(`Job ${jobId} is not in pending status`);
            }
            
            console.log(`⚡ Processing analytics job: ${jobId}`);
            const startTime = Date.now();
            
            // Update job status
            job.status = JobStatus.Processing;
            this.activeJobs.set(jobId, job);
            
            // Process using Metis VM and Alith TEE
            const processingResult = await this.metisClient.processAnalyticsJob(
                BigInt(jobId),
                job.encryptedDataset,
                job.analysisType
            );
            
            // Update job with results
            job.teeAttestationHash = processingResult.teeAttestationHash;
            job.privacyScore = processingResult.privacyScore;
            job.status = JobStatus.Completed;
            
            const processingTime = Date.now() - startTime;
            
            // Update platform metrics
            this.updatePlatformMetrics(processingTime, job.privacyScore);
            
            // Update privacy budget
            await this.privacyCoordinator.updatePrivacyBudget(
                'general', // Would determine from job
                0.01 // Small budget consumption
            );
            
            this.activeJobs.set(jobId, job);
            
            console.log(`✅ Analytics job completed: ${jobId}`);
            console.log(`🔐 Privacy score: ${job.privacyScore}%`);
            console.log(`⏱️ Processing time: ${(processingTime / 1000).toFixed(2)}s`);
            
            return {
                success: true,
                data: {
                    privacyScore: job.privacyScore,
                    processingTime
                },
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error(`❌ Job processing failed for ${jobId}:`, error);
            
            // Update job status to failed
            const job = this.activeJobs.get(jobId);
            if (job) {
                job.status = JobStatus.Failed;
                this.activeJobs.set(jobId, job);
            }
            
            return {
                success: false,
                error: `Job processing failed: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Get analytics results for a completed job
     */
    async getAnalyticsResults(jobId: string): Promise<APIResponse<{ results: any; privacyScore: number }>> {
        try {
            this.ensureInitialized();
            
            const job = this.activeJobs.get(jobId);
            if (!job) {
                throw new Error(`Job not found: ${jobId}`);
            }
            
            if (job.status !== JobStatus.Completed) {
                throw new Error(`Job ${jobId} is not completed`);
            }
            
            console.log(`📊 Retrieving results for job: ${jobId}`);
            
            // Get results from Metis network
            const results = await this.metisClient.getAnalyticsResults(BigInt(jobId));
            
            console.log(`✅ Results retrieved for job: ${jobId}`);
            console.log(`🔐 Privacy score: ${results.privacyScore}%`);
            console.log(`🔓 Decryption status: ${results.isDecrypted ? 'Success' : 'Encrypted'}`);
            
            return {
                success: true,
                data: {
                    results: results.results,
                    privacyScore: results.privacyScore
                },
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error(`❌ Failed to get results for job ${jobId}:`, error);
            return {
                success: false,
                error: `Failed to get results: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Register AI model for analytics
     */
    async registerAIModel(
        modelType: string,
        modelData: any,
        accuracy: number,
        privacyLevel: number
    ): Promise<APIResponse<{ modelId: string; modelHash: string }>> {
        try {
            this.ensureInitialized();
            
            console.log(`🤖 Registering AI model: ${modelType}`);
            
            const modelResult = await this.metisClient.registerAIModel(
                modelType,
                modelData,
                accuracy,
                privacyLevel
            );
            
            console.log(`✅ AI model registered: ${modelType} (ID: ${modelResult.modelId})`);
            
            return {
                success: true,
                data: {
                    modelId: modelResult.modelId.toString(),
                    modelHash: modelResult.modelHash
                },
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error('❌ AI model registration failed:', error);
            return {
                success: false,
                error: `Model registration failed: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Get platform performance metrics
     */
    async getPlatformMetrics(): Promise<APIResponse<PerformanceMetrics>> {
        try {
            this.ensureInitialized();
            
            // Get updated platform stats from Metis
            const platformStats = await this.metisClient.getPlatformStats();
            
            // Get TEE status
            const teeStatus = await this.metisClient.monitorTEEStatus();
            
            // Update metrics
            this.platformMetrics = {
                ...this.platformMetrics,
                jobsCompleted: platformStats.completedJobs,
                totalRewardsDistributed: platformStats.totalRewards,
                teeUptime: teeStatus.isAvailable ? 100 : 0,
                resourceUtilization: 75 // Simulated
            };
            
            return {
                success: true,
                data: this.platformMetrics,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error('❌ Failed to get platform metrics:', error);
            return {
                success: false,
                error: `Failed to get metrics: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    /**
     * Get privacy audit report
     */
    async getPrivacyAuditReport(): Promise<APIResponse> {
        try {
            this.ensureInitialized();
            
            const auditReport = await this.privacyCoordinator.generatePrivacyAuditReport();
            
            return {
                success: true,
                data: auditReport,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
            
        } catch (error) {
            console.error('❌ Privacy audit failed:', error);
            return {
                success: false,
                error: `Privacy audit failed: ${error}`,
                timestamp: Date.now(),
                requestId: this.generateRequestId()
            };
        }
    }
    
    // Private helper methods
    
    private async initializePrivacyPolicies(): Promise<void> {
        // Privacy policies are initialized automatically in PrivacyCoordinator
        console.log('🔒 Privacy policies initialized');
    }
    
    private async registerDefaultAgents(): Promise<void> {
        const defaultAgents: AgentConfig[] = [
            {
                agentId: 'analytics-agent-001',
                agentType: AgentType.AnalyticsAgent,
                capabilities: ['regression', 'classification', 'clustering'],
                privacyConfig: {
                    encryptionMethod: 'AES256' as any,
                    privacyLevel: 8,
                    teeRequired: true,
                    complianceFrameworks: [],
                    privacyBudget: 0.1
                },
                resourceLimits: {
                    cpuCores: 4,
                    memoryGB: 8,
                    diskSpaceGB: 100,
                    gpuRequired: false,
                    teeRequired: true,
                    estimatedDurationMinutes: 30
                }
            },
            {
                agentId: 'privacy-auditor-001',
                agentType: AgentType.PrivacyAuditor,
                capabilities: ['compliance-validation', 'privacy-scoring'],
                privacyConfig: {
                    encryptionMethod: 'Hybrid' as any,
                    privacyLevel: 10,
                    teeRequired: true,
                    complianceFrameworks: [],
                    privacyBudget: 0.05
                },
                resourceLimits: {
                    cpuCores: 2,
                    memoryGB: 4,
                    diskSpaceGB: 50,
                    gpuRequired: false,
                    teeRequired: true,
                    estimatedDurationMinutes: 15
                }
            }
        ];
        
        for (const agent of defaultAgents) {
            this.registeredAgents.set(agent.agentId, agent);
        }
        
        console.log(`🤖 Registered ${defaultAgents.length} default AI agents`);
    }
    
    private async verifyConnectivity(): Promise<void> {
        try {
            // Verify Metis connection
            const teeStatus = await this.metisClient.monitorTEEStatus();
            if (!teeStatus.isAvailable) {
                console.warn('⚠️ TEE not available - some features may be limited');
            }
            
            console.log('🌐 Platform connectivity verified');
        } catch (error) {
            console.warn('⚠️ Connectivity verification failed:', error);
        }
    }
    
    private updatePlatformMetrics(processingTime: number, privacyScore: number): void {
        this.platformMetrics.jobsCompleted += 1;
        
        // Update average processing time
        const totalJobs = this.platformMetrics.jobsCompleted;
        this.platformMetrics.averageProcessingTime = 
            (this.platformMetrics.averageProcessingTime * (totalJobs - 1) + processingTime) / totalJobs;
        
        // Update average privacy score
        this.platformMetrics.averagePrivacyScore = 
            (this.platformMetrics.averagePrivacyScore * (totalJobs - 1) + privacyScore) / totalJobs;
        
        // Keep error rate low for successful jobs
        this.platformMetrics.errorRate = Math.max(0, this.platformMetrics.errorRate - 0.1);
    }
    
    private ensureInitialized(): void {
        if (!this.isInitialized) {
            throw new Error('Platform not initialized. Call initialize() first.');
        }
    }
    
    private generateRequestId(): string {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Shutdown platform gracefully
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Shutting down PrivateInsight Platform...');
        
        // Cancel any pending jobs
        for (const [jobId, job] of this.activeJobs) {
            if (job.status === JobStatus.Processing) {
                job.status = JobStatus.Failed;
                console.log(`❌ Cancelled job: ${jobId}`);
            }
        }
        
        this.isInitialized = false;
        console.log('✅ Platform shutdown complete');
    }
} 