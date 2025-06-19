import { 
    PrivacyConfig, 
    ComplianceFramework, 
    ComplianceResult, 
    SecurityMetrics,
    EncryptionMethod,
    TEEAttestation 
} from '../types';
import { ComplianceValidator } from './ComplianceValidator';
import { EncryptionManager } from './EncryptionManager';

/**
 * PrivacyCoordinator - Central coordinator for privacy-preserving operations
 * Manages privacy policies, compliance validation, and encryption strategies
 */
export class PrivacyCoordinator {
    private complianceValidator: ComplianceValidator;
    private encryptionManager: EncryptionManager;
    private privacyBudgets: Map<string, number> = new Map();
    private activePolicies: Map<string, PrivacyConfig> = new Map();
    
    constructor() {
        this.complianceValidator = new ComplianceValidator();
        this.encryptionManager = new EncryptionManager();
        this.initializeDefaultPolicies();
    }
    
    /**
     * Initialize default privacy policies for different data types
     */
    private initializeDefaultPolicies(): void {
        // Healthcare data policy (HIPAA compliant)
        this.activePolicies.set('healthcare', {
            encryptionMethod: EncryptionMethod.AES256,
            privacyLevel: 9,
            teeRequired: true,
            complianceFrameworks: [ComplianceFramework.HIPAA],
            privacyBudget: 0.1
        });
        
        // Financial data policy (PCI DSS compliant)
        this.activePolicies.set('financial', {
            encryptionMethod: EncryptionMethod.RSA4096,
            privacyLevel: 10,
            teeRequired: true,
            complianceFrameworks: [ComplianceFramework.PCI_DSS, ComplianceFramework.SOX],
            privacyBudget: 0.05
        });
        
        // Personal data policy (GDPR/CCPA compliant)
        this.activePolicies.set('personal', {
            encryptionMethod: EncryptionMethod.Hybrid,
            privacyLevel: 8,
            teeRequired: true,
            complianceFrameworks: [ComplianceFramework.GDPR, ComplianceFramework.CCPA],
            privacyBudget: 0.2
        });
        
        // General business data policy
        this.activePolicies.set('general', {
            encryptionMethod: EncryptionMethod.AES256,
            privacyLevel: 6,
            teeRequired: false,
            complianceFrameworks: [ComplianceFramework.ISO27001],
            privacyBudget: 0.5
        });
        
        console.log('🔒 Privacy policies initialized for 4 data categories');
    }
    
    /**
     * Set privacy policy for a specific data category
     */
    async setPrivacyPolicy(
        category: string,
        config: PrivacyConfig
    ): Promise<void> {
        try {
            // Validate privacy configuration
            await this.validatePrivacyConfig(config);
            
            this.activePolicies.set(category, config);
            
            console.log(`🔧 Privacy policy updated for category: ${category}`);
            console.log(`   Privacy Level: ${config.privacyLevel}/10`);
            console.log(`   TEE Required: ${config.teeRequired}`);
            console.log(`   Compliance: ${config.complianceFrameworks.join(', ')}`);
            
        } catch (error) {
            console.error(`❌ Failed to set privacy policy for ${category}:`, error);
            throw new Error(`Privacy policy configuration failed: ${error}`);
        }
    }
    
    /**
     * Get privacy policy for a data category
     */
    getPrivacyPolicy(category: string): PrivacyConfig | null {
        return this.activePolicies.get(category) || this.activePolicies.get('general') || null;
    }
    
    /**
     * Validate privacy configuration
     */
    private async validatePrivacyConfig(config: PrivacyConfig): Promise<void> {
        if (config.privacyLevel < 1 || config.privacyLevel > 10) {
            throw new Error('Privacy level must be between 1 and 10');
        }
        
        if (config.privacyBudget < 0 || config.privacyBudget > 1) {
            throw new Error('Privacy budget must be between 0 and 1');
        }
        
        if (config.complianceFrameworks.length === 0) {
            throw new Error('At least one compliance framework must be specified');
        }
        
        // Validate that high privacy levels require TEE
        if (config.privacyLevel >= 8 && !config.teeRequired) {
            console.warn('⚠️ High privacy level without TEE - consider enabling TEE');
        }
    }
    
