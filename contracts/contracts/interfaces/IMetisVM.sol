// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IMetisVM
 * @dev Interface for MetisVM AI inference and optimization capabilities
 * @notice This interface provides access to Hyperion's on-chain AI infrastructure
 */
interface IMetisVM {
    /**
     * @dev Event emitted when AI inference is completed
     * @param modelId The identifier of the AI model used
     * @param inputHash Hash of the input data
     * @param result The inference result
     * @param gasUsed Gas consumed for the inference
     */
    event AIInferenceCompleted(
        bytes32 indexed modelId,
        bytes32 indexed inputHash,
        uint256 result,
        uint256 gasUsed
    );

    /**
     * @dev Event emitted when opcode optimization is applied
     * @param contractAddress Address of the optimized contract
     * @param optimizationType Type of optimization applied
     * @param gasSaved Amount of gas saved
     */
    event OpcodeOptimized(
        address indexed contractAddress,
        uint8 optimizationType,
        uint256 gasSaved
    );

    /**
     * @dev Executes AI inference on-chain using MetisVM's AI infrastructure
     * @param modelData Encoded model parameters and input data
     * @return prediction The AI model's prediction result
     */
    function inferenceCall(bytes calldata modelData) external returns (uint256 prediction);

    /**
     * @dev Executes batch AI inference for multiple predictions
     * @param batchData Array of encoded model data for batch processing
     * @return predictions Array of prediction results
     */
    function batchInference(bytes[] calldata batchData) external returns (uint256[] memory predictions);

    /**
     * @dev Gets the current state cache for optimized state access
     * @param key The state key to retrieve
     * @return value The cached state value
     * @return lastUpdated Timestamp of last cache update
     */
    function getStateCache(bytes32 key) external view returns (bytes32 value, uint256 lastUpdated);

    /**
     * @dev Updates state cache with new value
     * @param key The state key to update
     * @param value The new state value
     */
    function updateStateCache(bytes32 key, bytes32 value) external;

    /**
     * @dev Enables dynamic opcode optimization for a contract
     * @param contractAddress Address of the contract to optimize
     * @param optimizationLevel Level of optimization (1-5)
     */
    function enableOptimization(address contractAddress, uint8 optimizationLevel) external;

    /**
     * @dev Gets the current gas optimization multiplier
     * @return multiplier The current gas optimization factor (in basis points)
     */
    function getOptimizationMultiplier() external view returns (uint256 multiplier);

    /**
     * @dev Registers a custom AI model for use in inference
     * @param modelHash Hash of the model parameters
     * @param modelType Type of the AI model (1=CNN-LSTM, 2=GNN, 3=Transformer)
     * @param computeRequirement Estimated compute requirement in gas
     * @return modelId The registered model identifier
     */
    function registerAIModel(
        bytes32 modelHash,
        uint8 modelType,
        uint256 computeRequirement
    ) external returns (bytes32 modelId);

    /**
     * @dev Executes parallel inference across multiple models
     * @param modelIds Array of model identifiers to use
     * @param inputData Input data for inference
     * @return results Array of results from each model
     * @return confidence Confidence scores for each result
     */
    function parallelInference(
        bytes32[] calldata modelIds,
        bytes calldata inputData
    ) external returns (uint256[] memory results, uint256[] memory confidence);
} 