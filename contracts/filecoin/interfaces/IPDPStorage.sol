// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IPDPStorage
 * @notice Interface for Proof of Data Possession storage on Filecoin
 * @dev Defines the contract interface for PDP storage operations
 */
interface IPDPStorage {
    // ============ Events ============
    
    event DataStored(
        bytes32 indexed vaultId,
        bytes32 indexed contentHash,
        string providerId,
        uint256 size,
        uint256 storageDuration
    );
    
    event DataRetrieved(
        bytes32 indexed vaultId,
        address indexed accessor,
        uint256 timestamp
    );
    
    event PDPChallengeGenerated(
        bytes32 indexed vaultId,
        bytes32 challengeHash,
        uint256 challengeTime
    );
    
    event PDPProofSubmitted(
        bytes32 indexed vaultId,
        bytes32 challengeHash,
        bytes proof,
        bool verified
    );
    
    event StorageRenewed(
        bytes32 indexed vaultId,
        uint256 newExpiration,
        uint256 additionalCost
    );

    // ============ Structs ============
    
    struct PDPChallenge {
        bytes32 challengeHash;
        uint256 challengeTime;
        bytes32 vaultId;
        bool answered;
        bytes proof;
        bool verified;
    }
    
    struct StorageInfo {
        bytes32 contentHash;
        string providerId;
        uint256 size;
        uint256 storageDuration;
        uint256 storageExpiration;
        uint256 lastChallengeTime;
        uint256 challengeCount;
        bool isActive;
    }

    // ============ Core Functions ============
    
    /**
     * @notice Store data using PDP with specified provider
     * @param vaultId Unique vault identifier
     * @param contentHash IPFS content hash of the data
     * @param size Data size in bytes
     * @param storageDuration Duration of storage in seconds
     * @param providerId PDP storage provider identifier
     * @return success Whether storage operation succeeded
     */
    function storeData(
        bytes32 vaultId,
        bytes32 contentHash,
        uint256 size,
        uint256 storageDuration,
        string calldata providerId
    ) external returns (bool success);
    
    /**
     * @notice Verify data availability using PDP proof
     * @param vaultId Vault identifier
     * @return available Whether data is available and verified
     */
    function verifyDataAvailability(bytes32 vaultId) external view returns (bool available);
    
    /**
     * @notice Generate PDP challenge for data integrity verification
     * @param vaultId Vault identifier
     * @return challengeHash Generated challenge hash
     */
    function generatePDPChallenge(bytes32 vaultId) external returns (bytes32 challengeHash);
    
    /**
     * @notice Submit PDP proof in response to challenge
     * @param vaultId Vault identifier
     * @param challengeHash Challenge hash to respond to
     * @param proof Cryptographic proof of data possession
     * @return verified Whether proof is valid
     */
    function submitPDPProof(
        bytes32 vaultId,
        bytes32 challengeHash,
        bytes calldata proof
    ) external returns (bool verified);
    
    /**
     * @notice Retrieve data from PDP storage
     * @param vaultId Vault identifier
     * @return contentHash IPFS content hash
     * @return retrievalUrl URL for data retrieval
     */
    function retrieveData(bytes32 vaultId) external returns (
        bytes32 contentHash,
        string memory retrievalUrl
    );
    
    /**
     * @notice Renew storage duration for existing data
     * @param vaultId Vault identifier
     * @param additionalDuration Additional storage time in seconds
     * @return newExpiration New expiration timestamp
     */
    function renewStorage(
        bytes32 vaultId,
        uint256 additionalDuration
    ) external payable returns (uint256 newExpiration);
    
    /**
     * @notice Calculate storage cost for given parameters
     * @param size Data size in bytes
     * @param duration Storage duration in seconds
     * @param providerId Storage provider identifier
     * @return cost Storage cost in wei
     */
    function calculateStorageCost(
        uint256 size,
        uint256 duration,
        string calldata providerId
    ) external view returns (uint256 cost);

    // ============ View Functions ============
    
    /**
     * @notice Get storage information for a vault
     * @param vaultId Vault identifier
     * @return info Complete storage information
     */
    function getStorageInfo(bytes32 vaultId) external view returns (StorageInfo memory info);
    
    /**
     * @notice Get PDP challenge information
     * @param challengeHash Challenge hash
     * @return challenge Challenge details
     */
    function getPDPChallenge(bytes32 challengeHash) external view returns (PDPChallenge memory challenge);
    
    /**
     * @notice Check if vault storage is active and not expired
     * @param vaultId Vault identifier
     * @return active Whether storage is active
     */
    function isStorageActive(bytes32 vaultId) external view returns (bool active);
    
    /**
     * @notice Get last PDP challenge time for vault
     * @param vaultId Vault identifier
     * @return lastChallenge Timestamp of last challenge
     */
    function getLastChallengeTime(bytes32 vaultId) external view returns (uint256 lastChallenge);
    
    /**
     * @notice Get storage provider details
     * @param providerId Provider identifier
     * @return endpoint Provider API endpoint
     * @return isActive Whether provider is active
     * @return reputationScore Provider reputation (0-1000)
     */
    function getProviderInfo(string calldata providerId) external view returns (
        string memory endpoint,
        bool isActive,
        uint256 reputationScore
    );

    // ============ Admin Functions ============
    
    /**
     * @notice Emergency data recovery function
     * @param vaultId Vault identifier
     * @return success Whether recovery was successful
     */
    function emergencyRecovery(bytes32 vaultId) external returns (bool success);
    
    /**
     * @notice Update provider information
     * @param providerId Provider identifier
     * @param endpoint New endpoint
     * @param isActive New active status
     */
    function updateProvider(
        string calldata providerId,
        string calldata endpoint,
        bool isActive
    ) external;
} 