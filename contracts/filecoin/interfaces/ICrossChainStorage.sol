// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ICrossChainStorage
 * @notice Interface for cross-chain storage bridge between Filecoin and other chains
 * @dev Enables seamless data synchronization and access across multiple blockchains
 */
interface ICrossChainStorage {
    // ============ Events ============
    
    event SyncInitiated(
        bytes32 indexed vaultId,
        bytes32 indexed contentHash,
        address indexed targetChain,
        bytes32 syncId,
        uint256 timestamp
    );
    
    event SyncCompleted(
        bytes32 indexed syncId,
        bytes32 indexed vaultId,
        address targetChain,
        bytes32 targetVaultId,
        uint256 completionTime
    );
    
    event SyncFailed(
        bytes32 indexed syncId,
        bytes32 indexed vaultId,
        address targetChain,
        string reason,
        uint256 failureTime
    );
    
    event ChainRegistered(
        address indexed chainAddress,
        string chainName,
        string bridgeEndpoint,
        bool isActive
    );
    
    event CrossChainAccessRequested(
        bytes32 indexed vaultId,
        address indexed requestor,
        address targetChain,
        bytes32 requestId
    );
    
    event CrossChainAccessGranted(
        bytes32 indexed requestId,
        bytes32 indexed vaultId,
        address accessor,
        string accessUrl
    );

    // ============ Structs ============
    
    struct SyncOperation {
        bytes32 syncId;
        bytes32 vaultId;
        bytes32 contentHash;
        bytes32 encryptionHash;
        address sourceChain;
        address targetChain;
        SyncStatus status;
        uint256 initiatedTime;
        uint256 completedTime;
        string errorMessage;
        bytes32 targetVaultId;
    }
    
    enum SyncStatus {
        Initiated,
        Processing,
        Completed,
        Failed,
        Cancelled
    }
    
    struct ChainInfo {
        string chainName;
        string bridgeEndpoint;
        bool isActive;
        uint256 blockConfirmations;
        uint256 syncFee; // in wei
        address bridgeContract;
        string[] supportedFeatures;
    }
    
    struct CrossChainAccess {
        bytes32 requestId;
        bytes32 vaultId;
        address requestor;
        address targetChain;
        uint256 requestTime;
        uint256 expirationTime;
        bool isGranted;
        string accessUrl;
        bytes authToken;
    }

    // ============ Core Functions ============
    
    /**
     * @notice Initiate cross-chain data synchronization
     * @param vaultId Source vault identifier
     * @param contentHash IPFS content hash
     * @param encryptionHash Encryption metadata hash
     * @param targetChain Target chain address
     * @return syncId Unique synchronization identifier
     */
    function initiateSync(
        bytes32 vaultId,
        bytes32 contentHash,
        bytes32 encryptionHash,
        address targetChain
    ) external returns (bytes32 syncId);
    
    /**
     * @notice Complete cross-chain synchronization
     * @param syncId Synchronization identifier
     * @param targetVaultId Vault ID on target chain
     * @param proof Cryptographic proof of successful sync
     * @return success Whether completion was successful
     */
    function completeSync(
        bytes32 syncId,
        bytes32 targetVaultId,
        bytes calldata proof
    ) external returns (bool success);
    
    /**
     * @notice Request cross-chain access to data
     * @param vaultId Vault identifier
     * @param targetChain Target chain with the data
     * @param accessDuration Requested access duration
     * @return requestId Access request identifier
     */
    function requestCrossChainAccess(
        bytes32 vaultId,
        address targetChain,
        uint256 accessDuration
    ) external payable returns (bytes32 requestId);
    
    /**
     * @notice Grant cross-chain access request
     * @param requestId Access request identifier
     * @param accessUrl URL for cross-chain data access
     * @param authToken Authentication token
     * @return success Whether access was granted
     */
    function grantCrossChainAccess(
        bytes32 requestId,
        string calldata accessUrl,
        bytes calldata authToken
    ) external returns (bool success);
    
    /**
     * @notice Verify cross-chain data integrity
     * @param vaultId Vault identifier
     * @param targetChain Target chain to verify
     * @param expectedHash Expected content hash
     * @return isValid Whether data integrity is verified
     */
    function verifyCrossChainIntegrity(
        bytes32 vaultId,
        address targetChain,
        bytes32 expectedHash
    ) external view returns (bool isValid);
    
    /**
     * @notice Cancel ongoing synchronization
     * @param syncId Synchronization identifier
     * @return success Whether cancellation was successful
     */
    function cancelSync(bytes32 syncId) external returns (bool success);

