import { ComplianceFramework, ComplianceResult } from '../types';

/**
 * ComplianceValidator - Validates data processing against regulatory frameworks
 * Supports GDPR, CCPA, HIPAA, SOX, PCI DSS, and ISO27001 compliance
 */
export class ComplianceValidator {
    private complianceRules: Map<ComplianceFramework, ComplianceRule[]> = new Map();
    
    constructor() {
        this.initializeComplianceRules();
    }
    
    /**
     * Initialize compliance rules for each regulatory framework
     */
    private initializeComplianceRules(): void {
        // GDPR compliance rules
        this.complianceRules.set(ComplianceFramework.GDPR, [
            {
                id: 'gdpr_consent',
                description: 'Data processing requires explicit consent',
                check: (metadata: any) => metadata.hasConsent === true,
                severity: 'critical',
                penalty: 'Up to 4% of annual revenue or €20M'
            },
            {
                id: 'gdpr_anonymization',
                description: 'Personal data must be anonymized when possible',
                check: (metadata: any) => metadata.isAnonymized === true || metadata.pseudonymized === true,
                severity: 'high',
                penalty: 'Up to 2% of annual revenue or €10M'
            },
            {
                id: 'gdpr_purpose_limitation',
                description: 'Data processing must be for specified purposes only',
                check: (metadata: any) => metadata.purpose && metadata.purpose.length > 0,
                severity: 'high',
                penalty: 'Administrative fine'
            },
            {
                id: 'gdpr_data_minimization',
                description: 'Only necessary data should be processed',
                check: (metadata: any) => metadata.dataMinimized === true,
                severity: 'medium',
                penalty: 'Warning or fine'
            }
        ]);
        
        // CCPA compliance rules
        this.complianceRules.set(ComplianceFramework.CCPA, [
            {
                id: 'ccpa_notice',
                description: 'Consumers must be notified of data collection',
                check: (metadata: any) => metadata.hasNotice === true,
                severity: 'critical',
                penalty: 'Up to $7,500 per violation'
            },
            {
                id: 'ccpa_opt_out',
                description: 'Consumers must have opt-out rights',
                check: (metadata: any) => metadata.optOutAvailable === true,
                severity: 'high',
                penalty: 'Up to $2,500 per violation'
            },
            {
                id: 'ccpa_deletion',
                description: 'Data deletion mechanisms must be available',
                check: (metadata: any) => metadata.deletionMechanism === true,
                severity: 'medium',
                penalty: 'Civil penalty'
            }
        ]);
        
        // HIPAA compliance rules
        this.complianceRules.set(ComplianceFramework.HIPAA, [
            {
                id: 'hipaa_encryption',
                description: 'PHI must be encrypted in transit and at rest',
                check: (metadata: any) => metadata.encryptionInTransit === true && metadata.encryptionAtRest === true,
                severity: 'critical',
                penalty: 'Up to $1.5M per violation'
            },
            {
                id: 'hipaa_access_control',
                description: 'Access to PHI must be controlled and logged',
                check: (metadata: any) => metadata.accessControl === true && metadata.auditLogging === true,
                severity: 'critical',
                penalty: 'Criminal charges possible'
            },
            {
                id: 'hipaa_minimum_necessary',
                description: 'Only minimum necessary PHI should be accessed',
                check: (metadata: any) => metadata.minimumNecessary === true,
                severity: 'high',
                penalty: 'Civil monetary penalty'
            }
        ]);
        
        // SOX compliance rules
        this.complianceRules.set(ComplianceFramework.SOX, [
            {
                id: 'sox_audit_trail',
                description: 'Financial data processing must have audit trails',
                check: (metadata: any) => metadata.auditTrail === true,
                severity: 'critical',
                penalty: 'Criminal penalties up to 20 years'
            },
            {
                id: 'sox_internal_controls',
                description: 'Internal controls must be documented and tested',
                check: (metadata: any) => metadata.internalControls === true,
                severity: 'high',
                penalty: 'Civil and criminal penalties'
            }
        ]);
        
        // PCI DSS compliance rules
        this.complianceRules.set(ComplianceFramework.PCI_DSS, [
            {
                id: 'pci_encryption',
                description: 'Payment card data must be encrypted',
                check: (metadata: any) => metadata.cardDataEncrypted === true,
                severity: 'critical',
                penalty: 'Fines up to $100,000 per month'
            },
            {
                id: 'pci_network_security',
                description: 'Secure network architecture required',
                check: (metadata: any) => metadata.secureNetwork === true,
                severity: 'high',
                penalty: 'Card brand penalties'
            }
        ]);
        
        // ISO27001 compliance rules
        this.complianceRules.set(ComplianceFramework.ISO27001, [
            {
                id: 'iso_risk_assessment',
                description: 'Information security risk assessment required',
                check: (metadata: any) => metadata.riskAssessment === true,
                severity: 'medium',
                penalty: 'Certification loss'
            },
            {
                id: 'iso_security_controls',
                description: 'Appropriate security controls must be implemented',
                check: (metadata: any) => metadata.securityControls === true,
                severity: 'medium',
                penalty: 'Audit findings'
            }
        ]);
        
        console.log(`📋 Compliance rules initialized for ${this.complianceRules.size} frameworks`);
    }
    
