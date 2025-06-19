import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  AlithService as IAlithService,
  AlithModel,
  InferenceResult,
  InferenceChunk,
  AlithConfig,
  AlithModelConfig 
} from '../types/index.js';
import { Logger } from '../utils/Logger.js';

export class AlithService extends EventEmitter implements IAlithService {
  private client: AxiosInstance;
  private logger: Logger;
  private config: AlithConfig;
  private authToken?: string;
  private tokenExpiry?: number;

  constructor(config: AlithConfig) {
    super();
    this.config = config;
    this.logger = new Logger('AlithService');

    this.client = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PrivateInsight-Agent/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add authentication
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.authToken || this.isTokenExpired()) {
          await this.authenticate();
        }
        
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          this.logger.warn('Authentication expired, retrying...');
          this.authToken = undefined;
          this.tokenExpiry = undefined;
          
          // Retry the original request
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.authenticate();
            originalRequest.headers.Authorization = `Bearer ${this.authToken}`;
            return this.client(originalRequest);
          }
        }
        
        this.logger.error('API request failed:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  async authenticate(): Promise<string> {
    try {
      this.logger.info('Authenticating with Alith API...');
      
      const response = await axios.post(`${this.config.endpoint}/auth/token`, {
        apiKey: this.config.apiKey,
        clientId: 'privateinsight-platform',
        scope: 'inference models'
      });

      const { token, expiresIn } = response.data;
      this.authToken = token;
      this.tokenExpiry = Date.now() + (expiresIn * 1000);

      this.logger.info('Successfully authenticated with Alith API');
      this.emit('authenticated', { token, expiresIn });

      return token;
    } catch (error: any) {
      this.logger.error('Authentication failed:', error.response?.data || error.message);
      throw new Error(`Alith authentication failed: ${error.message}`);
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiry) return true;
    return Date.now() >= this.tokenExpiry - 60000; // Refresh 1 minute before expiry
  }

  async submitInference(modelId: string, data: any): Promise<InferenceResult> {
    try {
      const inferenceId = uuidv4();
      const startTime = Date.now();

      this.logger.info(`Submitting inference request for model ${modelId}`, {
        inferenceId,
        dataSize: JSON.stringify(data).length
      });

      const modelConfig = this.config.models.find(m => m.id === modelId);
      if (!modelConfig) {
        throw new Error(`Model ${modelId} not configured`);
      }

      const payload = {
        model: modelId,
        data: data,
        parameters: {
          maxTokens: modelConfig.maxTokens || 1000,
          temperature: modelConfig.temperature || 0.7,
          topP: modelConfig.topP || 0.9
        },
        metadata: {
          requestId: inferenceId,
          timestamp: Date.now(),
          source: 'privateinsight-platform'
        }
      };

      const response: AxiosResponse = await this.client.post('/inference', payload);
      const endTime = Date.now();
      const latency = endTime - startTime;

      const result: InferenceResult = {
        id: response.data.id || inferenceId,
        result: response.data.result,
        confidence: response.data.confidence || 0.95,
        latency,
        cost: response.data.cost || 0,
        metadata: {
          modelId,
          tokens: response.data.tokens || 0,
          processingTime: response.data.processingTime || latency,
          ...response.data.metadata
        }
      };

      this.logger.info(`Inference completed successfully`, {
        inferenceId: result.id,
        latency,
        confidence: result.confidence
      });

      this.emit('inferenceCompleted', result);
      return result;

    } catch (error: any) {
      this.logger.error(`Inference failed for model ${modelId}:`, error.response?.data || error.message);
      
      const errorResult: InferenceResult = {
        id: uuidv4(),
        result: { error: error.message, code: error.response?.status || 500 },
        confidence: 0,
        latency: Date.now() - Date.now(),
        cost: 0,
        metadata: { error: true, modelId }
      };

      this.emit('inferenceError', errorResult);
      throw error;
    }
  }

  async *streamInference(modelId: string, data: any): AsyncIterableIterator<InferenceChunk> {
    try {
      const inferenceId = uuidv4();
      this.logger.info(`Starting streaming inference for model ${modelId}`, { inferenceId });

      const modelConfig = this.config.models.find(m => m.id === modelId);
      if (!modelConfig) {
        throw new Error(`Model ${modelId} not configured`);
      }

      const payload = {
        model: modelId,
        data: data,
        stream: true,
        parameters: {
          maxTokens: modelConfig.maxTokens || 1000,
          temperature: modelConfig.temperature || 0.7,
          topP: modelConfig.topP || 0.9
        },
        metadata: {
          requestId: inferenceId,
          timestamp: Date.now(),
          source: 'privateinsight-platform'
        }
      };

      const response = await this.client.post('/inference/stream', payload, {
        responseType: 'stream'
      });

      let chunkIndex = 0;
      let progress = 0;

      for await (const chunk of this.parseStreamResponse(response.data)) {
        const inferenceChunk: InferenceChunk = {
          id: `${inferenceId}-${chunkIndex++}`,
          chunk: chunk.data,
          isComplete: chunk.done || false,
          progress: chunk.progress || progress
        };

        progress = inferenceChunk.progress;
        yield inferenceChunk;

        if (inferenceChunk.isComplete) {
          this.logger.info(`Streaming inference completed`, { inferenceId, totalChunks: chunkIndex });
          break;
        }
      }

    } catch (error: any) {
      this.logger.error(`Streaming inference failed for model ${modelId}:`, error.message);
      
      yield {
        id: uuidv4(),
        chunk: { error: error.message },
        isComplete: true,
        progress: 0
      };
    }
  }

  private async *parseStreamResponse(stream: any): AsyncIterableIterator<any> {
    let buffer = '';
    
    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim().startsWith('data: ')) {
          try {
            const data = JSON.parse(line.substring(6));
            yield data;
          } catch (error) {
            this.logger.warn('Failed to parse streaming data:', line);
          }
        }
      }
    }
  }

  async getModelInfo(modelId: string): Promise<AlithModel> {
    try {
      this.logger.info(`Fetching model info for ${modelId}`);
      
      const response: AxiosResponse = await this.client.get(`/models/${modelId}`);
      const modelData = response.data;

      const model: AlithModel = {
        id: modelData.id,
        name: modelData.name,
        version: modelData.version,
        description: modelData.description,
        capabilities: modelData.capabilities || [],
        endpoints: modelData.endpoints || [],
        pricing: {
          model: modelData.pricing?.model || 'pay_per_use',
          costPerInference: modelData.pricing?.costPerInference || 0,
          currency: modelData.pricing?.currency || 'USD',
          limits: modelData.pricing?.limits
        },
        metadata: {
          accuracy: modelData.metadata?.accuracy || 0,
          latency: modelData.metadata?.latency || 0,
          throughput: modelData.metadata?.throughput || 0,
          privacyScore: modelData.metadata?.privacyScore || 0,
          lastUpdated: modelData.metadata?.lastUpdated || Date.now()
        }
      };

      this.logger.info(`Successfully fetched model info for ${modelId}`);
      return model;

    } catch (error: any) {
      this.logger.error(`Failed to fetch model info for ${modelId}:`, error.response?.data || error.message);
      throw new Error(`Failed to get model info: ${error.message}`);
    }
  }

  async listModels(): Promise<AlithModel[]> {
    try {
      this.logger.info('Fetching available models list');
      
      const response: AxiosResponse = await this.client.get('/models');
      const modelsData = response.data.models || response.data;

      const models: AlithModel[] = modelsData.map((modelData: any) => ({
        id: modelData.id,
        name: modelData.name,
        version: modelData.version,
        description: modelData.description,
        capabilities: modelData.capabilities || [],
        endpoints: modelData.endpoints || [],
        pricing: {
          model: modelData.pricing?.model || 'pay_per_use',
          costPerInference: modelData.pricing?.costPerInference || 0,
          currency: modelData.pricing?.currency || 'USD',
          limits: modelData.pricing?.limits
        },
        metadata: {
          accuracy: modelData.metadata?.accuracy || 0,
          latency: modelData.metadata?.latency || 0,
          throughput: modelData.metadata?.throughput || 0,
          privacyScore: modelData.metadata?.privacyScore || 0,
          lastUpdated: modelData.metadata?.lastUpdated || Date.now()
        }
      }));

      this.logger.info(`Successfully fetched ${models.length} models`);
      return models;

    } catch (error: any) {
      this.logger.error('Failed to fetch models list:', error.response?.data || error.message);
      throw new Error(`Failed to list models: ${error.message}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  async getUsageStats(): Promise<any> {
    try {
      const response = await this.client.get('/usage');
      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to fetch usage stats:', error.response?.data || error.message);
      throw new Error(`Failed to get usage stats: ${error.message}`);
    }
  }

  getConfig(): AlithConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<AlithConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.endpoint) {
      this.client.defaults.baseURL = newConfig.endpoint;
    }
    
    if (newConfig.timeout) {
      this.client.defaults.timeout = newConfig.timeout;
    }
    
    this.logger.info('Alith service configuration updated');
  }

  async disconnect(): Promise<void> {
    try {
      if (this.authToken) {
        await this.client.post('/auth/logout');
      }
    } catch (error) {
      this.logger.warn('Error during logout:', error);
    } finally {
      this.authToken = undefined;
      this.tokenExpiry = undefined;
      this.removeAllListeners();
      this.logger.info('Disconnected from Alith service');
    }
  }
} 