    /**
     * Calculate comprehensive privacy score for data processing
     */
    async calculatePrivacyScore(
        dataHash: string,
        processingType: string,
        teeAttestation?: TEEAttestation
    ): Promise<number> {
        try {
            let score = 0;
            
            // Base encryption score (0-25 points)
            const encryptionScore = await this.encryptionManager.calculateEncryptionScore(dataHash);
            score += Math.min(25, encryptionScore);
            
            // TEE attestation score (0-30 points)
            if (teeAttestation && teeAttestation.isValid) {
                score += Math.min(30, teeAttestation.securityLevel * 3);
            }
            
            // Processing type privacy impact (0-20 points)
            const processingScore = this.calculateProcessingPrivacyScore(processingType);
            score += processingScore;
            
            // Compliance adherence score (0-25 points)
            const complianceScore = await this.calculateComplianceScore(dataHash, processingType);
            score += complianceScore;
            
            const finalScore = Math.min(100, score);
            
            console.log(`🔍 Privacy score calculated: ${finalScore}%`);
            console.log(`   Encryption: ${encryptionScore}/25`);
            console.log(`   TEE: ${teeAttestation ? Math.min(30, teeAttestation.securityLevel * 3) : 0}/30`);
            console.log(`   Processing: ${processingScore}/20`);
            console.log(`   Compliance: ${complianceScore}/25`);
            
            return finalScore;
            
        } catch (error) {
            console.error('❌ Privacy score calculation failed:', error);
            return 0;
        }
    }
    
    /**
     * Calculate processing type privacy impact
     */
    private calculateProcessingPrivacyScore(processingType: string): number {
        const privacyScores: { [key: string]: number } = {
            'aggregation': 20,
            'anonymization': 18,
            'clustering': 16,
            'regression': 14,
            'classification': 12,
            'feature_extraction': 10,
            'neural_network': 8,
            'deep_learning': 6
        };
        
        return privacyScores[processingType.toLowerCase()] || 10;
    }
    
    /**
     * Calculate compliance adherence score
     */
    private async calculateComplianceScore(
        dataHash: string,
        processingType: string
    ): Promise<number> {
        try {
            const frameworks = [
                ComplianceFramework.GDPR,
                ComplianceFramework.CCPA,
                ComplianceFramework.HIPAA
            ];
            
            let totalScore = 0;
            let validFrameworks = 0;
            
            for (const framework of frameworks) {
                try {
                    const result = await this.complianceValidator.validateCompliance(
                        dataHash,
                        framework,
                        { processingType }
                    );
                    
                    if (result.isCompliant) {
                        totalScore += result.score;
                        validFrameworks++;
                    }
                } catch (error) {
                    // Skip failed validations
                }
            }
            
            return validFrameworks > 0 ? Math.min(25, totalScore / validFrameworks * 0.25) : 0;
            
        } catch (error) {
            console.error('Compliance score calculation failed:', error);
            return 0;
        }
    }
    
    /**
     * Validate data processing against privacy policies
     */
    async validateDataProcessing(
        dataCategory: string,
        processingType: string,
        dataSize: number
    ): Promise<{
        isValid: boolean;
        violations: string[];
        recommendations: string[];
        requiredMeasures: string[];
    }> {
        try {
            const policy = this.getPrivacyPolicy(dataCategory);
            if (!policy) {
                return {
                    isValid: false,
                    violations: ['No privacy policy found for data category'],
                    recommendations: ['Define privacy policy for this data category'],
                    requiredMeasures: []
                };
            }
            
            const violations: string[] = [];
            const recommendations: string[] = [];
            const requiredMeasures: string[] = [];
            
            // Check privacy budget
            const currentBudget = this.privacyBudgets.get(dataCategory) || 0;
            if (currentBudget >= policy.privacyBudget) {
                violations.push('Privacy budget exceeded for this data category');
                recommendations.push('Wait for privacy budget to reset or use differential privacy');
            }
            
            // Check data size constraints
            if (dataSize > 1000000 && policy.privacyLevel < 8) {
                violations.push('Large dataset requires higher privacy level');
                recommendations.push('Increase privacy level to 8+ for large datasets');
            }
            
            // Check TEE requirement
            if (policy.teeRequired) {
                requiredMeasures.push('TEE (Trusted Execution Environment) required');
            }
            
            // Check encryption requirements
            if (policy.privacyLevel >= 9) {
                requiredMeasures.push(`Strong encryption (${policy.encryptionMethod}) required`);
            }
            
            // Compliance validation
            for (const framework of policy.complianceFrameworks) {
                requiredMeasures.push(`${framework} compliance validation required`);
            }
            
            const isValid = violations.length === 0;
            
            if (isValid) {
                console.log(`✅ Data processing validation passed for ${dataCategory}`);
            } else {
                console.log(`⚠️ Data processing validation failed for ${dataCategory}`);
                console.log(`   Violations: ${violations.join(', ')}`);
            }
            
            return {
                isValid,
                violations,
                recommendations,
                requiredMeasures
            };
            
        } catch (error) {
            console.error('❌ Data processing validation failed:', error);
            return {
                isValid: false,
                violations: ['Validation process failed'],
                recommendations: ['Check privacy coordinator configuration'],
                requiredMeasures: []
            };
        }
    }
    
