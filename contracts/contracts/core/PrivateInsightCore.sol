// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "../interfaces/IZKProofVerifier.sol";
import "../interfaces/IDataVault.sol";
import "../interfaces/IAlithAgent.sol";

/**
 * @title PrivateInsightCore
 * @dev Core contract for the PrivateInsight privacy-preserving analytics platform
 * @notice This contract manages privacy-preserving data analytics operations on Metis
 */
contract PrivateInsightCore is 
    Initializable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    // Role definitions
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant ANALYTICS_ROLE = keccak256("ANALYTICS_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    // Data structures
    struct AnalyticsJob {
        uint256 id;
        address requester;
        bytes32 datasetHash;
        bytes32 circuitHash;
        uint256 timestamp;
        JobStatus status;
        bytes32 resultHash;
        uint256 proofValidated;
    }

    struct DataProvider {
        address provider;
        uint256 reputation;
        bool isActive;
        uint256 totalContributions;
        mapping(bytes32 => bool) authorizedDatasets;
    }

    struct PrivacyBudget {
        uint256 epsilon;
        uint256 consumed;
        uint256 allocated;
        uint256 resetTimestamp;
    }

    enum JobStatus {
        Pending,
        Processing,
        Completed,
        Failed,
        Verified
    }

    // State variables
    mapping(uint256 => AnalyticsJob) public analyticsJobs;
    mapping(address => DataProvider) public dataProviders;
    mapping(bytes32 => PrivacyBudget) public privacyBudgets;
    mapping(address => mapping(bytes32 => bool)) public accessPermissions;

    uint256 public nextJobId;
    uint256 public totalJobs;
    uint256 public constant PRIVACY_BUDGET_RESET_PERIOD = 30 days;

    // External contract interfaces
    IZKProofVerifier public zkVerifier;
    IDataVault public dataVault;
    IAlithAgent public alithAgent;

    // Events
    event AnalyticsJobCreated(
        uint256 indexed jobId,
        address indexed requester,
        bytes32 indexed datasetHash
    );

    event ProofSubmitted(
        uint256 indexed jobId,
        bytes32 proofHash,
        bool verified
    );

    event PrivacyBudgetAllocated(
        bytes32 indexed datasetHash,
        uint256 epsilon,
        uint256 timestamp
    );

    event DataProviderRegistered(
        address indexed provider,
        uint256 reputation
    );

    event AnalyticsResultGenerated(
        uint256 indexed jobId,
        bytes32 resultHash,
        uint256 timestamp
    );

    // Modifiers
    modifier onlyRegisteredProvider() {
        require(dataProviders[msg.sender].isActive, "Not a registered data provider");
        _;
    }

    modifier validJob(uint256 _jobId) {
        require(_jobId < nextJobId, "Invalid job ID");
        require(analyticsJobs[_jobId].requester != address(0), "Job does not exist");
        _;
    }

    modifier sufficientPrivacyBudget(bytes32 _datasetHash, uint256 _epsilonRequired) {
        PrivacyBudget storage budget = privacyBudgets[_datasetHash];
        require(
            budget.allocated >= budget.consumed + _epsilonRequired,
            "Insufficient privacy budget"
        );
        _;
    }

    /**
     * @dev Initialize the contract
     * @param _admin Admin address
     * @param _zkVerifier ZK proof verifier contract address
     * @param _dataVault Data vault contract address
     * @param _alithAgent Alith AI agent contract address
     */
    function initialize(
        address _admin,
        address _zkVerifier,
        address _dataVault,
        address _alithAgent
    ) public initializer {
        require(_admin != address(0), "Invalid admin address");
        require(_zkVerifier != address(0), "Invalid ZK verifier address");
        require(_dataVault != address(0), "Invalid data vault address");
        require(_alithAgent != address(0), "Invalid Alith agent address");

        __AccessControl_init();
        __ReentrancyGuard_init();
        __Pausable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);

        zkVerifier = IZKProofVerifier(_zkVerifier);
        dataVault = IDataVault(_dataVault);
        alithAgent = IAlithAgent(_alithAgent);

        nextJobId = 1;
    }

    /**
     * @dev Register a new data provider
     * @param _provider Provider address
     * @param _initialReputation Initial reputation score
     */
    function registerDataProvider(
        address _provider,
        uint256 _initialReputation
    ) external onlyRole(ADMIN_ROLE) {
        require(_provider != address(0), "Invalid provider address");
        require(!dataProviders[_provider].isActive, "Provider already registered");

        dataProviders[_provider] = DataProvider({
            provider: _provider,
            reputation: _initialReputation,
            isActive: true,
            totalContributions: 0
        });

        emit DataProviderRegistered(_provider, _initialReputation);
    }

    /**
     * @dev Allocate privacy budget for a dataset
     * @param _datasetHash Hash of the dataset
     * @param _epsilon Privacy budget epsilon value
     */
    function allocatePrivacyBudget(
        bytes32 _datasetHash,
        uint256 _epsilon
    ) external onlyRole(ADMIN_ROLE) {
        require(_datasetHash != bytes32(0), "Invalid dataset hash");
        require(_epsilon > 0, "Epsilon must be positive");

        privacyBudgets[_datasetHash] = PrivacyBudget({
            epsilon: _epsilon,
            consumed: 0,
            allocated: _epsilon,
            resetTimestamp: block.timestamp + PRIVACY_BUDGET_RESET_PERIOD
        });

        emit PrivacyBudgetAllocated(_datasetHash, _epsilon, block.timestamp);
    }

    /**
     * @dev Submit an analytics job request
     * @param _datasetHash Hash of the dataset to analyze
     * @param _circuitHash Hash of the analysis circuit
     * @param _epsilonRequired Required privacy budget
     * @return jobId The created job ID
     */
    function submitAnalyticsJob(
        bytes32 _datasetHash,
        bytes32 _circuitHash,
        uint256 _epsilonRequired
    ) external whenNotPaused sufficientPrivacyBudget(_datasetHash, _epsilonRequired) returns (uint256 jobId) {
        require(_datasetHash != bytes32(0), "Invalid dataset hash");
        require(_circuitHash != bytes32(0), "Invalid circuit hash");
        require(_epsilonRequired > 0, "Epsilon required must be positive");

        jobId = nextJobId++;
        totalJobs++;

        analyticsJobs[jobId] = AnalyticsJob({
            id: jobId,
            requester: msg.sender,
            datasetHash: _datasetHash,
            circuitHash: _circuitHash,
            timestamp: block.timestamp,
            status: JobStatus.Pending,
            resultHash: bytes32(0),
            proofValidated: 0
        });

        // Reserve privacy budget
        privacyBudgets[_datasetHash].consumed += _epsilonRequired;

        emit AnalyticsJobCreated(jobId, msg.sender, _datasetHash);
    }

    /**
     * @dev Submit a zero-knowledge proof for verification
     * @param _jobId Job ID
     * @param _proof ZK-SNARK proof
     * @param _publicInputs Public inputs for the proof
     * @param _resultHash Hash of the analytics result
     */
    function submitProof(
        uint256 _jobId,
        bytes calldata _proof,
        uint256[] calldata _publicInputs,
        bytes32 _resultHash
    ) external onlyRole(VERIFIER_ROLE) validJob(_jobId) {
        AnalyticsJob storage job = analyticsJobs[_jobId];
        require(job.status == JobStatus.Processing, "Job not in processing state");

        // Verify the ZK proof
        bool isValid = zkVerifier.verifyProof(
            _proof,
            _publicInputs,
            job.circuitHash
        );

        if (isValid) {
            job.status = JobStatus.Verified;
            job.resultHash = _resultHash;
            job.proofValidated = block.timestamp;

            emit AnalyticsResultGenerated(_jobId, _resultHash, block.timestamp);
        } else {
            job.status = JobStatus.Failed;
        }

        emit ProofSubmitted(_jobId, keccak256(_proof), isValid);
    }

    /**
     * @dev Process analytics job using Alith AI agent
     * @param _jobId Job ID to process
     */
    function processJobWithAlith(uint256 _jobId) external onlyRole(ANALYTICS_ROLE) validJob(_jobId) {
        AnalyticsJob storage job = analyticsJobs[_jobId];
        require(job.status == JobStatus.Pending, "Job already processed");

        job.status = JobStatus.Processing;

        // Trigger Alith AI agent processing
        alithAgent.processAnalyticsJob(
            _jobId,
            job.datasetHash,
            job.circuitHash
        );
    }

    /**
     * @dev Get analytics job details
     * @param _jobId Job ID
     * @return job Analytics job details
     */
    function getAnalyticsJob(uint256 _jobId) external view validJob(_jobId) returns (
        uint256 id,
        address requester,
        bytes32 datasetHash,
        bytes32 circuitHash,
        uint256 timestamp,
        JobStatus status,
        bytes32 resultHash,
        uint256 proofValidated
    ) {
        AnalyticsJob storage job = analyticsJobs[_jobId];
        return (
            job.id,
            job.requester,
            job.datasetHash,
            job.circuitHash,
            job.timestamp,
            job.status,
            job.resultHash,
            job.proofValidated
        );
    }

    /**
     * @dev Get privacy budget for a dataset
     * @param _datasetHash Dataset hash
     * @return budget Privacy budget details
     */
    function getPrivacyBudget(bytes32 _datasetHash) external view returns (
        uint256 epsilon,
        uint256 consumed,
        uint256 allocated,
        uint256 resetTimestamp
    ) {
        PrivacyBudget storage budget = privacyBudgets[_datasetHash];
        return (budget.epsilon, budget.consumed, budget.allocated, budget.resetTimestamp);
    }

    /**
     * @dev Reset privacy budget for a dataset (after reset period)
     * @param _datasetHash Dataset hash
     */
    function resetPrivacyBudget(bytes32 _datasetHash) external onlyRole(ADMIN_ROLE) {
        PrivacyBudget storage budget = privacyBudgets[_datasetHash];
        require(block.timestamp >= budget.resetTimestamp, "Reset period not reached");

        budget.consumed = 0;
        budget.resetTimestamp = block.timestamp + PRIVACY_BUDGET_RESET_PERIOD;
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Update external contract addresses
     * @param _zkVerifier New ZK verifier address
     * @param _dataVault New data vault address
     * @param _alithAgent New Alith agent address
     */
    function updateContracts(
        address _zkVerifier,
        address _dataVault,
        address _alithAgent
    ) external onlyRole(ADMIN_ROLE) {
        if (_zkVerifier != address(0)) {
            zkVerifier = IZKProofVerifier(_zkVerifier);
        }
        if (_dataVault != address(0)) {
            dataVault = IDataVault(_dataVault);
        }
        if (_alithAgent != address(0)) {
            alithAgent = IAlithAgent(_alithAgent);
        }
    }

    /**
     * @dev Get contract version
     * @return version Contract version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 