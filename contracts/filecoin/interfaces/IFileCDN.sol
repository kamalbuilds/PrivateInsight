// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFileCDN
 * @notice Interface for FileCDN content delivery network integration
 * @dev Provides instant global content delivery for analytics results and data
 */
interface IFileCDN {
    // ============ Events ============
    
    event DeliverySetup(
        bytes32 indexed vaultId,
        bytes32 indexed contentHash,
        string cdnUrl,
        bool isPrivate
    );
    
    event ContentCached(
        bytes32 indexed contentHash,
        string[] regions,
        uint256 cacheTime
    );
    
    event ContentDelivered(
        bytes32 indexed vaultId,
        address indexed accessor,
        string deliveryUrl,
        uint256 timestamp
    );
    
    event CacheInvalidated(
        bytes32 indexed contentHash,
        string[] regions,
        uint256 invalidationTime
    );
    
    event EdgeDeployment(
        bytes32 indexed contentHash,
        string region,
        string edgeUrl,
        uint256 deploymentTime
    );

    // ============ Structs ============
    
    struct CDNConfiguration {
        bytes32 contentHash;
        string baseUrl;
        bool isPrivate;
        uint256 ttl; // Time to live in seconds
        string[] targetRegions;
        bool compressionEnabled;
        string compressionFormat;
        uint256 maxFileSize;
        bool authRequired;
    }
    
    struct DeliveryMetrics {
        uint256 totalRequests;
        uint256 successfulDeliveries;
        uint256 averageLatency; // in milliseconds
        uint256 totalBandwidth; // in bytes
        uint256 cacheHitRate; // percentage
        mapping(string => uint256) regionalRequests;
    }
    
    struct EdgeLocation {
        string region;
        string endpoint;
        bool isActive;
        uint256 capacity; // in GB
        uint256 currentLoad; // in GB
        uint256 latency; // in milliseconds
    }

    // ============ Core Functions ============
    
    /**
     * @notice Setup content delivery for a data vault
     * @param vaultId Unique vault identifier
     * @param contentHash IPFS content hash
     * @param isPrivate Whether content requires authentication
     * @return cdnUrl Global CDN URL for content access
     */
    function setupDelivery(
        bytes32 vaultId,
        bytes32 contentHash,
        bool isPrivate
    ) external returns (string memory cdnUrl);
    
    /**
     * @notice Cache content across specified regions
     * @param contentHash IPFS content hash
     * @param regions Target regions for caching
     * @param ttl Cache time-to-live in seconds
     * @return success Whether caching operation succeeded
     */
    function cacheContent(
        bytes32 contentHash,
        string[] calldata regions,
        uint256 ttl
    ) external returns (bool success);
    
    /**
     * @notice Get optimized delivery URL for user location
     * @param vaultId Vault identifier
     * @param userRegion User's geographic region
     * @return deliveryUrl Optimized delivery URL
     * @return expectedLatency Expected latency in milliseconds
     */
    function getDeliveryUrl(
        bytes32 vaultId,
        string calldata userRegion
    ) external view returns (string memory deliveryUrl, uint256 expectedLatency);
    
    /**
     * @notice Invalidate cached content across all regions
     * @param contentHash IPFS content hash
     * @return success Whether invalidation succeeded
     */
    function invalidateCache(bytes32 contentHash) external returns (bool success);
    
    /**
     * @notice Update CDN configuration for content
     * @param contentHash IPFS content hash
     * @param config New CDN configuration
     * @return success Whether update succeeded
     */
    function updateConfiguration(
        bytes32 contentHash,
        CDNConfiguration calldata config
    ) external returns (bool success);
    
    /**
     * @notice Pre-warm cache with content in specified regions
     * @param contentHash IPFS content hash
     * @param regions Regions to pre-warm
     * @param priority Cache priority (1-10)
     * @return success Whether pre-warming initiated successfully
     */
    function preWarmCache(
        bytes32 contentHash,
        string[] calldata regions,
        uint8 priority
    ) external returns (bool success);

