import { create as createIPFS, type IPFSHTTPClient } from 'ipfs-http-client';
import { Logger } from '../../utils/Logger';
import axios from 'axios';

/**
 * IPFSManager - Production-ready IPFS content management for Filecoin integration
 */
export class IPFSManager {
  private ipfs: IPFSHTTPClient;
  private logger: Logger;
  private gatewayUrl: string;

  constructor(
    ipfsUrl: string = 'https://ipfs.infura.io:5001',
    gatewayUrl: string = 'https://gateway.ipfs.io'
  ) {
    this.logger = new Logger('IPFSManager');
    this.gatewayUrl = gatewayUrl;

    // Initialize IPFS client
    this.ipfs = createIPFS({
      url: ipfsUrl,
      timeout: 60000
    });

    this.logger.info(`IPFS client initialized with URL: ${ipfsUrl}`);
  }

  /**
   * Upload data to IPFS
   */
  async uploadData(data: Buffer): Promise<IPFSUploadResult> {
    try {
      this.logger.info(`Uploading ${data.length} bytes to IPFS`);

      const result = await this.ipfs.add(data, {
        pin: true,
        cidVersion: 1,
        hashAlg: 'sha2-256'
      });

      const uploadResult: IPFSUploadResult = {
        hash: result.cid.toString(),
        size: result.size,
        url: `${this.gatewayUrl}/ipfs/${result.cid.toString()}`,
        pinned: true
      };

      this.logger.info(`Successfully uploaded to IPFS: ${uploadResult.hash}`);
      return uploadResult;

    } catch (error) {
      this.logger.error('Failed to upload to IPFS:', error);
      throw error;
    }
  }

  /**
   * Retrieve data from IPFS
   */
  async retrieveData(hash: string): Promise<Buffer> {
    try {
      this.logger.info(`Retrieving data from IPFS: ${hash}`);

      const chunks: Uint8Array[] = [];
      for await (const chunk of this.ipfs.cat(hash)) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks);
      this.logger.info(`Successfully retrieved ${data.length} bytes from IPFS`);
      return data;

    } catch (error) {
      this.logger.error(`Failed to retrieve from IPFS: ${hash}`, error);
      throw error;
    }
  }

  /**
   * Pin content to IPFS
   */
  async pinContent(hash: string): Promise<boolean> {
    try {
      await this.ipfs.pin.add(hash);
      this.logger.info(`Successfully pinned content: ${hash}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to pin content: ${hash}`, error);
      return false;
    }
  }

  /**
   * Unpin content from IPFS
   */
  async unpinContent(hash: string): Promise<boolean> {
    try {
      await this.ipfs.pin.rm(hash);
      this.logger.info(`Successfully unpinned content: ${hash}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unpin content: ${hash}`, error);
      return false;
    }
  }

  /**
   * Check if content exists on IPFS
   */
  async contentExists(hash: string): Promise<boolean> {
    try {
      // Try to fetch content info
      const response = await axios.head(`${this.gatewayUrl}/ipfs/${hash}`, {
        timeout: 10000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get content statistics
   */
  async getContentStats(hash: string): Promise<IPFSContentStats> {
    try {
      const stat = await this.ipfs.files.stat(`/ipfs/${hash}`);
      
      return {
        hash,
        size: stat.size,
        blocks: stat.blocks,
        type: stat.type,
        cumulativeSize: stat.cumulativeSize
      };
    } catch (error) {
      this.logger.error(`Failed to get content stats: ${hash}`, error);
      throw error;
    }
  }

  /**
   * List pinned content
   */
  async listPinnedContent(): Promise<string[]> {
    try {
      const pinned: string[] = [];
      for await (const pin of this.ipfs.pin.ls()) {
        pinned.push(pin.cid.toString());
      }
      return pinned;
    } catch (error) {
      this.logger.error('Failed to list pinned content:', error);
      throw error;
    }
  }
}

// Type definitions
export interface IPFSUploadResult {
  hash: string;
  size: number;
  url: string;
  pinned: boolean;
}

export interface IPFSContentStats {
  hash: string;
  size: number;
  blocks: number;
  type: string;
  cumulativeSize: number;
} 