    /**
     * Validate data processing against a specific compliance framework
     */
    async validateCompliance(
        dataHash: string,
        framework: ComplianceFramework,
        metadata: any
    ): Promise<ComplianceResult> {
        try {
            console.log(`🔍 Validating ${framework} compliance for data: ${dataHash.substring(0, 8)}...`);
            
            const rules = this.complianceRules.get(framework);
            if (!rules) {
                throw new Error(`No compliance rules found for framework: ${framework}`);
            }
            
            const violations: string[] = [];
            const recommendations: string[] = [];
            let totalScore = 0;
            let criticalViolations = 0;
            let highViolations = 0;
            
            // Evaluate each compliance rule
            for (const rule of rules) {
                const isCompliant = rule.check(metadata);
                
                if (isCompliant) {
                    // Award points based on rule severity
                    switch (rule.severity) {
                        case 'critical':
                            totalScore += 30;
                            break;
                        case 'high':
                            totalScore += 20;
                            break;
                        case 'medium':
                            totalScore += 15;
                            break;
                        default:
                            totalScore += 10;
                    }
                } else {
                    violations.push(`${rule.id}: ${rule.description}`);
                    recommendations.push(`Fix: ${rule.description} (Penalty: ${rule.penalty})`);
                    
                    if (rule.severity === 'critical') {
                        criticalViolations++;
                    } else if (rule.severity === 'high') {
                        highViolations++;
                    }
                }
            }
            
            // Calculate final compliance score
            const maxPossibleScore = rules.length * 30; // Assuming all rules are critical
            const score = Math.min(100, (totalScore / maxPossibleScore) * 100);
            
            // Determine overall compliance status
            const isCompliant = criticalViolations === 0 && highViolations <= 1;
            
            // Add framework-specific recommendations
            this.addFrameworkSpecificRecommendations(framework, metadata, recommendations);
            
            const result: ComplianceResult = {
                framework,
                isCompliant,
                score: Math.round(score),
                violations,
                recommendations,
                validatedAt: Date.now()
            };
            
            if (isCompliant) {
                console.log(`✅ ${framework} compliance validation passed (Score: ${result.score}%)`);
            } else {
                console.log(`❌ ${framework} compliance validation failed (Score: ${result.score}%)`);
                console.log(`   Critical violations: ${criticalViolations}`);
                console.log(`   High violations: ${highViolations}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ ${framework} compliance validation error:`, error);
            return {
                framework,
                isCompliant: false,
                score: 0,
                violations: [`Validation error: ${error}`],
                recommendations: ['Fix validation process configuration'],
                validatedAt: Date.now()
            };
        }
    }
    
    /**
     * Add framework-specific recommendations
     */
    private addFrameworkSpecificRecommendations(
        framework: ComplianceFramework,
        metadata: any,
        recommendations: string[]
    ): void {
        switch (framework) {
            case ComplianceFramework.GDPR:
                if (!metadata.dataProtectionOfficer) {
                    recommendations.push('Consider appointing a Data Protection Officer (DPO)');
                }
                if (!metadata.privacyByDesign) {
                    recommendations.push('Implement privacy-by-design principles');
                }
                break;
                
            case ComplianceFramework.CCPA:
                if (!metadata.privacyPolicy) {
                    recommendations.push('Update privacy policy to include CCPA requirements');
                }
                break;
                
            case ComplianceFramework.HIPAA:
                if (!metadata.businessAssociateAgreement) {
                    recommendations.push('Ensure Business Associate Agreements are in place');
                }
                if (!metadata.riskAssessment) {
                    recommendations.push('Conduct regular HIPAA risk assessments');
                }
                break;
                
            case ComplianceFramework.SOX:
                if (!metadata.segregationOfDuties) {
                    recommendations.push('Implement segregation of duties for financial controls');
                }
                break;
                
            case ComplianceFramework.PCI_DSS:
                if (!metadata.vulnerabilityScanning) {
                    recommendations.push('Implement regular vulnerability scanning');
                }
                if (!metadata.penetrationTesting) {
                    recommendations.push('Conduct annual penetration testing');
                }
                break;
                
            case ComplianceFramework.ISO27001:
                if (!metadata.informationSecurityPolicy) {
                    recommendations.push('Develop comprehensive information security policy');
                }
                if (!metadata.incidentResponsePlan) {
                    recommendations.push('Create incident response procedures');
                }
                break;
        }
    }
    
    /**
     * Validate multiple compliance frameworks simultaneously
     */
    async validateMultipleFrameworks(
        dataHash: string,
        frameworks: ComplianceFramework[],
        metadata: any
    ): Promise<ComplianceResult[]> {
        const results: ComplianceResult[] = [];
        
        for (const framework of frameworks) {
            try {
                const result = await this.validateCompliance(dataHash, framework, metadata);
                results.push(result);
            } catch (error) {
                console.error(`Failed to validate ${framework}:`, error);
                results.push({
                    framework,
                    isCompliant: false,
                    score: 0,
                    violations: [`Validation failed: ${error}`],
                    recommendations: [],
                    validatedAt: Date.now()
                });
            }
        }
        
        return results;
    }
    
    /**
     * Get compliance recommendations for a specific framework
     */
    getComplianceRequirements(framework: ComplianceFramework): {
        requirements: string[];
        penalties: string[];
        bestPractices: string[];
    } {
        const rules = this.complianceRules.get(framework) || [];
        
        const requirements = rules.map(rule => rule.description);
        const penalties = rules.map(rule => rule.penalty);
        
        const bestPractices: { [key in ComplianceFramework]: string[] } = {
            [ComplianceFramework.GDPR]: [
                'Implement privacy by design',
                'Conduct Data Protection Impact Assessments (DPIA)',
                'Maintain records of processing activities',
                'Ensure data portability mechanisms'
            ],
            [ComplianceFramework.CCPA]: [
                'Provide clear privacy notices',
                'Implement data deletion procedures',
                'Train staff on CCPA requirements',
                'Monitor third-party processors'
            ],
            [ComplianceFramework.HIPAA]: [
                'Conduct regular security risk assessments',
                'Implement workforce training programs',
                'Maintain business associate agreements',
                'Establish incident response procedures'
            ],
            [ComplianceFramework.SOX]: [
                'Document all financial processes',
                'Implement change management controls',
                'Conduct regular internal audits',
                'Maintain segregation of duties'
            ],
            [ComplianceFramework.PCI_DSS]: [
                'Regularly update security systems',
                'Implement network segmentation',
                'Conduct quarterly vulnerability scans',
                'Maintain secure coding practices'
            ],
            [ComplianceFramework.ISO27001]: [
                'Establish information security management system',
                'Conduct regular risk assessments',
                'Implement security awareness training',
                'Maintain business continuity plans'
            ]
        };
        
        return {
            requirements,
            penalties,
            bestPractices: bestPractices[framework] || []
        };
    }
    
    /**
     * Generate comprehensive compliance report
     */
    async generateComplianceReport(
        dataHash: string,
        frameworks: ComplianceFramework[],
        metadata: any
    ): Promise<{
        summary: string;
        overallCompliance: boolean;
        averageScore: number;
        results: ComplianceResult[];
        criticalIssues: string[];
        recommendations: string[];
    }> {
        const results = await this.validateMultipleFrameworks(dataHash, frameworks, metadata);
        
        const compliantFrameworks = results.filter(r => r.isCompliant).length;
        const overallCompliance = compliantFrameworks === frameworks.length;
        const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        
        const criticalIssues: string[] = [];
        const allRecommendations: string[] = [];
        
        results.forEach(result => {
            result.violations.forEach(violation => {
                if (violation.includes('critical') || violation.includes('encryption') || violation.includes('consent')) {
                    criticalIssues.push(`${result.framework}: ${violation}`);
                }
            });
            allRecommendations.push(...result.recommendations);
        });
        
        // Remove duplicate recommendations
        const uniqueRecommendations = [...new Set(allRecommendations)];
        
        return {
            summary: `Compliance validation completed for ${frameworks.length} frameworks. ${compliantFrameworks}/${frameworks.length} frameworks compliant.`,
            overallCompliance,
            averageScore: Math.round(averageScore),
            results,
            criticalIssues,
            recommendations: uniqueRecommendations
        };
    }
}

// Supporting interfaces
interface ComplianceRule {
    id: string;
    description: string;
    check: (metadata: any) => boolean;
    severity: 'critical' | 'high' | 'medium' | 'low';
    penalty: string;
} 