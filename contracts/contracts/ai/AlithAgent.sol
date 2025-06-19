// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IAlithAgent.sol";

/**
 * @title AlithAgent
 * @dev Contract for managing Alith AI agents and inference operations
 */
contract AlithAgent is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, IAlithAgent {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AI_OPERATOR_ROLE = keccak256("AI_OPERATOR_ROLE");
    bytes32 public constant INFERENCE_ROLE = keccak256("INFERENCE_ROLE");

    struct AIModel {
        string name;
        string version;
        bytes32 modelHash;
        bool isActive;
        uint256 computeCost;
        address provider;
        uint256 totalInferences;
        uint256 successfulInferences;
        string ipfsHash;
        uint256 timestamp;
    }

    struct InferenceJob {
        uint256 id;
        bytes32 modelHash;
        address requester;
        bytes32 inputHash;
        bytes32 outputHash;
        uint256 timestamp;
        JobStatus status;
        uint256 computeCost;
    }

    enum JobStatus {
        Pending,
        Processing,
        Completed,
        Failed
    }

    mapping(bytes32 => AIModel) public aiModels;
    mapping(uint256 => InferenceJob) public inferenceJobs;
    mapping(address => uint256[]) public userJobs;
    mapping(bytes32 => uint256[]) public modelJobs;
    
    uint256 public nextJobId;
    uint256 public totalModels;
    uint256 public totalInferences;
    
    address public alithOracle;
    string public alithApiEndpoint;

    event AIModelRegistered(
        bytes32 indexed modelHash,
        string name,
        address indexed provider,
        uint256 timestamp
    );

    event InferenceJobCreated(
        uint256 indexed jobId,
        bytes32 indexed modelHash,
        address indexed requester,
        uint256 timestamp
    );

    event InferenceCompleted(
        uint256 indexed jobId,
        bytes32 indexed modelHash,
        bytes32 outputHash,
        uint256 timestamp
    );

    event ModelStatusUpdated(
        bytes32 indexed modelHash,
        bool isActive,
        uint256 timestamp
    );

    event AnalyticsJobProcessed(
        uint256 indexed analyticsJobId,
        bytes32 indexed datasetHash,
        bytes32 indexed circuitHash,
        uint256 inferenceJobId
    );

    modifier onlyActiveModel(bytes32 _modelHash) {
        require(aiModels[_modelHash].isActive, "Model is not active");
        _;
    }

    modifier onlyModelProvider(bytes32 _modelHash) {
        require(aiModels[_modelHash].provider == msg.sender, "Not model provider");
        _;
    }

    modifier validModel(bytes32 _modelHash) {
        require(aiModels[_modelHash].modelHash != bytes32(0), "Model does not exist");
        _;
    }

    /**
     * @dev Initialize the contract
     * @param _admin Admin address
     * @param _alithOracle Alith oracle address for off-chain communication
     * @param _alithApiEndpoint Alith API endpoint
     */
    function initialize(
        address _admin,
        address _alithOracle,
        string calldata _alithApiEndpoint
    ) public initializer {
        require(_admin != address(0), "Invalid admin address");
        require(_alithOracle != address(0), "Invalid oracle address");
        require(bytes(_alithApiEndpoint).length > 0, "Invalid API endpoint");

        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);

        alithOracle = _alithOracle;
        alithApiEndpoint = _alithApiEndpoint;
        nextJobId = 1;
    }

    /**
     * @dev Register a new AI model
     * @param name Model name
     * @param version Model version
     * @param modelHash Hash of the model
     * @param computeCost Cost for computation
     * @param ipfsHash IPFS hash for model storage
     */
    function registerAIModel(
        string calldata name,
        string calldata version,
        bytes32 modelHash,
        uint256 computeCost,
        string calldata ipfsHash
    ) external {
        require(bytes(name).length > 0, "Invalid model name");
        require(bytes(version).length > 0, "Invalid model version");
        require(modelHash != bytes32(0), "Invalid model hash");
        require(aiModels[modelHash].modelHash == bytes32(0), "Model already exists");
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");

        aiModels[modelHash] = AIModel({
            name: name,
            version: version,
            modelHash: modelHash,
            isActive: true,
            computeCost: computeCost,
            provider: msg.sender,
            totalInferences: 0,
            successfulInferences: 0,
            ipfsHash: ipfsHash,
            timestamp: block.timestamp
        });

        totalModels++;
        emit AIModelRegistered(modelHash, name, msg.sender, block.timestamp);
    }

    /**
     * @dev Register a new AI model (interface compatibility)
     * @param name Model name
     * @param version Model version
     * @param modelHash Hash of the model
     * @param computeCost Cost for computation
     */
    function registerAIModel(
        string calldata name,
        string calldata version,
        bytes32 modelHash,
        uint256 computeCost
    ) external override {
        require(bytes(name).length > 0, "Invalid model name");
        require(bytes(version).length > 0, "Invalid model version");
        require(modelHash != bytes32(0), "Invalid model hash");
        require(aiModels[modelHash].modelHash == bytes32(0), "Model already exists");

        aiModels[modelHash] = AIModel({
            name: name,
            version: version,
            modelHash: modelHash,
            isActive: true,
            computeCost: computeCost,
            provider: msg.sender,
            totalInferences: 0,
            successfulInferences: 0,
            ipfsHash: "",
            timestamp: block.timestamp
        });

        totalModels++;
        emit AIModelRegistered(modelHash, name, msg.sender, block.timestamp);
    }

    /**
     * @dev Process analytics job using AI
     * @param jobId Job identifier from analytics platform
     * @param datasetHash Hash of the dataset
     * @param circuitHash Hash of the circuit
     */
    function processAnalyticsJob(
        uint256 jobId,
        bytes32 datasetHash,
        bytes32 circuitHash
    ) external override onlyRole(INFERENCE_ROLE) {
        require(datasetHash != bytes32(0), "Invalid dataset hash");
        require(circuitHash != bytes32(0), "Invalid circuit hash");

        // Create input hash from dataset and circuit
        bytes32 inputHash = keccak256(abi.encodePacked(datasetHash, circuitHash));
        
        // Use default analytics model (to be registered by admin)
        bytes32 analyticsModelHash = keccak256("PRIVATE_ANALYTICS_MODEL_V1");
        
        // Create inference job
        uint256 inferenceJobId = _createInferenceJob(
            analyticsModelHash,
            msg.sender,
            inputHash
        );

        emit AnalyticsJobProcessed(jobId, datasetHash, circuitHash, inferenceJobId);
    }

    /**
     * @dev Execute AI inference
     * @param modelHash Hash of the model to use
     * @param inputData Input data for inference
     * @return result Inference result
     */
    function executeInference(
        bytes32 modelHash,
        bytes calldata inputData
    ) external override validModel(modelHash) onlyActiveModel(modelHash) nonReentrant returns (bytes memory result) {
        require(inputData.length > 0, "Invalid input data");

        bytes32 inputHash = keccak256(inputData);
        
        uint256 jobId = _createInferenceJob(modelHash, msg.sender, inputHash);
        
        // In a real implementation, this would trigger off-chain computation
        // For demonstration, we'll return a computed result hash
        bytes32 outputHash = keccak256(abi.encodePacked(inputHash, modelHash, block.timestamp));
        
        // Update job status
        inferenceJobs[jobId].status = JobStatus.Completed;
        inferenceJobs[jobId].outputHash = outputHash;

        // Update model statistics
        aiModels[modelHash].totalInferences++;
        aiModels[modelHash].successfulInferences++;
        totalInferences++;

        emit InferenceCompleted(jobId, modelHash, outputHash, block.timestamp);
        
        // Return the output hash as bytes
        return abi.encodePacked(outputHash);
    }

    /**
     * @dev Get AI model information
     * @param modelHash Hash of the model
     * @return model AI model details
     */
    function getAIModel(bytes32 modelHash) external view override validModel(modelHash) returns (AIModel memory model) {
        return aiModels[modelHash];
    }

    /**
     * @dev Update model status
     * @param modelHash Hash of the model
     * @param isActive New status
     */
    function updateModelStatus(bytes32 modelHash, bool isActive) 
        external 
        override 
        validModel(modelHash) 
        onlyModelProvider(modelHash) 
    {
        aiModels[modelHash].isActive = isActive;
        emit ModelStatusUpdated(modelHash, isActive, block.timestamp);
    }

    /**
     * @dev Get inference cost
     * @param modelHash Hash of the model
     * @param inputSize Size of input data
     * @return cost Estimated cost for inference
     */
    function getInferenceCost(
        bytes32 modelHash,
        uint256 inputSize
    ) external view override validModel(modelHash) returns (uint256 cost) {
        AIModel storage model = aiModels[modelHash];
        
        // Base cost plus size-dependent cost
        cost = model.computeCost + (inputSize * model.computeCost / 1000);
        
        return cost;
    }

    /**
     * @dev Internal function to create inference job
     * @param modelHash Hash of the model
     * @param requester Address of requester
     * @param inputHash Hash of input data
     * @return jobId Created job ID
     */
    function _createInferenceJob(
        bytes32 modelHash,
        address requester,
        bytes32 inputHash
    ) internal returns (uint256 jobId) {
        jobId = nextJobId++;
        
        uint256 cost = this.getInferenceCost(modelHash, 256); // Assume 256 bytes input
        
        inferenceJobs[jobId] = InferenceJob({
            id: jobId,
            modelHash: modelHash,
            requester: requester,
            inputHash: inputHash,
            outputHash: bytes32(0),
            timestamp: block.timestamp,
            status: JobStatus.Pending,
            computeCost: cost
        });

        userJobs[requester].push(jobId);
        modelJobs[modelHash].push(jobId);

        emit InferenceJobCreated(jobId, modelHash, requester, block.timestamp);
        return jobId;
    }

    /**
     * @dev Get inference job details
     * @param jobId Job ID
     * @return job Inference job details
     */
    function getInferenceJob(uint256 jobId) external view returns (
        uint256 id,
        bytes32 modelHash,
        address requester,
        bytes32 inputHash,
        bytes32 outputHash,
        uint256 timestamp,
        JobStatus status,
        uint256 computeCost
    ) {
        require(jobId < nextJobId, "Invalid job ID");
        InferenceJob storage job = inferenceJobs[jobId];
        
        return (
            job.id,
            job.modelHash,
            job.requester,
            job.inputHash,
            job.outputHash,
            job.timestamp,
            job.status,
            job.computeCost
        );
    }

    /**
     * @dev Get user's inference jobs
     * @param user User address
     * @return jobs Array of job IDs
     */
    function getUserJobs(address user) external view returns (uint256[] memory jobs) {
        return userJobs[user];
    }

    /**
     * @dev Get model's inference jobs
     * @param modelHash Model hash
     * @return jobs Array of job IDs
     */
    function getModelJobs(bytes32 modelHash) external view returns (uint256[] memory jobs) {
        return modelJobs[modelHash];
    }

    /**
     * @dev Update model compute cost (provider only)
     * @param modelHash Hash of the model
     * @param newCost New compute cost
     */
    function updateModelCost(
        bytes32 modelHash,
        uint256 newCost
    ) external validModel(modelHash) onlyModelProvider(modelHash) {
        aiModels[modelHash].computeCost = newCost;
    }

    /**
     * @dev Update Alith oracle address (admin only)
     * @param newOracle New oracle address
     */
    function updateAlithOracle(address newOracle) external onlyRole(ADMIN_ROLE) {
        require(newOracle != address(0), "Invalid oracle address");
        alithOracle = newOracle;
    }

    /**
     * @dev Update Alith API endpoint (admin only)
     * @param newEndpoint New API endpoint
     */
    function updateAlithApiEndpoint(string calldata newEndpoint) external onlyRole(ADMIN_ROLE) {
        require(bytes(newEndpoint).length > 0, "Invalid API endpoint");
        alithApiEndpoint = newEndpoint;
    }

    /**
     * @dev Get platform statistics
     * @return statistics Platform usage statistics
     */
    function getPlatformStats() external view returns (
        uint256 modelsCount,
        uint256 inferencesCount,
        uint256 activeModels
    ) {
        uint256 active = 0;
        // Note: In production, we'd maintain a separate counter for active models
        // This is a simplified version for demonstration
        
        return (totalModels, totalInferences, active);
    }

    /**
     * @dev Remove a model (admin only)
     * @param modelHash Hash of the model to remove
     */
    function removeModel(bytes32 modelHash) external onlyRole(ADMIN_ROLE) validModel(modelHash) {
        delete aiModels[modelHash];
        totalModels--;
    }

    /**
     * @dev Get contract version
     * @return version Contract version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 