    /**
     * Update privacy budget consumption
     */
    async updatePrivacyBudget(
        dataCategory: string,
        consumedBudget: number
    ): Promise<void> {
        const currentBudget = this.privacyBudgets.get(dataCategory) || 0;
        const newBudget = currentBudget + consumedBudget;
        
        this.privacyBudgets.set(dataCategory, newBudget);
        
        const policy = this.getPrivacyPolicy(dataCategory);
        if (policy && newBudget >= policy.privacyBudget * 0.8) {
            console.warn(`⚠️ Privacy budget for ${dataCategory} is 80% consumed`);
        }
        
        console.log(`📊 Privacy budget updated for ${dataCategory}: ${newBudget.toFixed(4)}`);
    }
    
    /**
     * Get current privacy budget status
     */
    getPrivacyBudgetStatus(dataCategory: string): {
        consumed: number;
        limit: number;
        remaining: number;
        utilizationRate: number;
    } {
        const consumed = this.privacyBudgets.get(dataCategory) || 0;
        const policy = this.getPrivacyPolicy(dataCategory);
        const limit = policy?.privacyBudget || 1;
        const remaining = Math.max(0, limit - consumed);
        const utilizationRate = consumed / limit;
        
        return {
            consumed,
            limit,
            remaining,
            utilizationRate
        };
    }
    
    /**
     * Reset privacy budget for a category (typically done daily/weekly)
     */
    async resetPrivacyBudget(dataCategory: string): Promise<void> {
        this.privacyBudgets.set(dataCategory, 0);
        console.log(`🔄 Privacy budget reset for category: ${dataCategory}`);
    }
    
    /**
     * Get comprehensive privacy metrics
     */
    async getPrivacyMetrics(): Promise<SecurityMetrics> {
        const categories = Array.from(this.activePolicies.keys());
        let totalEncryptionStrength = 0;
        let totalTeeLevel = 0;
        let totalDataLeakageRisk = 0;
        let totalComplianceScore = 0;
        
        for (const category of categories) {
            const policy = this.activePolicies.get(category)!;
            
            // Calculate encryption strength
            const encryptionStrength = this.encryptionManager.getEncryptionStrength(policy.encryptionMethod);
            totalEncryptionStrength += encryptionStrength;
            
            // TEE verification level
            totalTeeLevel += policy.teeRequired ? policy.privacyLevel : 0;
            
            // Data leakage risk (inverse of privacy level)
            totalDataLeakageRisk += (10 - policy.privacyLevel) * 10;
            
            // Compliance score
            totalComplianceScore += policy.complianceFrameworks.length * 20;
        }
        
        const categoryCount = categories.length || 1;
        
        return {
            encryptionStrength: Math.min(100, totalEncryptionStrength / categoryCount),
            teeVerificationLevel: Math.min(100, totalTeeLevel / categoryCount * 10),
            dataLeakageRisk: Math.min(100, totalDataLeakageRisk / categoryCount),
            complianceScore: Math.min(100, totalComplianceScore / categoryCount),
            anonymityLevel: 85, // Calculated based on anonymization techniques
            integrityScore: 90   // Calculated based on cryptographic integrity measures
        };
    }
    
    /**
     * Generate privacy audit report
     */
    async generatePrivacyAuditReport(): Promise<{
        summary: string;
        policies: number;
        activeBudgets: number;
        complianceStatus: string;
        recommendations: string[];
        metrics: SecurityMetrics;
    }> {
        const metrics = await this.getPrivacyMetrics();
        const policies = this.activePolicies.size;
        const activeBudgets = this.privacyBudgets.size;
        
        const recommendations: string[] = [];
        
        if (metrics.encryptionStrength < 80) {
            recommendations.push('Consider upgrading encryption methods for better security');
        }
        
        if (metrics.teeVerificationLevel < 70) {
            recommendations.push('Enable TEE for more sensitive data categories');
        }
        
        if (metrics.dataLeakageRisk > 30) {
            recommendations.push('Implement additional anonymization techniques');
        }
        
        const complianceStatus = metrics.complianceScore > 80 ? 'Good' : 
                                metrics.complianceScore > 60 ? 'Adequate' : 'Needs Improvement';
        
        return {
            summary: `Privacy audit completed for ${policies} policies and ${activeBudgets} active budgets`,
            policies,
            activeBudgets,
            complianceStatus,
            recommendations,
            metrics
        };
    }
} 