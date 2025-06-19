import { ethers } from 'ethers';
import { AlithAgent } from './AlithClient';

/**
 * MetisClient - Integration with Metis Hyperion SDK
 * Handles on-chain AI inference, TEE operations, and parallel execution
 */
export class MetisClient {
    private provider: ethers.Provider;
    private signer: ethers.Signer;
    private metisVMContract: ethers.Contract;
    private privateInsightCore: ethers.Contract;
    private alithClient: AlithAgent;
    
    // Metis Hyperion configuration
    private readonly HYPERION_RPC = 'https://hyperion.metis.io';
    private readonly CHAIN_ID = 59902; // Hyperion testnet
    
    // Contract addresses (will be deployed)
    private readonly METIS_VM_ADDRESS = process.env.METIS_VM_ADDRESS!;
    private readonly PRIVATE_INSIGHT_CORE_ADDRESS = process.env.PRIVATE_INSIGHT_CORE_ADDRESS!;
    
    constructor(privateKey?: string) {
        this.provider = new ethers.JsonRpcProvider(this.HYPERION_RPC);
        
        if (privateKey) {
            this.signer = new ethers.Wallet(privateKey, this.provider);
        } else {
            throw new Error('Private key required for Metis client initialization');
        }
        
        this.initializeContracts();
        this.alithClient = new AlithAgent();
    }
    
    private initializeContracts(): void {
        // MetisVM ABI for AI inference
        const metisVMABI = [
            "function executeInference(tuple(uint256 requestId, uint8 modelType, bytes32 modelHash, bytes encryptedInput, uint256 gasLimit, address requester, uint256 timestamp) request) external payable returns (uint256)",
            "function getInferenceResult(uint256 requestId) external view returns (tuple(uint256 requestId, bytes encryptedOutput, uint256 confidenceScore, bytes32 executionProof, uint256 gasUsed, bool success))",
            "function registerModel(uint8 modelType, bytes calldata modelData, uint256 accuracy) external returns (bytes32)",
            "function verifyTEEAttestation(tuple(bytes32 attestationHash, address teeValidator, uint256 securityLevel, bytes signature, uint256 timestamp, bool isValid) attestation) external view returns (bool)",
            "function getTEEStatus() external view returns (bool isAvailable, uint256 securityLevel, uint256 activeValidators)"
        ];
        
        // PrivateInsightCore ABI
        const coreABI = [
            "function submitAnalyticsJob(bytes calldata encryptedDataset, string calldata analysisType, uint256 rewardAmount) external returns (uint256)",
            "function processAnalyticsJob(uint256 jobId, bytes32 teeAttestationHash) external",
            "function completeAnalyticsJob(uint256 jobId, bytes calldata encryptedResult, uint256 privacyScore) external",
            "function getAnalyticsResults(uint256 jobId) external view returns (bytes memory, uint256)",
            "function registerAIModel(string calldata modelType, bytes32 modelHash, uint256 accuracy, uint256 privacyLevel) external returns (uint256)"
        ];
        
        this.metisVMContract = new ethers.Contract(
            this.METIS_VM_ADDRESS,
            metisVMABI,
            this.signer
        );
        
        this.privateInsightCore = new ethers.Contract(
            this.PRIVATE_INSIGHT_CORE_ADDRESS,
            coreABI,
            this.signer
        );
    }
    
    /**
     * Submit confidential analytics job to PrivateInsight platform
     */
    async submitAnalyticsJob(
        dataset: any,
        analysisType: string,
        rewardAmount: bigint
    ): Promise<{
        jobId: bigint;
        transactionHash: string;
        encryptedDataset: string;
    }> {
        try {
            // Encrypt dataset using Alith's encryption
            const encryptedDataset = await this.alithClient.encryptData(
                JSON.stringify(dataset),
                'AES256'
            );
            
            console.log('🔐 Dataset encrypted using Alith TEE encryption');
            
            // Submit analytics job to PrivateInsight
            const tx = await this.privateInsightCore.submitAnalyticsJob(
                encryptedDataset,
                analysisType,
                rewardAmount
            );
            
            const receipt = await tx.wait();
            const jobCreatedEvent = receipt.logs.find((log: any) => 
                log.eventName === 'AnalyticsJobCreated'
            );
            
            const jobId = jobCreatedEvent?.args?.jobId;
            
            console.log(`📊 Analytics job submitted: Job ID ${jobId}`);
            console.log(`💰 Reward amount: ${ethers.formatEther(rewardAmount)} DAT`);
            
            return {
                jobId,
                transactionHash: receipt.hash,
                encryptedDataset
            };
            
        } catch (error) {
            console.error('❌ Failed to submit analytics job:', error);
            throw new Error(`Analytics job submission failed: ${error}`);
        }
    }
    
