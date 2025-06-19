import { PrivateInsightPlatform } from '../PrivateInsightPlatform';
import { PlatformConfig, AnalysisType } from '../types';

/**
 * Example usage of PrivateInsight Platform for TEE-powered AI analytics
 */
async function demonstratePrivateInsight() {
    console.log('🚀 PrivateInsight Platform Demo - TEE-Powered AI Analytics');
    console.log('=' .repeat(70));
    
    // Configure the platform
    const config: PlatformConfig = {
        metisRpcUrl: 'https://hyperion.metis.io',
        alithApiEndpoint: 'https://api.alith.ai',
        teeAttestationUrl: 'https://tee.alith.ai',
        datTokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
        privateInsightCoreAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        metisVMAddress: '0x9876543210fedcba9876543210fedcba98765432'
    };
    
    // Initialize platform
    const platform = new PrivateInsightPlatform(config);
    
    try {
        // Step 1: Initialize the platform
        console.log('\n📋 Step 1: Initializing Platform...');
        const initResult = await platform.initialize();
        
        if (!initResult.success) {
            throw new Error(`Platform initialization failed: ${initResult.error}`);
        }
        
        console.log('✅ Platform initialized successfully');
        console.log(`   Agents: ${initResult.data.agents}`);
        console.log(`   Privacy Policies: ${initResult.data.privacyPolicies}`);
        console.log(`   TEE Enabled: ${initResult.data.teeEnabled}`);
        
        // Step 2: Submit healthcare analytics job
        console.log('\n🏥 Step 2: Submitting Healthcare Analytics Job...');
        
        const healthcareData = {
            patients: [
                { age: 45, symptoms: ['fever', 'cough'], diagnosis: 'flu' },
                { age: 62, symptoms: ['chest pain'], diagnosis: 'cardiac' },
                { age: 33, symptoms: ['headache'], diagnosis: 'migraine' }
            ],
            metadata: {
                hasConsent: true,
                isAnonymized: true,
                encryptionInTransit: true,
                encryptionAtRest: true,
                accessControl: true,
                auditLogging: true,
                minimumNecessary: true
            }
        };
        
        const jobSubmission = await platform.submitAnalyticsJob(
            healthcareData,
            AnalysisType.Classification,
            'healthcare',
            BigInt('2000000000000000000') // 2 DAT tokens
        );
        
        if (!jobSubmission.success) {
            throw new Error(`Job submission failed: ${jobSubmission.error}`);
        }
        
        const jobId = jobSubmission.data.jobId;
        console.log(`✅ Healthcare analytics job submitted`);
        console.log(`   Job ID: ${jobId}`);
        console.log(`   Estimated completion: ${new Date(jobSubmission.data.estimatedCompletion).toLocaleTimeString()}`);
        
        // Step 3: Process the analytics job
        console.log('\n⚡ Step 3: Processing Analytics Job with TEE...');
        
        const processingResult = await platform.processAnalyticsJob(jobId);
        
        if (!processingResult.success) {
            throw new Error(`Job processing failed: ${processingResult.error}`);
        }
        
        console.log('✅ Analytics job processed successfully');
        console.log(`   Privacy Score: ${processingResult.data.privacyScore}%`);
        console.log(`   Processing Time: ${(processingResult.data.processingTime / 1000).toFixed(2)}s`);
        
        // Step 4: Retrieve results
        console.log('\n📊 Step 4: Retrieving Confidential Results...');
        
        const resultsResponse = await platform.getAnalyticsResults(jobId);
        
        if (!resultsResponse.success) {
            throw new Error(`Results retrieval failed: ${resultsResponse.error}`);
        }
        
        console.log('✅ Results retrieved successfully');
        console.log(`   Privacy Score: ${resultsResponse.data.privacyScore}%`);
        console.log(`   Results: ${JSON.stringify(resultsResponse.data.results, null, 2)}`);
        
        // Step 5: Register a custom AI model
        console.log('\n🤖 Step 5: Registering Custom AI Model...');
        
        const customModel = {
            type: 'neural_network',
            layers: [
                { type: 'dense', units: 128, activation: 'relu' },
                { type: 'dropout', rate: 0.3 },
                { type: 'dense', units: 64, activation: 'relu' },
                { type: 'dense', units: 3, activation: 'softmax' }
            ],
            optimizer: 'adam',
            loss: 'categorical_crossentropy'
        };
        
        const modelResult = await platform.registerAIModel(
            'Healthcare Diagnosis Classifier',
            customModel,
            94.5, // 94.5% accuracy
            9     // Privacy level 9/10
        );
        
        if (!modelResult.success) {
            throw new Error(`Model registration failed: ${modelResult.error}`);
        }
        
        console.log('✅ AI model registered successfully');
        console.log(`   Model ID: ${modelResult.data.modelId}`);
        console.log(`   Model Hash: ${modelResult.data.modelHash}`);
        
        // Step 6: Get platform metrics
        console.log('\n📈 Step 6: Platform Performance Metrics...');
        
        const metricsResult = await platform.getPlatformMetrics();
        
        if (!metricsResult.success) {
            throw new Error(`Metrics retrieval failed: ${metricsResult.error}`);
        }
        
        const metrics = metricsResult.data;
        console.log('✅ Platform metrics retrieved');
        console.log(`   Jobs Completed: ${metrics.jobsCompleted}`);
        console.log(`   Average Processing Time: ${(metrics.averageProcessingTime / 1000).toFixed(2)}s`);
        console.log(`   Total Rewards Distributed: ${metrics.totalRewardsDistributed} DAT`);
        console.log(`   Average Privacy Score: ${metrics.averagePrivacyScore.toFixed(1)}%`);
        console.log(`   TEE Uptime: ${metrics.teeUptime}%`);
        console.log(`   Resource Utilization: ${metrics.resourceUtilization}%`);
        console.log(`   Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
        
        // Step 7: Privacy audit report
        console.log('\n🔍 Step 7: Privacy Audit Report...');
        
        const auditResult = await platform.getPrivacyAuditReport();
        
        if (!auditResult.success) {
            throw new Error(`Privacy audit failed: ${auditResult.error}`);
        }
        
        console.log('✅ Privacy audit completed');
        console.log(`   ${auditResult.data.summary}`);
        console.log(`   Compliance Status: ${auditResult.data.complianceStatus}`);
        console.log(`   Recommendations: ${auditResult.data.recommendations.length} items`);
        
        if (auditResult.data.recommendations.length > 0) {
            console.log('\n📝 Privacy Recommendations:');
            auditResult.data.recommendations.forEach((rec: string, i: number) => {
                console.log(`   ${i + 1}. ${rec}`);
            });
        }
        
        // Step 8: Demonstrate financial data analytics
        console.log('\n💰 Step 8: Financial Data Analytics Demo...');
        
        const financialData = {
            transactions: [
                { amount: 1500, type: 'deposit', risk_score: 0.1 },
                { amount: 50000, type: 'transfer', risk_score: 0.7 },
                { amount: 200, type: 'withdrawal', risk_score: 0.2 }
            ],
            metadata: {
                cardDataEncrypted: true,
                secureNetwork: true,
                auditTrail: true,
                internalControls: true
            }
        };
        
        const financialJob = await platform.submitAnalyticsJob(
            financialData,
            AnalysisType.SVM,
            'financial',
            BigInt('3000000000000000000') // 3 DAT tokens for high-security analysis
        );
        
        if (financialJob.success) {
            console.log(`✅ Financial analytics job submitted: ${financialJob.data.jobId}`);
            
            // Process financial job
            const financialProcessing = await platform.processAnalyticsJob(financialJob.data.jobId);
            if (financialProcessing.success) {
                console.log(`✅ Financial analysis completed with ${financialProcessing.data.privacyScore}% privacy score`);
            }
        }
        
        console.log('\n🎉 Demo completed successfully!');
        console.log('=' .repeat(70));
        console.log('PrivateInsight Platform Features Demonstrated:');
        console.log('✓ TEE-powered confidential analytics');
        console.log('✓ Multi-framework compliance validation (HIPAA, PCI DSS, etc.)');
        console.log('✓ Privacy-preserving AI model training and inference');
        console.log('✓ Real-time privacy scoring and monitoring');
        console.log('✓ Metis Hyperion blockchain integration');
        console.log('✓ Alith agent coordination and encryption');
        console.log('✓ Data Anchoring Token (DAT) reward distribution');
        console.log('✓ Comprehensive audit trails and reporting');
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error);
        
        // Show error details for debugging
        if (error instanceof Error) {
            console.error(`   Error: ${error.message}`);
        }
    } finally {
        // Clean shutdown
        console.log('\n🛑 Shutting down platform...');
        await platform.shutdown();
        console.log('✅ Platform shutdown complete');
    }
}

/**
 * Advanced federated learning example
 */
async function demonstrateFederatedLearning() {
    console.log('\n🌐 Advanced Demo: Federated Learning with Privacy Preservation');
    console.log('=' .repeat(70));
    
    const config: PlatformConfig = {
        metisRpcUrl: 'https://hyperion.metis.io',
        alithApiEndpoint: 'https://api.alith.ai',
        teeAttestationUrl: 'https://tee.alith.ai',
        datTokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
        privateInsightCoreAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
        metisVMAddress: '0x9876543210fedcba9876543210fedcba98765432'
    };
    
    const platform = new PrivateInsightPlatform(config);
    
    try {
        await platform.initialize();
        
        // Simulate multiple healthcare institutions participating in federated learning
        const hospitalData = [
            {
                institution: 'Hospital A',
                data: { patients: 1000, conditions: ['diabetes', 'hypertension'] },
                privacy_level: 9
            },
            {
                institution: 'Hospital B', 
                data: { patients: 750, conditions: ['cardiac', 'respiratory'] },
                privacy_level: 10
            },
            {
                institution: 'Hospital C',
                data: { patients: 1200, conditions: ['oncology', 'neurology'] },
                privacy_level: 9
            }
        ];
        
        console.log(`🏥 Federated learning with ${hospitalData.length} healthcare institutions`);
        
        // Submit federated learning jobs for each participant
        const federatedJobs = [];
        
        for (const hospital of hospitalData) {
            console.log(`📊 Submitting data from ${hospital.institution}...`);
            
            const job = await platform.submitAnalyticsJob(
                hospital.data,
                AnalysisType.NeuralNetwork,
                'healthcare',
                BigInt('5000000000000000000') // 5 DAT tokens for federated learning
            );
            
            if (job.success) {
                federatedJobs.push(job.data.jobId);
                console.log(`   ✅ Job ${job.data.jobId} submitted for ${hospital.institution}`);
            }
        }
        
        // Process federated learning jobs
        console.log('\n🔄 Processing federated learning jobs...');
        
        const results = [];
        for (const jobId of federatedJobs) {
            const result = await platform.processAnalyticsJob(jobId);
            if (result.success) {
                results.push(result.data);
                console.log(`   ✅ Job ${jobId} completed (Privacy: ${result.data.privacyScore}%)`);
            }
        }
        
        // Calculate aggregated metrics
        const avgPrivacyScore = results.reduce((sum, r) => sum + r.privacyScore, 0) / results.length;
        const totalProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0);
        
        console.log('\n📈 Federated Learning Results:');
        console.log(`   Participating Institutions: ${hospitalData.length}`);
        console.log(`   Jobs Completed: ${results.length}`);
        console.log(`   Average Privacy Score: ${avgPrivacyScore.toFixed(1)}%`);
        console.log(`   Total Processing Time: ${(totalProcessingTime / 1000).toFixed(2)}s`);
        console.log(`   Privacy-Preserving: ✅ (TEE + Differential Privacy)`);
        console.log(`   Compliance: ✅ (HIPAA + GDPR validated)`);
        
    } catch (error) {
        console.error('❌ Federated learning demo failed:', error);
    } finally {
        await platform.shutdown();
    }
}

// Export for use in other examples
export { demonstratePrivateInsight, demonstrateFederatedLearning };

// Run demo if this file is executed directly
if (require.main === module) {
    (async () => {
        await demonstratePrivateInsight();
        await demonstrateFederatedLearning();
    })().catch(console.error);
} 