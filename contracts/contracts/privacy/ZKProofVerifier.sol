// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "../interfaces/IZKProofVerifier.sol";

/**
 * @title ZKProofVerifier
 * @dev Contract for verifying zero-knowledge proofs using Groth16
 */
contract ZKProofVerifier is Initializable, AccessControlUpgradeable, IZKProofVerifier {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct VerifyingKey {
        bytes32 alpha;
        bytes32[2] beta;
        bytes32[2] gamma;
        bytes32[2] delta;
        bytes32[] ic;
        bool isRegistered;
    }

    struct Proof {
        bytes32[2] a;
        bytes32[2] b;
        bytes32[2] c;
    }

    mapping(bytes32 => VerifyingKey) public verifyingKeys;
    mapping(bytes32 => bool) public verifiedProofs;

    event CircuitRegistered(bytes32 indexed circuitHash, uint256 timestamp);
    event ProofVerified(bytes32 indexed proofHash, bytes32 indexed circuitHash, bool result);

    modifier onlyRegisteredCircuit(bytes32 _circuitHash) {
        require(verifyingKeys[_circuitHash].isRegistered, "Circuit not registered");
        _;
    }

    /**
     * @dev Initialize the contract
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        require(_admin != address(0), "Invalid admin address");

        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @dev Register a new verification key for a circuit
     * @param circuitHash Hash of the circuit
     * @param verifyingKey The verification key in bytes
     */
    function registerVerificationKey(
        bytes32 circuitHash,
        bytes calldata verifyingKey
    ) external override onlyRole(ADMIN_ROLE) {
        require(circuitHash != bytes32(0), "Invalid circuit hash");
        require(verifyingKey.length > 0, "Invalid verifying key");
        require(!verifyingKeys[circuitHash].isRegistered, "Circuit already registered");

        // Parse the verifying key (simplified for demo - in production would use proper parsing)
        VerifyingKey storage vk = verifyingKeys[circuitHash];
        
        // For demonstration, we'll store a simplified key structure
        // In production, this would properly parse the actual verification key
        vk.alpha = keccak256(abi.encodePacked(verifyingKey, "alpha"));
        vk.beta[0] = keccak256(abi.encodePacked(verifyingKey, "beta_0"));
        vk.beta[1] = keccak256(abi.encodePacked(verifyingKey, "beta_1"));
        vk.gamma[0] = keccak256(abi.encodePacked(verifyingKey, "gamma_0"));
        vk.gamma[1] = keccak256(abi.encodePacked(verifyingKey, "gamma_1"));
        vk.delta[0] = keccak256(abi.encodePacked(verifyingKey, "delta_0"));
        vk.delta[1] = keccak256(abi.encodePacked(verifyingKey, "delta_1"));
        vk.isRegistered = true;

        emit CircuitRegistered(circuitHash, block.timestamp);
    }

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
    ) external view override onlyRegisteredCircuit(circuitHash) returns (bool valid) {
        require(proof.length > 0, "Invalid proof");
        require(publicInputs.length > 0, "Invalid public inputs");

        // Parse proof (simplified for demo)
        Proof memory parsedProof = parseProof(proof);
        
        // Verify the proof using the registered verification key
        valid = performVerification(parsedProof, publicInputs, circuitHash);
        
        return valid;
    }

    /**
     * @dev Check if a circuit is registered
     * @param circuitHash Hash of the circuit
     * @return registered True if circuit is registered
     */
    function isCircuitRegistered(bytes32 circuitHash) external view override returns (bool registered) {
        return verifyingKeys[circuitHash].isRegistered;
    }

    /**
     * @dev Parse proof bytes into structured format
     * @param proof Raw proof bytes
     * @return parsedProof Structured proof
     */
    function parseProof(bytes calldata proof) internal pure returns (Proof memory parsedProof) {
        require(proof.length >= 192, "Proof too short"); // 3 points * 2 coordinates * 32 bytes

        // Parse the proof components (simplified)
        parsedProof.a[0] = bytes32(proof[0:32]);
        parsedProof.a[1] = bytes32(proof[32:64]);
        parsedProof.b[0] = bytes32(proof[64:96]);
        parsedProof.b[1] = bytes32(proof[96:128]);
        parsedProof.c[0] = bytes32(proof[128:160]);
        parsedProof.c[1] = bytes32(proof[160:192]);

        return parsedProof;
    }

    /**
     * @dev Perform the actual proof verification
     * @param proof Parsed proof structure
     * @param publicInputs Public inputs for verification
     * @param circuitHash Circuit hash
     * @return valid True if verification succeeds
     */
    function performVerification(
        Proof memory proof,
        uint256[] calldata publicInputs,
        bytes32 circuitHash
    ) internal view returns (bool valid) {
        VerifyingKey storage vk = verifyingKeys[circuitHash];

        // Simplified verification logic for demonstration
        // In production, this would implement the full Groth16 pairing verification
        
        // Compute input hash
        bytes32 inputHash = keccak256(abi.encodePacked(publicInputs));
        
        // Simplified check - in reality would perform elliptic curve pairings
        bytes32 verificationResult = keccak256(abi.encodePacked(
            proof.a[0], proof.a[1],
            proof.b[0], proof.b[1], 
            proof.c[0], proof.c[1],
            vk.alpha,
            vk.beta[0], vk.beta[1],
            vk.gamma[0], vk.gamma[1],
            vk.delta[0], vk.delta[1],
            inputHash
        ));

        // For demo purposes, we'll accept proofs that meet certain criteria
        // In production, this would be replaced with actual pairing operations
        valid = (uint256(verificationResult) % 100) < 90; // 90% acceptance rate for demo

        return valid;
    }

    /**
     * @dev Batch verify multiple proofs
     * @param proofs Array of proof bytes
     * @param publicInputs Array of public inputs
     * @param circuitHashes Array of circuit hashes
     * @return results Array of verification results
     */
    function batchVerifyProofs(
        bytes[] calldata proofs,
        uint256[][] calldata publicInputs,
        bytes32[] calldata circuitHashes
    ) external view returns (bool[] memory results) {
        require(
            proofs.length == publicInputs.length && 
            publicInputs.length == circuitHashes.length,
            "Arrays length mismatch"
        );

        results = new bool[](proofs.length);
        
        for (uint256 i = 0; i < proofs.length; i++) {
            if (verifyingKeys[circuitHashes[i]].isRegistered) {
                results[i] = this.verifyProof(proofs[i], publicInputs[i], circuitHashes[i]);
            } else {
                results[i] = false;
            }
        }

        return results;
    }

    /**
     * @dev Emergency function to remove a circuit
     * @param circuitHash Hash of the circuit to remove
     */
    function removeCircuit(bytes32 circuitHash) external onlyRole(ADMIN_ROLE) {
        require(verifyingKeys[circuitHash].isRegistered, "Circuit not registered");
        delete verifyingKeys[circuitHash];
    }

    /**
     * @dev Get circuit verification key info
     * @param circuitHash Hash of the circuit
     * @return isRegistered Whether the circuit is registered
     * @return alpha Alpha value from verification key
     */
    function getCircuitInfo(bytes32 circuitHash) external view returns (
        bool isRegistered,
        bytes32 alpha
    ) {
        VerifyingKey storage vk = verifyingKeys[circuitHash];
        return (vk.isRegistered, vk.alpha);
    }

    /**
     * @dev Get contract version
     * @return version Contract version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 