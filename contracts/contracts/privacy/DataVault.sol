// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "../interfaces/IDataVault.sol";

/**
 * @title DataVault
 * @dev Secure vault for encrypted data storage with access control
 */
contract DataVault is Initializable, AccessControlUpgradeable, ReentrancyGuardUpgradeable, IDataVault {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant DATA_MANAGER_ROLE = keccak256("DATA_MANAGER_ROLE");

    struct DataRecord {
        bytes32 hash;
        address owner;
        uint256 timestamp;
        bytes32 encryptionKey;
        bool isPublic;
        bool exists;
        string ipfsHash;
        uint256 size;
        string dataType;
    }

    mapping(bytes32 => DataRecord) private dataRecords;
    mapping(bytes32 => mapping(address => bool)) private accessPermissions;
    mapping(address => bytes32[]) private userDatasets;
    mapping(string => bytes32[]) private dataTypeIndex;

    uint256 public totalDatasets;
    uint256 public constant MAX_DATA_SIZE = 1000000; // 1MB limit

    event DataStored(
        bytes32 indexed dataHash,
        address indexed owner,
        string dataType,
        uint256 timestamp
    );

    event AccessGranted(
        bytes32 indexed dataHash,
        address indexed owner,
        address indexed accessor
    );

    event AccessRevoked(
        bytes32 indexed dataHash,
        address indexed owner,
        address indexed accessor
    );

    event DataUpdated(
        bytes32 indexed dataHash,
        address indexed owner,
        uint256 timestamp
    );

    modifier onlyDataOwner(bytes32 _dataHash) {
        require(dataRecords[_dataHash].owner == msg.sender, "Not data owner");
        _;
    }

    modifier dataExists(bytes32 _dataHash) {
        require(dataRecords[_dataHash].exists, "Data does not exist");
        _;
    }

    modifier validDataHash(bytes32 _dataHash) {
        require(_dataHash != bytes32(0), "Invalid data hash");
        _;
    }

    /**
     * @dev Initialize the contract
     * @param _admin Admin address
     */
    function initialize(address _admin) public initializer {
        require(_admin != address(0), "Invalid admin address");

        __AccessControl_init();
        __ReentrancyGuard_init();

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
    }

    /**
     * @dev Store encrypted data with metadata
     * @param dataHash Hash of the data
     * @param encryptionKey Key for data encryption
     * @param isPublic Whether data is publicly accessible
     * @param ipfsHash IPFS hash for off-chain storage
     * @param size Size of the data
     * @param dataType Type of the data
     * @return success True if data stored successfully
     */
    function storeDataWithMetadata(
        bytes32 dataHash,
        bytes32 encryptionKey,
        bool isPublic,
        string calldata ipfsHash,
        uint256 size,
        string calldata dataType
    ) external validDataHash(dataHash) nonReentrant returns (bool success) {
        require(!dataRecords[dataHash].exists, "Data already exists");
        require(size <= MAX_DATA_SIZE, "Data size exceeds limit");
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");
        require(bytes(dataType).length > 0, "Invalid data type");

        dataRecords[dataHash] = DataRecord({
            hash: dataHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            encryptionKey: encryptionKey,
            isPublic: isPublic,
            exists: true,
            ipfsHash: ipfsHash,
            size: size,
            dataType: dataType
        });

        userDatasets[msg.sender].push(dataHash);
        dataTypeIndex[dataType].push(dataHash);
        totalDatasets++;

        emit DataStored(dataHash, msg.sender, dataType, block.timestamp);
        return true;
    }

    /**
     * @dev Store encrypted data (legacy function for interface compatibility)
     * @param dataHash Hash of the data
     * @param encryptionKey Key for data encryption
     * @param isPublic Whether data is publicly accessible
     * @return success True if data stored successfully
     */
    function storeData(
        bytes32 dataHash,
        bytes32 encryptionKey,
        bool isPublic
    ) external override validDataHash(dataHash) nonReentrant returns (bool success) {
        require(!dataRecords[dataHash].exists, "Data already exists");

        dataRecords[dataHash] = DataRecord({
            hash: dataHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            encryptionKey: encryptionKey,
            isPublic: isPublic,
            exists: true,
            ipfsHash: "",
            size: 0,
            dataType: "unknown"
        });

        userDatasets[msg.sender].push(dataHash);
        totalDatasets++;

        emit DataStored(dataHash, msg.sender, "unknown", block.timestamp);
        return true;
    }

    /**
     * @dev Grant access to data
     * @param dataHash Hash of the data
     * @param accessor Address to grant access to
     */
    function grantAccess(bytes32 dataHash, address accessor) 
        external 
        override 
        dataExists(dataHash) 
        onlyDataOwner(dataHash) 
    {
        require(accessor != address(0), "Invalid accessor address");
        require(accessor != msg.sender, "Cannot grant access to self");

        accessPermissions[dataHash][accessor] = true;
        emit AccessGranted(dataHash, msg.sender, accessor);
    }

    /**
     * @dev Revoke access to data
     * @param dataHash Hash of the data
     * @param accessor Address to revoke access from
     */
    function revokeAccess(bytes32 dataHash, address accessor) 
        external 
        override 
        dataExists(dataHash) 
        onlyDataOwner(dataHash) 
    {
        require(accessor != address(0), "Invalid accessor address");
        require(accessPermissions[dataHash][accessor], "Access not granted");

        accessPermissions[dataHash][accessor] = false;
        emit AccessRevoked(dataHash, msg.sender, accessor);
    }

    /**
     * @dev Batch grant access to multiple users
     * @param dataHash Hash of the data
     * @param accessors Array of addresses to grant access to
     */
    function batchGrantAccess(bytes32 dataHash, address[] calldata accessors)
        external
        dataExists(dataHash)
        onlyDataOwner(dataHash)
    {
        require(accessors.length > 0, "No accessors provided");
        require(accessors.length <= 50, "Too many accessors");

        for (uint256 i = 0; i < accessors.length; i++) {
            address accessor = accessors[i];
            if (accessor != address(0) && accessor != msg.sender) {
                accessPermissions[dataHash][accessor] = true;
                emit AccessGranted(dataHash, msg.sender, accessor);
            }
        }
    }

    /**
     * @dev Check if address has access to data
     * @param dataHash Hash of the data
     * @param accessor Address to check
     * @return hasAccess True if access is granted
     */
    function hasAccess(bytes32 dataHash, address accessor) 
        external 
        view 
        override 
        dataExists(dataHash) 
        returns (bool hasAccess) 
    {
        DataRecord storage record = dataRecords[dataHash];
        
        // Owner always has access
        if (record.owner == accessor) {
            return true;
        }
        
        // Public data is accessible to everyone
        if (record.isPublic) {
            return true;
        }
        
        // Check explicit permissions
        return accessPermissions[dataHash][accessor];
    }

    /**
     * @dev Get data owner
     * @param dataHash Hash of the data
     * @return owner Address of the data owner
     */
    function getDataOwner(bytes32 dataHash) 
        external 
        view 
        override 
        dataExists(dataHash) 
        returns (address owner) 
    {
        return dataRecords[dataHash].owner;
    }

    /**
     * @dev Check if data exists
     * @param dataHash Hash of the data
     * @return exists True if data exists
     */
    function dataExists(bytes32 dataHash) external view override returns (bool exists) {
        return dataRecords[dataHash].exists;
    }

    /**
     * @dev Get detailed data information
     * @param dataHash Hash of the data
     * @return record Complete data record
     */
    function getDataRecord(bytes32 dataHash) 
        external 
        view 
        dataExists(dataHash) 
        returns (
            address owner,
            uint256 timestamp,
            bool isPublic,
            string memory ipfsHash,
            uint256 size,
            string memory dataType
        ) 
    {
        DataRecord storage record = dataRecords[dataHash];
        return (
            record.owner,
            record.timestamp,
            record.isPublic,
            record.ipfsHash,
            record.size,
            record.dataType
        );
    }

    /**
     * @dev Get encryption key (only for authorized users)
     * @param dataHash Hash of the data
     * @return encryptionKey The encryption key
     */
    function getEncryptionKey(bytes32 dataHash) 
        external 
        view 
        dataExists(dataHash) 
        returns (bytes32 encryptionKey) 
    {
        require(this.hasAccess(dataHash, msg.sender), "Access denied");
        return dataRecords[dataHash].encryptionKey;
    }

    /**
     * @dev Get user's datasets
     * @param user User address
     * @return datasets Array of dataset hashes owned by user
     */
    function getUserDatasets(address user) external view returns (bytes32[] memory datasets) {
        return userDatasets[user];
    }

    /**
     * @dev Get datasets by type
     * @param dataType Type of data
     * @return datasets Array of dataset hashes of specified type
     */
    function getDatasetsByType(string calldata dataType) external view returns (bytes32[] memory datasets) {
        return dataTypeIndex[dataType];
    }

    /**
     * @dev Update data metadata (owner only)
     * @param dataHash Hash of the data
     * @param newIpfsHash New IPFS hash
     * @param newDataType New data type
     */
    function updateDataMetadata(
        bytes32 dataHash,
        string calldata newIpfsHash,
        string calldata newDataType
    ) external dataExists(dataHash) onlyDataOwner(dataHash) {
        require(bytes(newIpfsHash).length > 0, "Invalid IPFS hash");
        require(bytes(newDataType).length > 0, "Invalid data type");

        DataRecord storage record = dataRecords[dataHash];
        
        // Update type index if type changed
        if (keccak256(bytes(record.dataType)) != keccak256(bytes(newDataType))) {
            // Remove from old type index
            _removeFromTypeIndex(record.dataType, dataHash);
            // Add to new type index
            dataTypeIndex[newDataType].push(dataHash);
        }

        record.ipfsHash = newIpfsHash;
        record.dataType = newDataType;

        emit DataUpdated(dataHash, msg.sender, block.timestamp);
    }

    /**
     * @dev Remove data (owner only)
     * @param dataHash Hash of the data to remove
     */
    function removeData(bytes32 dataHash) 
        external 
        dataExists(dataHash) 
        onlyDataOwner(dataHash) 
    {
        DataRecord storage record = dataRecords[dataHash];
        
        // Remove from type index
        _removeFromTypeIndex(record.dataType, dataHash);
        
        // Remove from user datasets
        _removeFromUserDatasets(msg.sender, dataHash);
        
        // Clear all access permissions
        // Note: In practice, we'd need to track all granted permissions to clear them
        
        delete dataRecords[dataHash];
        totalDatasets--;
    }

    /**
     * @dev Internal function to remove data hash from type index
     * @param dataType Type to remove from
     * @param dataHash Hash to remove
     */
    function _removeFromTypeIndex(string memory dataType, bytes32 dataHash) internal {
        bytes32[] storage typeArray = dataTypeIndex[dataType];
        for (uint256 i = 0; i < typeArray.length; i++) {
            if (typeArray[i] == dataHash) {
                typeArray[i] = typeArray[typeArray.length - 1];
                typeArray.pop();
                break;
            }
        }
    }

    /**
     * @dev Internal function to remove data hash from user datasets
     * @param user User address
     * @param dataHash Hash to remove
     */
    function _removeFromUserDatasets(address user, bytes32 dataHash) internal {
        bytes32[] storage userArray = userDatasets[user];
        for (uint256 i = 0; i < userArray.length; i++) {
            if (userArray[i] == dataHash) {
                userArray[i] = userArray[userArray.length - 1];
                userArray.pop();
                break;
            }
        }
    }

    /**
     * @dev Get total number of datasets
     * @return total Total datasets count
     */
    function getTotalDatasets() external view returns (uint256 total) {
        return totalDatasets;
    }

    /**
     * @dev Get contract version
     * @return version Contract version string
     */
    function version() external pure returns (string memory) {
        return "1.0.0";
    }
} 