    /**
     * Process analytics job using MetisVM AI inference with TEE
     */
    async processAnalyticsJob(
        jobId: bigint,
        encryptedDataset: string,
        analysisType: string
    ): Promise<{
        requestId: bigint;
        teeAttestationHash: string;
        privacyScore: number;
    }> {
        try {
            // Generate TEE attestation using Alith
            const teeAttestation = await this.alithClient.generateTEEAttestation(
                encryptedDataset,
                analysisType
            );
            
            console.log('🔒 TEE attestation generated');
            
            // Verify TEE status on MetisVM
            const [isAvailable, securityLevel, activeValidators] = await this.metisVMContract.getTEEStatus();
            
            if (!isAvailable) {
                throw new Error('TEE is not available on MetisVM');
            }
            
            console.log(`🛡️ TEE Status: Available (Security Level: ${securityLevel}, Validators: ${activeValidators})`);
            
            // Start processing analytics job
            const processTx = await this.privateInsightCore.processAnalyticsJob(
                jobId,
                teeAttestation.attestationHash
            );
            
            await processTx.wait();
            console.log(`⚡ Analytics job processing started: Job ID ${jobId}`);
            
            // Execute AI inference on MetisVM with TEE protection
            const inferenceRequest = {
                requestId: 0n,
                modelType: this.getModelTypeForAnalysis(analysisType),
                modelHash: ethers.keccak256(ethers.toUtf8Bytes(analysisType)),
                encryptedInput: encryptedDataset,
                gasLimit: 1000000n,
                requester: await this.signer.getAddress(),
                timestamp: BigInt(Math.floor(Date.now() / 1000))
            };
            
            const inferenceGasCost = await this.metisVMContract.estimateInferenceGas(
                inferenceRequest.modelType,
                encryptedDataset.length
            );
            
            console.log(`⛽ Estimated gas for AI inference: ${inferenceGasCost}`);
            
            const inferenceTx = await this.metisVMContract.executeInference(
                inferenceRequest,
                { value: inferenceGasCost }
            );
            
            const inferenceReceipt = await inferenceTx.wait();
            const inferenceEvent = inferenceReceipt.logs.find((log: any) => 
                log.eventName === 'InferenceRequested'
            );
            
            const requestId = inferenceEvent?.args?.requestId;
            
            console.log(`🤖 AI inference request submitted: Request ID ${requestId}`);
            
            // Wait for inference completion and get results
            await this.waitForInferenceCompletion(requestId);
            const inferenceResult = await this.metisVMContract.getInferenceResult(requestId);
            
            if (!inferenceResult.success) {
                throw new Error('AI inference failed');
            }
            
            // Calculate privacy score based on TEE execution
            const privacyScore = await this.calculatePrivacyScore(
                teeAttestation,
                inferenceResult
            );
            
            // Complete analytics job with encrypted results
            const completeTx = await this.privateInsightCore.completeAnalyticsJob(
                jobId,
                inferenceResult.encryptedOutput,
                privacyScore
            );
            
            await completeTx.wait();
            
            console.log(`✅ Analytics job completed with privacy score: ${privacyScore}%`);
            
            return {
                requestId,
                teeAttestationHash: teeAttestation.attestationHash,
                privacyScore
            };
            
        } catch (error) {
            console.error('❌ Failed to process analytics job:', error);
            throw new Error(`Analytics job processing failed: ${error}`);
        }
    }
    
    /**
     * Retrieve and decrypt analytics results
     */
    async getAnalyticsResults(jobId: bigint): Promise<{
        results: any;
        privacyScore: number;
        isDecrypted: boolean;
    }> {
        try {
            // Get encrypted results from contract
            const [encryptedResult, privacyScore] = await this.privateInsightCore.getAnalyticsResults(jobId);
            
            console.log(`📊 Retrieved analytics results for Job ID ${jobId}`);
            console.log(`🔐 Privacy Score: ${privacyScore}%`);
            
            // Decrypt results using Alith
            const decryptedResult = await this.alithClient.decryptData(
                encryptedResult,
                'user_private_key' // This would be the user's actual private key
            );
            
            const results = JSON.parse(decryptedResult);
            
            return {
                results,
                privacyScore: Number(privacyScore),
                isDecrypted: true
            };
            
        } catch (error) {
            console.error('❌ Failed to retrieve analytics results:', error);
            // Return encrypted results if decryption fails
            const [encryptedResult, privacyScore] = await this.privateInsightCore.getAnalyticsResults(jobId);
            
            return {
                results: encryptedResult,
                privacyScore: Number(privacyScore),
                isDecrypted: false
            };
        }
    }
    
    /**
     * Register AI model for on-chain inference
     */
    async registerAIModel(
        modelType: string,
        modelData: any,
        accuracy: number,
        privacyLevel: number
    ): Promise<{
        modelId: bigint;
        modelHash: string;
    }> {
        try {
            // Encrypt model data
            const encryptedModelData = await this.alithClient.encryptData(
                JSON.stringify(modelData),
                'AES256'
            );
            
            // Register on MetisVM
            const modelTypeEnum = this.getModelTypeForAnalysis(modelType);
            const modelHash = await this.metisVMContract.registerModel(
                modelTypeEnum,
                encryptedModelData,
                accuracy
            );
            
            // Register on PrivateInsight platform
            const modelId = await this.privateInsightCore.registerAIModel(
                modelType,
                modelHash,
                accuracy,
                privacyLevel
            );
            
            console.log(`🤖 AI model registered: ${modelType} (ID: ${modelId})`);
            console.log(`📊 Accuracy: ${accuracy}%, Privacy Level: ${privacyLevel}/10`);
            
            return {
                modelId,
                modelHash
            };
            
        } catch (error) {
            console.error('❌ Failed to register AI model:', error);
            throw new Error(`AI model registration failed: ${error}`);
        }
    }
    
