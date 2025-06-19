/**
 * PrivateInsight Platform Types and Interfaces
 * Comprehensive type definitions for TEE-powered privacy-preserving analytics
 */

// Core platform types
export interface PlatformConfig {
    metisRpcUrl: string;
    alithApiEndpoint: string;
    teeAttestationUrl: string;
    datTokenAddress: string;
    privateInsightCoreAddress: string;
    metisVMAddress: string;
}

// Analytics job types
export interface AnalyticsJob {
    id: string;
    datasetHash: string;
    circuitHash: string;
    requester: string;
    timestamp: number;
    status: JobStatus;
    privacyBudget: number;
    result?: AnalyticsResult;
    proof?: ZKProof;
}

export interface AnalyticsResult {
    insights: Record<string, any>;
    metadata: {
        computationTime: number;
        privacySpent: number;
        accuracy: number;
        modelUsed: string;
    };
    visualizations?: Visualization[];
}

export interface Visualization {
    type: 'chart' | 'graph' | 'heatmap' | 'table';
    data: any;
    config: Record<string, any>;
}

export interface ZKProof {
    proof: string;
    publicInputs: string[];
    verificationKey: string;
    circuitHash: string;
}

export interface Dataset {
    hash: string;
    owner: string;
    schema: DataSchema;
    encryption: EncryptionInfo;
    privacyLevel: PrivacyLevel;
    metadata: DatasetMetadata;
}

export interface DataSchema {
    fields: FieldDefinition[];
    relationships?: Relationship[];
    constraints?: Constraint[];
}

export interface FieldDefinition {
    name: string;
    type: FieldType;
    nullable: boolean;
    sensitive: boolean;
    description?: string;
}

export interface EncryptionInfo {
    algorithm: string;
    keyHash: string;
    ivHash?: string;
    additionalData?: string;
}

export interface DatasetMetadata {
    name: string;
    description: string;
    size: number;
    created: number;
    updated: number;
    tags: string[];
    source: string;
}

export interface AlithModel {
    id: string;
    name: string;
    version: string;
    description: string;
    capabilities: ModelCapability[];
    endpoints: ModelEndpoint[];
    pricing: PricingInfo;
    metadata: ModelMetadata;
}

export interface ModelCapability {
    type: 'classification' | 'regression' | 'clustering' | 'anomaly_detection' | 'forecasting';
    inputTypes: string[];
    outputTypes: string[];
    privacyCompliant: boolean;
}

export interface ModelEndpoint {
    url: string;
    method: 'POST' | 'GET';
    headers: Record<string, string>;
    authentication: AuthInfo;
}

export interface AuthInfo {
    type: 'bearer' | 'api_key' | 'oauth2';
    credentials: Record<string, string>;
}

export interface PricingInfo {
    model: 'pay_per_use' | 'subscription' | 'tiered';
    costPerInference: number;
    currency: string;
    limits?: UsageLimits;
}

export interface UsageLimits {
    requestsPerMinute: number;
    requestsPerDay: number;
    maxDataSize: number;
}

export interface ModelMetadata {
    accuracy: number;
    latency: number;
    throughput: number;
    privacyScore: number;
    lastUpdated: number;
}

export interface PrivacyEngine {
    addNoise(data: any[], mechanism: NoiseMechanism, budget: number): Promise<any[]>;
    generateProof(computation: Computation, inputs: any[]): Promise<ZKProof>;
    verifyProof(proof: ZKProof): Promise<boolean>;
    checkPrivacyBudget(datasetHash: string): Promise<number>;
}

export interface Computation {
    circuit: string;
    inputs: ComputationInput[];
    outputs: ComputationOutput[];
    constraints: ComputationConstraint[];
}

export interface ComputationInput {
    name: string;
    type: string;
    source: string;
    preprocessing?: string[];
}

export interface ComputationOutput {
    name: string;
    type: string;
    postprocessing?: string[];
}

export interface ComputationConstraint {
    type: 'range' | 'sum' | 'count' | 'custom';
    parameters: Record<string, any>;
}

export interface BlockchainService {
    submitJob(job: AnalyticsJob): Promise<string>;
    getJob(jobId: string): Promise<AnalyticsJob>;
    submitProof(jobId: string, proof: ZKProof): Promise<boolean>;
    updateJobStatus(jobId: string, status: JobStatus): Promise<void>;
    getPrivacyBudget(datasetHash: string): Promise<number>;
}