    // ============ Analytics & Monitoring ============
    
    /**
     * @notice Get delivery metrics for content
     * @param contentHash IPFS content hash
     * @param timeRange Time range for metrics (in seconds from now)
     * @return metrics Delivery performance metrics
     */
    function getDeliveryMetrics(
        bytes32 contentHash,
        uint256 timeRange
    ) external view returns (
        uint256 totalRequests,
        uint256 successfulDeliveries,
        uint256 averageLatency,
        uint256 totalBandwidth,
        uint256 cacheHitRate
    );
    
    /**
     * @notice Get regional performance breakdown
     * @param contentHash IPFS content hash
     * @return regions Array of region names
     * @return requests Array of request counts per region
     * @return latencies Array of average latencies per region
     */
    function getRegionalMetrics(bytes32 contentHash) external view returns (
        string[] memory regions,
        uint256[] memory requests,
        uint256[] memory latencies
    );
    
    /**
     * @notice Get edge location status
     * @param region Region identifier
     * @return location Edge location details
     */
    function getEdgeLocation(string calldata region) external view returns (EdgeLocation memory location);

    // ============ View Functions ============
    
    /**
     * @notice Get CDN configuration for content
     * @param contentHash IPFS content hash
     * @return config Current CDN configuration
     */
    function getCDNConfiguration(bytes32 contentHash) external view returns (CDNConfiguration memory config);
    
    /**
     * @notice Check if content is cached in region
     * @param contentHash IPFS content hash
     * @param region Region to check
     * @return isCached Whether content is cached
     * @return cacheExpiry Cache expiration timestamp
     */
    function isCached(
        bytes32 contentHash,
        string calldata region
    ) external view returns (bool isCached, uint256 cacheExpiry);
    
    /**
     * @notice Get available regions for content delivery
     * @return regions Array of available region identifiers
     */
    function getAvailableRegions() external view returns (string[] memory regions);
    
    /**
     * @notice Calculate delivery cost for content and regions
     * @param contentSize Content size in bytes
     * @param regions Target regions
     * @param deliveryDuration Expected delivery duration
     * @return cost Total delivery cost in wei
     */
    function calculateDeliveryCost(
        uint256 contentSize,
        string[] calldata regions,
        uint256 deliveryDuration
    ) external view returns (uint256 cost);
    
    /**
     * @notice Get optimal edge location for user
     * @param userRegion User's region
     * @return optimalRegion Best edge location for user
     * @return estimatedLatency Estimated latency to edge
     */
    function getOptimalEdge(string calldata userRegion) external view returns (
        string memory optimalRegion,
        uint256 estimatedLatency
    );

    // ============ Admin Functions ============
    
    /**
     * @notice Add new edge location
     * @param region Region identifier
     * @param endpoint Edge endpoint URL
     * @param capacity Storage capacity in GB
     * @return success Whether edge was added successfully
     */
    function addEdgeLocation(
        string calldata region,
        string calldata endpoint,
        uint256 capacity
    ) external returns (bool success);
    
    /**
     * @notice Update edge location status
     * @param region Region identifier
     * @param isActive New active status
     * @param capacity New capacity if updating
     * @return success Whether update succeeded
     */
    function updateEdgeLocation(
        string calldata region,
        bool isActive,
        uint256 capacity
    ) external returns (bool success);
    
    /**
     * @notice Emergency cache purge for content
     * @param contentHash IPFS content hash
     * @return success Whether purge succeeded
     */
    function emergencyPurge(bytes32 contentHash) external returns (bool success);
    
    /**
     * @notice Set global CDN configuration
     * @param maxTTL Maximum time-to-live for cache
     * @param defaultCompression Default compression format
     * @param maxFileSize Maximum file size for CDN
     * @return success Whether configuration update succeeded
     */
    function setGlobalConfiguration(
        uint256 maxTTL,
        string calldata defaultCompression,
        uint256 maxFileSize
    ) external returns (bool success);
} 