    /**
     * Enable parallel execution for high-throughput analytics
     */
    async enableParallelExecution(requestIds: bigint[]): Promise<bigint> {
        try {
            const batchId = await this.metisVMContract.enableParallelExecution(requestIds);
            
            console.log(`⚡ Parallel execution enabled for ${requestIds.length} requests`);
            console.log(`📦 Batch ID: ${batchId}`);
            
            return batchId;
            
        } catch (error) {
            console.error('❌ Failed to enable parallel execution:', error);
            throw new Error(`Parallel execution failed: ${error}`);
        }
    }
    
    /**
     * Monitor TEE status and security level
     */
    async monitorTEEStatus(): Promise<{
        isAvailable: boolean;
        securityLevel: number;
        activeValidators: number;
        recommendations: string[];
    }> {
        try {
            const [isAvailable, securityLevel, activeValidators] = await this.metisVMContract.getTEEStatus();
            
            const recommendations: string[] = [];
            
            if (securityLevel < 8) {
                recommendations.push('⚠️ Consider using higher security level for sensitive data');
            }
            
            if (activeValidators < 3) {
                recommendations.push('⚠️ Low number of TEE validators - consider waiting for more');
            }
            
            if (!isAvailable) {
                recommendations.push('❌ TEE not available - operations will fail');
            }
            
            return {
                isAvailable,
                securityLevel: Number(securityLevel),
                activeValidators: Number(activeValidators),
                recommendations
            };
            
        } catch (error) {
            console.error('❌ Failed to monitor TEE status:', error);
            throw new Error(`TEE status monitoring failed: ${error}`);
        }
    }
    
    // Helper methods
    
    private getModelTypeForAnalysis(analysisType: string): number {
        const modelMap: { [key: string]: number } = {
            'regression': 0, // LinearRegression
            'classification': 1, // LogisticRegression
            'neural_network': 2, // NeuralNetwork
            'decision_tree': 3, // DecisionTree
            'random_forest': 4, // RandomForest
            'svm': 5, // SVM
            'clustering': 6, // KMeans
            'nlp': 7, // NLP
            'cnn': 8, // ConvolutionalNN
            'llm': 9 // LLM
        };
        
        return modelMap[analysisType.toLowerCase()] || 2; // Default to neural network
    }
    
    private async waitForInferenceCompletion(requestId: bigint): Promise<void> {
        const maxWaitTime = 300000; // 5 minutes
        const checkInterval = 5000; // 5 seconds
        let waitTime = 0;
        
        while (waitTime < maxWaitTime) {
            try {
                const result = await this.metisVMContract.getInferenceResult(requestId);
                if (result.success || result.encryptedOutput !== '0x') {
                    return;
                }
            } catch (error) {
                // Continue waiting if result not ready
            }
            
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waitTime += checkInterval;
        }
        
        throw new Error('AI inference timed out');
    }
    
    private async calculatePrivacyScore(
        teeAttestation: any,
        inferenceResult: any
    ): Promise<number> {
        // Privacy score calculation based on:
        // - TEE security level
        // - Encryption strength
        // - Data integrity verification
        // - Execution proof validity
        
        let score = 0;
        
        // TEE attestation validation (0-40 points)
        if (teeAttestation.isValid) {
            score += 40;
        }
        
        // Execution proof validation (0-30 points)
        if (inferenceResult.executionProof !== '0x') {
            score += 30;
        }
        
        // Confidence score integration (0-20 points)
        score += Math.min(20, Math.floor(inferenceResult.confidenceScore / 5));
        
        // Encryption verification (0-10 points)
        if (inferenceResult.encryptedOutput.length > 100) {
            score += 10;
        }
        
        return Math.min(100, score);
    }
    
    /**
     * Get platform statistics and metrics
     */
    async getPlatformStats(): Promise<{
        totalJobs: number;
        completedJobs: number;
        totalRewards: string;
        averagePrivacyScore: number;
    }> {
        try {
            const [totalJobs, completedJobs, totalRewards] = await this.privateInsightCore.getPlatformStats();
            
            // Calculate average privacy score (this would be tracked in a more sophisticated way)
            const averagePrivacyScore = 85; // Placeholder - would be calculated from historical data
            
            return {
                totalJobs: Number(totalJobs),
                completedJobs: Number(completedJobs),
                totalRewards: ethers.formatEther(totalRewards),
                averagePrivacyScore
            };
            
        } catch (error) {
            console.error('❌ Failed to get platform stats:', error);
            throw new Error(`Platform stats retrieval failed: ${error}`);
        }
    }
}

export default MetisClient; 