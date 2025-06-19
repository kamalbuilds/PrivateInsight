/**
 * PrivateInsight AI Agents - Main Entry Point
 * TEE-powered privacy-preserving analytics platform for Metis Hyperion
 */

// Core clients
export { MetisClient } from './clients/MetisClient';
export { AlithAgent } from './clients/AlithClient';

// Privacy engine components
export { PrivacyCoordinator } from './privacy/PrivacyCoordinator';
export { ComplianceValidator } from './privacy/ComplianceValidator';
export { EncryptionManager } from './privacy/EncryptionManager';

// Analytics components
export { AnalyticsOrchestrator } from './analytics/AnalyticsOrchestrator';
export { MLModelManager } from './analytics/MLModelManager';
export { FederatedLearningCoordinator } from './analytics/FederatedLearningCoordinator';

// Coordination components
export { TaskCoordinator } from './coordination/TaskCoordinator';
export { ResourceManager } from './coordination/ResourceManager';
export { TEEValidator } from './coordination/TEEValidator';

// Types and interfaces
export * from './types';

// Main platform class
export { PrivateInsightPlatform } from './PrivateInsightPlatform';

// Default export
export { PrivateInsightPlatform as default } from './PrivateInsightPlatform'; 