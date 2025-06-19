// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDataVault
 * @dev Interface for encrypted data storage vault
 */
interface IDataVault {
    struct DataRecord {
        bytes32 hash;
        address owner;
        uint256 timestamp;
        bytes32 encryptionKey;
        bool isPublic;
        mapping(address => bool) accessList;
    }

    /**
     * @dev Store encrypted data
     * @param dataHash Hash of the data
     * @param encryptionKey Key for data encryption
     * @param isPublic Whether data is publicly accessible
     * @return success True if data stored successfully
     */
    function storeData(
        bytes32 dataHash,
        bytes32 encryptionKey,
        bool isPublic
    ) external returns (bool success);

    /**
     * @dev Grant access to data
     * @param dataHash Hash of the data
     * @param accessor Address to grant access to
     */
    function grantAccess(bytes32 dataHash, address accessor) external;

    /**
     * @dev Revoke access to data
     * @param dataHash Hash of the data
     * @param accessor Address to revoke access from
     */
    function revokeAccess(bytes32 dataHash, address accessor) external;

    /**
     * @dev Check if address has access to data
     * @param dataHash Hash of the data
     * @param accessor Address to check
     * @return hasAccess True if access is granted
     */
    function hasAccess(bytes32 dataHash, address accessor) external view returns (bool hasAccess);

    /**
     * @dev Get data owner
     * @param dataHash Hash of the data
     * @return owner Address of the data owner
     */
    function getDataOwner(bytes32 dataHash) external view returns (address owner);

    /**
     * @dev Check if data exists
     * @param dataHash Hash of the data
     * @return exists True if data exists
     */
    function dataExists(bytes32 dataHash) external view returns (bool exists);
} 