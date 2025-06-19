// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAlithAgent
 * @dev Interface for Alith AI agent integration
 */
interface IAlithAgent {
    struct AIModel {
        string name;
        string version;
        bytes32 modelHash;
        bool isActive;
        uint256 computeCost;
    }

    /**
     * @dev Process analytics job using AI
     * @param jobId Job identifier
     * @param datasetHash Hash of the dataset
     * @param circuitHash Hash of the circuit
     */
    function processAnalyticsJob(
        uint256 jobId,
        bytes32 datasetHash,
        bytes32 circuitHash
    ) external;

    /**
     * @dev Register a new AI model
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
    ) external;

    /**
     * @dev Get AI model information
     * @param modelHash Hash of the model
     * @return model AI model details
     */
    function getAIModel(bytes32 modelHash) external view returns (AIModel memory model);

    /**
     * @dev Execute AI inference
     * @param modelHash Hash of the model to use
     * @param inputData Input data for inference
     * @return result Inference result
     */
    function executeInference(
        bytes32 modelHash,
        bytes calldata inputData
    ) external returns (bytes memory result);

    /**
     * @dev Update model status
     * @param modelHash Hash of the model
     * @param isActive New status
     */
    function updateModelStatus(bytes32 modelHash, bool isActive) external;

    /**
     * @dev Get inference cost
     * @param modelHash Hash of the model
     * @param inputSize Size of input data
     * @return cost Estimated cost for inference
     */
    function getInferenceCost(
        bytes32 modelHash,
        uint256 inputSize
    ) external view returns (uint256 cost);
} 