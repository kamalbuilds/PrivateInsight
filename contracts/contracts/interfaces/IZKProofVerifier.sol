// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IZKProofVerifier
 * @dev Interface for zero-knowledge proof verification
 */
interface IZKProofVerifier {
    /**
     * @dev Verify a zk-SNARK proof
     * @param proof The proof bytes
     * @param publicInputs Public inputs array
     * @param circuitHash Hash of the circuit used
     * @return valid True if proof is valid
     */
    function verifyProof(
        bytes calldata proof,
        uint256[] calldata publicInputs,
        bytes32 circuitHash
    ) external view returns (bool valid);

    /**
     * @dev Register a new verification key for a circuit
     * @param circuitHash Hash of the circuit
     * @param verifyingKey The verification key
     */
    function registerVerificationKey(
        bytes32 circuitHash,
        bytes calldata verifyingKey
    ) external;

    /**
     * @dev Check if a circuit is registered
     * @param circuitHash Hash of the circuit
     * @return registered True if circuit is registered
     */
    function isCircuitRegistered(bytes32 circuitHash) external view returns (bool registered);
} 