export interface AlithService {
    authenticate(): Promise<string>;
    submitInference(modelId: string, data: any): Promise<InferenceResult>;
    getModelInfo(modelId: string): Promise<AlithModel>;
    listModels(): Promise<AlithModel[]>;
    streamInference(modelId: string, data: any): AsyncIterableIterator<InferenceChunk>;
}

export interface InferenceResult {
    id: string;
    result: any;
    confidence: number;
    latency: number;
    cost: number;
    metadata: Record<string, any>;
}

export interface InferenceChunk {
    id: string;
    chunk: any;
    isComplete: boolean;
    progress: number;
}

export interface AgentConfig {
    name: string;
    description: string;
    capabilities: string[];
    models: string[];
    maxConcurrentJobs: number;
    privacyLevel: PrivacyLevel;
    blockchain: BlockchainConfig;
    alith: AlithConfig;
}

export interface BlockchainConfig {
    rpcUrl: string;
    contractAddresses: ContractAddresses;
    privateKey: string;
    gasLimit: number;
    gasPrice: string;
}

export interface ContractAddresses {
    privateInsightCore: string;
    zkVerifier: string;
    dataVault: string;
    alithAgent: string;
}

export interface AlithConfig {
    apiKey: string;
    endpoint: string;
    models: AlithModelConfig[];
    timeout: number;
    retryAttempts: number;
}

export interface AlithModelConfig {
    id: string;
    name: string;
    endpoint: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
}

// Enums
export enum JobStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
    VERIFIED = 'verified'
}

export enum PrivacyLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    MAXIMUM = 'maximum'
}

export enum FieldType {
    STRING = 'string',
    NUMBER = 'number',
    BOOLEAN = 'boolean',
    DATE = 'date',
    ARRAY = 'array',
    OBJECT = 'object'
}

export enum NoiseMechanism {
    LAPLACE = 'laplace',
    GAUSSIAN = 'gaussian',
    EXPONENTIAL = 'exponential'
}

export interface Relationship {
    type: 'one_to_one' | 'one_to_many' | 'many_to_many';
    fromField: string;
    toField: string;
    description?: string;
}

export interface Constraint {
    type: 'unique' | 'not_null' | 'check' | 'foreign_key';
    fields: string[];
    parameters?: Record<string, any>;
}

export interface AIAgent {
    id: string;
    config: AgentConfig;
    start(): Promise<void>;
    stop(): Promise<void>;
    processJob(job: AnalyticsJob): Promise<AnalyticsResult>;
    getStatus(): AgentStatus;
}

export interface AgentStatus {
    id: string;
    status: 'idle' | 'busy' | 'error' | 'stopped';
    currentJobs: string[];
    totalProcessed: number;
    errors: number;
    uptime: number;
    lastActivity: number;
}

export interface PlatformMetrics {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    activeAgents: number;
    averageLatency: number;
    privacyBudgetUsed: number;
    privacyBudgetRemaining: number;
}

// TEE and security types
export interface TEEAttestation {
    attestationHash: string;
    enclaveId: string;
    securityLevel: number;
    timestamp: number;
    dataHash: string;
    computationType: string;
    signature: string;
    isValid: boolean;
    validator: string;
}

export interface SecurityMetrics {
    encryptionStrength: number;
    teeVerificationLevel: number;
    dataLeakageRisk: number;
    complianceScore: number;
    anonymityLevel: number;
    integrityScore: number;
}

// Privacy and compliance types
export enum EncryptionMethod {
    RSA2048 = 'RSA2048',
    RSA4096 = 'RSA4096',
    AES256 = 'AES256',
    ChaCha20 = 'ChaCha20',
    ECDH = 'ECDH',
    Hybrid = 'Hybrid'
}

export enum ComplianceFramework {
    GDPR = 'GDPR',
    CCPA = 'CCPA',
    HIPAA = 'HIPAA',
    SOX = 'SOX',
    PCI_DSS = 'PCI_DSS',
    ISO27001 = 'ISO27001'
}

export interface ComplianceResult {
    framework: ComplianceFramework;
    isCompliant: boolean;
    score: number;
    violations: string[];
    recommendations: string[];
    validatedAt: number;
}

export interface PrivacyConfig {
    encryptionMethod: EncryptionMethod;
    privacyLevel: number;
    teeRequired: boolean;
    complianceFrameworks: ComplianceFramework[];
    privacyBudget: number;
}

// AI Model types
export interface AIModel {
    modelId: bigint;
    modelType: string;
    modelHash: string;
    provider: string;
    accuracy: number;
    privacyLevel: number;
    isActive: boolean;
    createdAt: number;
    metadata: ModelMetadata;
}

