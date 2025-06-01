// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IParallelExecutor
 * @dev Interface for Hyperion's Parallel Execution Framework (PEF)
 * @notice Enables parallel transaction processing and conflict resolution
 */
interface IParallelExecutor {
    /**
     * @dev Represents execution result for parallel processing
     */
    struct ExecutionResult {
        bool success;
        bytes returnData;
        uint256 gasUsed;
        bytes32 stateRoot;
    }

    /**
     * @dev Represents a parallel execution batch
     */
    struct ParallelBatch {
        address[] targets;
        bytes[] callData;
        uint256[] values;
        bytes32 batchId;
    }

    /**
     * @dev Event emitted when parallel execution is completed
     * @param batchId Unique identifier for the batch
     * @param successCount Number of successful executions
     * @param conflicts Number of conflicts detected
     * @param totalGasUsed Total gas consumed
     */
    event ParallelExecutionCompleted(
        bytes32 indexed batchId,
        uint256 successCount,
        uint256 conflicts,
        uint256 totalGasUsed
    );

    /**
     * @dev Event emitted when execution conflict is resolved
     * @param txHash1 First conflicting transaction
     * @param txHash2 Second conflicting transaction
     * @param resolution Resolution method used
     */
    event ConflictResolved(
        bytes32 indexed txHash1,
        bytes32 indexed txHash2,
        uint8 resolution
    );

    /**
     * @dev Executes multiple transactions in parallel
     * @param batch The parallel batch to execute
     * @return results Array of execution results
     */
    function executeParallel(ParallelBatch calldata batch) 
        external 
        returns (ExecutionResult[] memory results);

    /**
     * @dev Pre-processes transactions for parallel execution using static analysis
     * @param transactions Array of transaction data to analyze
     * @return dependencies DAG representation of transaction dependencies
     * @return canParallelize Boolean array indicating which transactions can run in parallel
     */
    function preprocessTransactions(bytes[] calldata transactions) 
        external 
        view 
        returns (bytes32[] memory dependencies, bool[] memory canParallelize);

    /**
     * @dev Detects conflicts between parallel executions
     * @param stateAccess1 State access pattern of first execution
     * @param stateAccess2 State access pattern of second execution
     * @return hasConflict True if conflict detected
     * @return conflictType Type of conflict (0=none, 1=read-write, 2=write-write)
     */
    function detectConflict(
        bytes32[] calldata stateAccess1,
        bytes32[] calldata stateAccess2
    ) external pure returns (bool hasConflict, uint8 conflictType);

    /**
     * @dev Resolves conflicts using optimistic concurrency control
     * @param conflictingTxs Array of conflicting transaction hashes
     * @param resolutionStrategy Strategy for conflict resolution
     * @return resolvedOrder Final execution order after conflict resolution
     */
    function resolveConflicts(
        bytes32[] calldata conflictingTxs,
        uint8 resolutionStrategy
    ) external returns (bytes32[] memory resolvedOrder);

    /**
     * @dev Gets the current parallel execution capacity
     * @return maxParallel Maximum number of parallel executions
     * @return currentLoad Current execution load
     */
    function getExecutionCapacity() external view returns (uint256 maxParallel, uint256 currentLoad);

    /**
     * @dev Schedules transactions for parallel execution using DAG
     * @param txHashes Array of transaction hashes to schedule
     * @param priorities Priority levels for each transaction
     * @return schedule Optimized execution schedule
     */
    function scheduleExecution(
        bytes32[] calldata txHashes,
        uint256[] calldata priorities
    ) external returns (bytes32[][] memory schedule);

    /**
     * @dev Enables speculative execution for a transaction
     * @param txHash Transaction hash to execute speculatively
     * @param assumptions State assumptions for speculation
     * @return speculativeResult Result of speculative execution
     */
    function speculativeExecute(
        bytes32 txHash,
        bytes32[] calldata assumptions
    ) external returns (ExecutionResult memory speculativeResult);

    /**
     * @dev Commits speculative execution results if assumptions hold
     * @param speculativeResults Array of speculative results to commit
     * @param validationProofs Proofs that assumptions still hold
     * @return committed Boolean array indicating which results were committed
     */
    function commitSpeculative(
        ExecutionResult[] calldata speculativeResults,
        bytes[] calldata validationProofs
    ) external returns (bool[] memory committed);
} 