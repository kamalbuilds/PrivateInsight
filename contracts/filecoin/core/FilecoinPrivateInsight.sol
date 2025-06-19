// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/IPDPStorage.sol";
import "../interfaces/IFileCDN.sol";
import "../interfaces/ICrossChainStorage.sol";

/**
 * @title FilecoinPrivateInsight
 * @notice Main contract for PrivateInsight platform on Filecoin Virtual Machine
 * @dev Coordinates privacy-preserving analytics with PDP storage and FilCDN delivery
 * @author PrivateInsight Team
 */
contract FilecoinPrivateInsight is AccessControl, ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    // ============ Constants ============
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ANALYTICS_ROLE = keccak256("ANALYTICS_ROLE");
    bytes32 public constant STORAGE_PROVIDER_ROLE = keccak256("STORAGE_PROVIDER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");

    uint256 public constant MIN_STORAGE_DURATION = 30 days;
    uint256 public constant MAX_STORAGE_DURATION = 365 days;
    uint256 public constant PDP_CHALLENGE_INTERVAL = 1 days;

    // ============ Storage ============
    struct DataVault {
        bytes32 contentHash;        // IPFS content hash
        bytes32 encryptionHash;     // Hash of encryption metadata
        address owner;              // Data owner
        uint256 size;               // Data size in bytes
        uint256 storageDeadline;    // Storage expiration
        string pdpProviderId;       // PDP storage provider ID
        string fileCDNUrl;          // FileCDN delivery URL
        bool isPrivate;             // Privacy flag
        uint256 accessCount;        // Access counter
        mapping(address => bool) authorizedUsers; // Authorized access
    }

    struct AnalyticsJob {
        bytes32 jobId;              // Unique job identifier
        bytes32[] inputVaults;      // Input data vault IDs
        bytes32 resultHash;         // Result content hash
        address requestor;          // Job requestor
        uint256 computeDeadline;    // Computation deadline
        JobStatus status;           // Current job status
        bytes zkProof;              // Zero-knowledge proof
        string computeParams;       // Computation parameters
        uint256 gasUsed;            // Gas consumption
    }

    enum JobStatus {
        Pending,
        Computing,
        Completed,
        Failed,
        VerificationPending
    }

    struct StorageProvider {
        string providerId;          // Unique provider ID
        string endpoint;            // Provider API endpoint
        uint256 storageCapacity;    // Total storage capacity
        uint256 usedCapacity;       // Used storage capacity
        uint256 reputationScore;    // Provider reputation (0-1000)
        bool isActive;              // Provider status
        uint256 pricePerGB;         // Price per GB per month
        string[] supportedRegions;  // Supported geographic regions
    }

    // ============ State Variables ============
    IPDPStorage public immutable pdpStorage;
    IFileCDN public immutable fileCDN;
    ICrossChainStorage public immutable crossChainBridge;

    mapping(bytes32 => DataVault) public dataVaults;
    mapping(bytes32 => AnalyticsJob) public analyticsJobs;
    mapping(string => StorageProvider) public storageProviders;
    mapping(address => bytes32[]) public userVaults;
    mapping(address => uint256) public userStorageLimits;

    bytes32[] public activeVaults;
    string[] public registeredProviders;

    uint256 public totalStorageUsed;
    uint256 public totalJobsCompleted;
    uint256 public platformFeePercent = 250; // 2.5%

    // ============ Events ============
    event VaultCreated(
        bytes32 indexed vaultId,
        address indexed owner,
        bytes32 contentHash,
        uint256 size,
        string pdpProviderId
    );

    event VaultAccessed(
        bytes32 indexed vaultId,
        address indexed accessor,
        uint256 timestamp
    );

    event AnalyticsJobSubmitted(
        bytes32 indexed jobId,
        address indexed requestor,
        bytes32[] inputVaults,
        uint256 computeDeadline
    );

    event AnalyticsJobCompleted(
        bytes32 indexed jobId,
        bytes32 resultHash,
        bytes zkProof,
        uint256 gasUsed
    );

    event StorageProviderRegistered(
        string indexed providerId,
        string endpoint,
        uint256 capacity
    );

    event CrossChainDataSynced(
        bytes32 indexed vaultId,
        address indexed targetChain,
        bytes32 syncHash
    );

    // ============ Errors ============
    error InvalidVaultId();
    error UnauthorizedAccess();
    error InsufficientStorageLimit();
    error InvalidStorageDuration();
    error StorageProviderNotFound();
    error JobNotFound();
    error InvalidZKProof();
    error CrossChainSyncFailed();

    // ============ Constructor ============
    constructor(
        address _pdpStorage,
        address _fileCDN,
        address _crossChainBridge
    ) {
        require(_pdpStorage != address(0), "Invalid PDP storage address");
        require(_fileCDN != address(0), "Invalid FileCDN address");
        require(_crossChainBridge != address(0), "Invalid bridge address");

        pdpStorage = IPDPStorage(_pdpStorage);
        fileCDN = IFileCDN(_fileCDN);
        crossChainBridge = ICrossChainStorage(_crossChainBridge);

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ============ Data Vault Management ============

    /**
     * @notice Create a new encrypted data vault with PDP storage
     * @param contentHash IPFS content hash of encrypted data
     * @param encryptionHash Hash of encryption metadata
     * @param size Data size in bytes
     * @param storageDuration Storage duration in seconds
     * @param pdpProviderId PDP storage provider ID
     * @param isPrivate Privacy flag for the data
     * @return vaultId Unique vault identifier
     */
    function createVault(
        bytes32 contentHash,
        bytes32 encryptionHash,
        uint256 size,
        uint256 storageDuration,
        string calldata pdpProviderId,
        bool isPrivate
    ) external nonReentrant whenNotPaused returns (bytes32 vaultId) {
        require(size > 0, "Invalid data size");
        require(
            storageDuration >= MIN_STORAGE_DURATION && 
            storageDuration <= MAX_STORAGE_DURATION,
            "Invalid storage duration"
        );

        // Check if provider exists and is active
        StorageProvider storage provider = storageProviders[pdpProviderId];
        require(bytes(provider.providerId).length > 0, "Provider not registered");
        require(provider.isActive, "Provider inactive");

        // Check user storage limits
        uint256 userLimit = userStorageLimits[msg.sender];
        if (userLimit == 0) userLimit = 10 * 1024 * 1024 * 1024; // 10GB default
        require(size <= userLimit, "Exceeds storage limit");

        // Generate unique vault ID
        vaultId = keccak256(abi.encodePacked(
            msg.sender,
            contentHash,
            block.timestamp,
            block.difficulty
        ));

        // Store vault data using PDP
        require(
            pdpStorage.storeData(vaultId, contentHash, size, storageDuration, pdpProviderId),
            "PDP storage failed"
        );

        // Setup FileCDN delivery
        string memory fileCDNUrl = fileCDN.setupDelivery(vaultId, contentHash, isPrivate);

        // Create vault record
        DataVault storage vault = dataVaults[vaultId];
        vault.contentHash = contentHash;
        vault.encryptionHash = encryptionHash;
        vault.owner = msg.sender;
        vault.size = size;
        vault.storageDeadline = block.timestamp + storageDuration;
        vault.pdpProviderId = pdpProviderId;
        vault.fileCDNUrl = fileCDNUrl;
        vault.isPrivate = isPrivate;
        vault.accessCount = 0;

        // Update tracking
        userVaults[msg.sender].push(vaultId);
        activeVaults.push(vaultId);
        totalStorageUsed += size;

        emit VaultCreated(vaultId, msg.sender, contentHash, size, pdpProviderId);
    }

    /**
     * @notice Access data from a vault with privacy controls
     * @param vaultId Vault identifier
     * @return contentHash IPFS content hash
     * @return fileCDNUrl FileCDN delivery URL
     */
    function accessVault(bytes32 vaultId) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bytes32 contentHash, string memory fileCDNUrl) 
    {
        DataVault storage vault = dataVaults[vaultId];
        require(vault.owner != address(0), "Vault not found");
        require(
            vault.owner == msg.sender || vault.authorizedUsers[msg.sender],
            "Unauthorized access"
        );
        require(block.timestamp < vault.storageDeadline, "Vault expired");

        // Verify PDP proof
        require(
            pdpStorage.verifyDataAvailability(vaultId),
            "Data availability verification failed"
        );

        vault.accessCount++;
        
        emit VaultAccessed(vaultId, msg.sender, block.timestamp);
        
        return (vault.contentHash, vault.fileCDNUrl);
    }

    /**
     * @notice Authorize user access to a vault
     * @param vaultId Vault identifier
     * @param user User address to authorize
     */
    function authorizeVaultAccess(bytes32 vaultId, address user) external {
        DataVault storage vault = dataVaults[vaultId];
        require(vault.owner == msg.sender, "Only owner can authorize");
        vault.authorizedUsers[user] = true;
    }

    // ============ Analytics Job Management ============

    /**
     * @notice Submit privacy-preserving analytics job
     * @param inputVaults Array of input vault IDs
     * @param computeParams Computation parameters
     * @param computeDeadline Job deadline
     * @return jobId Unique job identifier
     */
    function submitAnalyticsJob(
        bytes32[] calldata inputVaults,
        string calldata computeParams,
        uint256 computeDeadline
    ) external nonReentrant whenNotPaused returns (bytes32 jobId) {
        require(inputVaults.length > 0, "No input vaults");
        require(computeDeadline > block.timestamp, "Invalid deadline");

        // Verify access to all input vaults
        for (uint256 i = 0; i < inputVaults.length; i++) {
            DataVault storage vault = dataVaults[inputVaults[i]];
            require(vault.owner != address(0), "Vault not found");
            require(
                vault.owner == msg.sender || vault.authorizedUsers[msg.sender],
                "Unauthorized vault access"
            );
        }

        jobId = keccak256(abi.encodePacked(
            msg.sender,
            inputVaults,
            computeParams,
            block.timestamp
        ));

        AnalyticsJob storage job = analyticsJobs[jobId];
        job.jobId = jobId;
        job.inputVaults = inputVaults;
        job.requestor = msg.sender;
        job.computeDeadline = computeDeadline;
        job.status = JobStatus.Pending;
        job.computeParams = computeParams;

        emit AnalyticsJobSubmitted(jobId, msg.sender, inputVaults, computeDeadline);
    }

    /**
     * @notice Complete analytics job with ZK proof
     * @param jobId Job identifier
     * @param resultHash Result content hash
     * @param zkProof Zero-knowledge proof
     * @param gasUsed Gas consumption
     */
    function completeAnalyticsJob(
        bytes32 jobId,
        bytes32 resultHash,
        bytes calldata zkProof,
        uint256 gasUsed
    ) external nonReentrant onlyRole(ANALYTICS_ROLE) {
        AnalyticsJob storage job = analyticsJobs[jobId];
        require(job.requestor != address(0), "Job not found");
        require(job.status == JobStatus.Computing, "Invalid job status");

        // Verify ZK proof (simplified for demo)
        require(zkProof.length > 0, "Invalid ZK proof");

        job.resultHash = resultHash;
        job.zkProof = zkProof;
        job.gasUsed = gasUsed;
        job.status = JobStatus.Completed;

        totalJobsCompleted++;

        emit AnalyticsJobCompleted(jobId, resultHash, zkProof, gasUsed);
    }

    // ============ Storage Provider Management ============

    /**
     * @notice Register a new PDP storage provider
     * @param providerId Unique provider identifier
     * @param endpoint Provider API endpoint
     * @param capacity Storage capacity in bytes
     * @param pricePerGB Price per GB per month
     * @param regions Supported regions
     */
    function registerStorageProvider(
        string calldata providerId,
        string calldata endpoint,
        uint256 capacity,
        uint256 pricePerGB,
        string[] calldata regions
    ) external onlyRole(ADMIN_ROLE) {
        require(bytes(providerId).length > 0, "Invalid provider ID");
        require(capacity > 0, "Invalid capacity");

        StorageProvider storage provider = storageProviders[providerId];
        provider.providerId = providerId;
        provider.endpoint = endpoint;
        provider.storageCapacity = capacity;
        provider.usedCapacity = 0;
        provider.reputationScore = 500; // Start with medium reputation
        provider.isActive = true;
        provider.pricePerGB = pricePerGB;
        provider.supportedRegions = regions;

        registeredProviders.push(providerId);

        emit StorageProviderRegistered(providerId, endpoint, capacity);
    }

    // ============ Cross-Chain Integration ============

    /**
     * @notice Sync vault data across chains
     * @param vaultId Vault identifier
     * @param targetChain Target chain address
     */
    function syncCrossChain(
        bytes32 vaultId,
        address targetChain
    ) external nonReentrant onlyRole(BRIDGE_ROLE) {
        DataVault storage vault = dataVaults[vaultId];
        require(vault.owner != address(0), "Vault not found");

        bytes32 syncHash = crossChainBridge.initiateSync(
            vaultId,
            vault.contentHash,
            vault.encryptionHash,
            targetChain
        );

        emit CrossChainDataSynced(vaultId, targetChain, syncHash);
    }

    // ============ View Functions ============

    function getVaultInfo(bytes32 vaultId) external view returns (
        bytes32 contentHash,
        address owner,
        uint256 size,
        uint256 storageDeadline,
        string memory pdpProviderId,
        string memory fileCDNUrl,
        bool isPrivate,
        uint256 accessCount
    ) {
        DataVault storage vault = dataVaults[vaultId];
        return (
            vault.contentHash,
            vault.owner,
            vault.size,
            vault.storageDeadline,
            vault.pdpProviderId,
            vault.fileCDNUrl,
            vault.isPrivate,
            vault.accessCount
        );
    }

    function getJobInfo(bytes32 jobId) external view returns (
        bytes32[] memory inputVaults,
        bytes32 resultHash,
        address requestor,
        uint256 computeDeadline,
        JobStatus status,
        string memory computeParams,
        uint256 gasUsed
    ) {
        AnalyticsJob storage job = analyticsJobs[jobId];
        return (
            job.inputVaults,
            job.resultHash,
            job.requestor,
            job.computeDeadline,
            job.status,
            job.computeParams,
            job.gasUsed
        );
    }

    function getUserVaults(address user) external view returns (bytes32[] memory) {
        return userVaults[user];
    }

    function getStorageProviders() external view returns (string[] memory) {
        return registeredProviders;
    }

    // ============ Admin Functions ============

    function setUserStorageLimit(address user, uint256 limit) external onlyRole(ADMIN_ROLE) {
        userStorageLimits[user] = limit;
    }

    function setPlatformFee(uint256 feePercent) external onlyRole(ADMIN_ROLE) {
        require(feePercent <= 1000, "Fee too high"); // Max 10%
        platformFeePercent = feePercent;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    // ============ Emergency Functions ============

    function emergencyVaultRecovery(bytes32 vaultId) external onlyRole(ADMIN_ROLE) {
        // Emergency recovery mechanism
        DataVault storage vault = dataVaults[vaultId];
        require(vault.owner != address(0), "Vault not found");
        
        // Extend storage deadline by 30 days for recovery
        vault.storageDeadline += 30 days;
    }
} 