export interface ModelMetadata {
    description: string;
    inputShape: number[];
    outputShape: number[];
    trainingDatasetSize: number;
    validationAccuracy: number;
    privacyTechniques: string[];
}

// Federated learning types
export interface FederatedLearningConfig {
    participantCount: number;
    maxRounds: number;
    convergenceThreshold: number;
    aggregationMethod: string;
    privacyBudget: number;
    localEpochs: number;
}

export interface FederatedParticipant {
    participantId: string;
    datasetSize: number;
    localAccuracy: number;
    contributionWeight: number;
    privacyScore: number;
}

export interface GlobalModel {
    modelHash: string;
    round: number;
    accuracy: number;
    participantCount: number;
    convergenceScore: number;
    privacyPreservation: number;
}

// Task coordination types
export interface TaskRequest {
    taskId: string;
    type: TaskType;
    priority: TaskPriority;
    requester: string;
    payload: any;
    deadline: number;
    resourceRequirements: ResourceRequirements;
}

export enum TaskType {
    DataAnalysis = 'data_analysis',
    ModelTraining = 'model_training',
    FederatedLearning = 'federated_learning',
    PrivacyAudit = 'privacy_audit',
    ComplianceValidation = 'compliance_validation',
    ZKProofGeneration = 'zk_proof_generation'
}

export enum TaskPriority {
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4
}

export interface ResourceRequirements {
    cpuCores: number;
    memoryGB: number;
    diskSpaceGB: number;
    gpuRequired: boolean;
    teeRequired: boolean;
    estimatedDurationMinutes: number;
}

// Resource management types
export interface ComputeResource {
    resourceId: string;
    type: ResourceType;
    status: ResourceStatus;
    capabilities: ResourceCapabilities;
    currentLoad: number;
    location: string;
    cost: number;
}

export enum ResourceType {
    CPU = 'cpu',
    GPU = 'gpu',
    TEE = 'tee',
    Storage = 'storage',
    Network = 'network'
}

export enum ResourceStatus {
    Available = 'available',
    Busy = 'busy',
    Maintenance = 'maintenance',
    Offline = 'offline'
}

export interface ResourceCapabilities {
    maxCpuCores: number;
    maxMemoryGB: number;
    maxDiskSpaceGB: number;
    hasGpu: boolean;
    hasTee: boolean;
    teeSecurityLevel: number;
    networkBandwidthMbps: number;
}

// Event types
export interface PlatformEvent {
    eventId: string;
    type: EventType;
    timestamp: number;
    source: string;
    data: any;
    severity: EventSeverity;
}

export enum EventType {
    JobCreated = 'job_created',
    JobCompleted = 'job_completed',
    TEEAttestationGenerated = 'tee_attestation_generated',
    ModelRegistered = 'model_registered',
    ComplianceViolation = 'compliance_violation',
    ResourceAllocated = 'resource_allocated',
    ZKProofGenerated = 'zk_proof_generated'
}

export enum EventSeverity {
    Info = 'info',
    Warning = 'warning',
    Error = 'error',
    Critical = 'critical'
}

// API response types
export interface APIResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    timestamp: number;
    requestId: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
    pagination: {
        page: number;
        limit: number;
        total: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Configuration and initialization types
export enum AgentType {
    AnalyticsAgent = 'analytics_agent',
    PrivacyAuditor = 'privacy_auditor',
    FederatedLearner = 'federated_learner',
    DataClassifier = 'data_classifier',
    InsightGenerator = 'insight_generator',
    ComplianceValidator = 'compliance_validator'
}

// Performance and monitoring types
export interface PerformanceMetrics {
    jobsCompleted: number;
    averageProcessingTime: number;
    totalRewardsDistributed: string;
    averagePrivacyScore: number;
    teeUptime: number;
    resourceUtilization: number;
    errorRate: number;
}

export interface MonitoringAlert {
    alertId: string;
    type: AlertType;
    severity: EventSeverity;
    message: string;
    timestamp: number;
    acknowledged: boolean;
    resolvedAt?: number;
}

export enum AlertType {
    HighResourceUsage = 'high_resource_usage',
    TEEFailure = 'tee_failure',
    ComplianceViolation = 'compliance_violation',
    SecurityBreach = 'security_breach',
    ModelAccuracyDrop = 'model_accuracy_drop',
    PrivacyBudgetExceeded = 'privacy_budget_exceeded'
} 