    // ============ Chain Management ============
    
    /**
     * @notice Register a new chain for cross-chain operations
     * @param chainAddress Chain contract address
     * @param chainName Human-readable chain name
     * @param bridgeEndpoint Bridge endpoint URL
     * @param bridgeContract Bridge contract address
     * @param syncFee Synchronization fee in wei
     * @return success Whether registration succeeded
     */
    function registerChain(
        address chainAddress,
        string calldata chainName,
        string calldata bridgeEndpoint,
        address bridgeContract,
        uint256 syncFee
    ) external returns (bool success);
    
    /**
     * @notice Update chain configuration
     * @param chainAddress Chain to update
     * @param isActive New active status
     * @param bridgeEndpoint New bridge endpoint
     * @param syncFee New synchronization fee
     * @return success Whether update succeeded
     */
    function updateChain(
        address chainAddress,
        bool isActive,
        string calldata bridgeEndpoint,
        uint256 syncFee
    ) external returns (bool success);

    // ============ View Functions ============
    
    /**
     * @notice Get synchronization operation details
     * @param syncId Synchronization identifier
     * @return operation Complete sync operation details
     */
    function getSyncOperation(bytes32 syncId) external view returns (SyncOperation memory operation);
    
    /**
     * @notice Get chain information
     * @param chainAddress Chain contract address
     * @return info Chain configuration details
     */
    function getChainInfo(address chainAddress) external view returns (ChainInfo memory info);
    
    /**
     * @notice Get cross-chain access details
     * @param requestId Access request identifier
     * @return access Access request details
     */
    function getCrossChainAccess(bytes32 requestId) external view returns (CrossChainAccess memory access);
    
    /**
     * @notice Check if vault exists on target chain
     * @param vaultId Vault identifier
     * @param targetChain Target chain to check
     * @return exists Whether vault exists on target chain
     * @return targetVaultId Vault ID on target chain
     */
    function vaultExistsOnChain(
        bytes32 vaultId,
        address targetChain
    ) external view returns (bool exists, bytes32 targetVaultId);
    
    /**
     * @notice Get active synchronizations for vault
     * @param vaultId Vault identifier
     * @return syncIds Array of active sync operation IDs
     */
    function getActiveSyncs(bytes32 vaultId) external view returns (bytes32[] memory syncIds);
    
    /**
     * @notice Get supported chains
     * @return chains Array of registered chain addresses
     */
    function getSupportedChains() external view returns (address[] memory chains);
    
    /**
     * @notice Calculate cross-chain sync cost
     * @param targetChain Target chain for sync
     * @param dataSize Size of data to sync
     * @return cost Total cost in wei
     */
    function calculateSyncCost(
        address targetChain,
        uint256 dataSize
    ) external view returns (uint256 cost);

    // ============ Access Control ============
    
    /**
     * @notice Check if address has cross-chain access to vault
     * @param vaultId Vault identifier
     * @param accessor Address to check
     * @param targetChain Target chain
     * @return hasAccess Whether access is granted
     * @return expirationTime Access expiration time
     */
    function hasCrossChainAccess(
        bytes32 vaultId,
        address accessor,
        address targetChain
    ) external view returns (bool hasAccess, uint256 expirationTime);
    
    /**
     * @notice Revoke cross-chain access
     * @param requestId Access request to revoke
     * @return success Whether revocation succeeded
     */
    function revokeCrossChainAccess(bytes32 requestId) external returns (bool success);

    // ============ Emergency Functions ============
    
    /**
     * @notice Emergency pause for cross-chain operations
     * @param chainAddress Chain to pause operations for
     * @return success Whether pause was successful
     */
    function emergencyPause(address chainAddress) external returns (bool success);
    
    /**
     * @notice Resume cross-chain operations
     * @param chainAddress Chain to resume operations for
     * @return success Whether resume was successful
     */
    function emergencyResume(address chainAddress) external returns (bool success);
    
    /**
     * @notice Emergency sync recovery
     * @param syncId Failed synchronization to recover
     * @return success Whether recovery was initiated
     */
    function emergencyRecovery(bytes32 syncId) external returns (bool success);

    // ============ Fee Management ============
    
    /**
     * @notice Withdraw collected cross-chain fees
     * @param recipient Address to receive fees
     * @param amount Amount to withdraw
     * @return success Whether withdrawal succeeded
     */
    function withdrawFees(address recipient, uint256 amount) external returns (bool success);
    
    /**
     * @notice Get total collected fees
     * @return totalFees Total fees collected in wei
     */
    function getTotalFees() external view returns (uint256 totalFees);
} 