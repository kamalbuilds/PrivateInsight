// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IMetisVM.sol";
import "../interfaces/IParallelExecutor.sol";

/**
 * @title FlashTradeCore
 * @dev AI-Powered Sub-Second DEX leveraging Hyperion's parallel execution and AI inference
 * @notice Main contract for FlashTrade DEX with predictive liquidity and MEV resistance
 */
contract FlashTradeCore is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Core interfaces for Hyperion integration
    IMetisVM public immutable metisVM;
    IParallelExecutor public immutable parallelExecutor;

    // AI Model IDs for different prediction types
    bytes32 public priceModelId;
    bytes32 public liquidityModelId;
    bytes32 public mevModelId;

    // Trading pair structure
    struct TradingPair {
        address tokenA;
        address tokenB;
        uint256 reserveA;
        uint256 reserveB;
        uint256 lastUpdateTime;
        bool isActive;
        uint256 totalLiquidity;
        uint256 feeRate; // in basis points (100 = 1%)
    }

    // AI Prediction structure
    struct AIPrediction {
        uint256 predictedPrice;
        uint256 confidence;
        uint256 timestamp;
        uint256 liquidityNeeded;
        bool mevRisk;
    }

    // Order structure for parallel execution
    struct TradeOrder {
        address trader;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        bytes32 predictionHash;
        bool isExecuted;
    }

    // State variables
    mapping(bytes32 => TradingPair) public tradingPairs;
    mapping(bytes32 => AIPrediction) public predictions;
    mapping(address => mapping(address => uint256)) public liquidity;
    mapping(bytes32 => TradeOrder) public orders;
    
    bytes32[] public activePairs;
    uint256 public constant MAX_FEE_RATE = 1000; // 10% max fee
    uint256 public constant PREDICTION_VALIDITY = 300; // 5 minutes
    uint256 public totalVolumeUSD;
    uint256 public totalTrades;

    // Events
    event PairCreated(bytes32 indexed pairId, address tokenA, address tokenB);
    event TradeExecuted(
        bytes32 indexed orderId,
        address indexed trader,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );
    event LiquidityAdded(
        bytes32 indexed pairId,
        address indexed provider,
        uint256 amountA,
        uint256 amountB,
        uint256 liquidity
    );
    event AIPredictionUpdated(
        bytes32 indexed pairId,
        uint256 predictedPrice,
        uint256 confidence,
        bool mevRisk
    );
    event ParallelTradesBatched(
        bytes32 indexed batchId,
        uint256 tradesCount,
        uint256 totalGasUsed
    );

    /**
     * @dev Constructor initializes FlashTrade with Hyperion interfaces
     * @param _metisVM Address of MetisVM for AI inference
     * @param _parallelExecutor Address of Parallel Executor
     */
    constructor(
        address _metisVM,
        address _parallelExecutor
    ) {
        require(_metisVM != address(0), "Invalid MetisVM address");
        require(_parallelExecutor != address(0), "Invalid ParallelExecutor address");
        
        metisVM = IMetisVM(_metisVM);
        parallelExecutor = IParallelExecutor(_parallelExecutor);
        
        // Initialize AI models
        _initializeAIModels();
    }

    /**
     * @dev Creates a new trading pair with AI-powered price discovery
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param initialReserveA Initial reserve for token A
     * @param initialReserveB Initial reserve for token B
     * @param feeRate Fee rate in basis points
     */
    function createPair(
        address tokenA,
        address tokenB,
        uint256 initialReserveA,
        uint256 initialReserveB,
        uint256 feeRate
    ) external onlyOwner {
        require(tokenA != tokenB, "Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "Zero address");
        require(feeRate <= MAX_FEE_RATE, "Fee too high");
        
        bytes32 pairId = _getPairId(tokenA, tokenB);
        require(!tradingPairs[pairId].isActive, "Pair exists");

        // Transfer initial reserves
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), initialReserveA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), initialReserveB);

        // Create pair
        tradingPairs[pairId] = TradingPair({
            tokenA: tokenA,
            tokenB: tokenB,
            reserveA: initialReserveA,
            reserveB: initialReserveB,
            lastUpdateTime: block.timestamp,
            isActive: true,
            totalLiquidity: sqrt(initialReserveA * initialReserveB),
            feeRate: feeRate
        });

        activePairs.push(pairId);
        
        // Generate initial AI prediction
        _updateAIPrediction(pairId);

        emit PairCreated(pairId, tokenA, tokenB);
    }

    /**
     * @dev Executes a trade with AI-powered optimal routing
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param minAmountOut Minimum acceptable output amount
     * @param deadline Transaction deadline
     */
    function trade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "Deadline exceeded");
        require(amountIn > 0, "Invalid input amount");
        
        bytes32 pairId = _getPairId(tokenIn, tokenOut);
        TradingPair storage pair = tradingPairs[pairId];
        require(pair.isActive, "Pair not active");

        // Get AI prediction for optimal execution
        AIPrediction memory prediction = _getAIPrediction(pairId);
        require(prediction.timestamp + PREDICTION_VALIDITY > block.timestamp, "Prediction stale");

        // Check for MEV risk
        if (prediction.mevRisk) {
            // Use parallel execution to mitigate MEV
            return _executeParallelTrade(tokenIn, tokenOut, amountIn, minAmountOut, prediction);
        }

        // Standard execution path
        amountOut = _calculateOutputAmount(pairId, tokenIn, amountIn);
        require(amountOut >= minAmountOut, "Insufficient output");

        // Execute trade
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);

        // Update reserves
        _updateReserves(pairId, tokenIn, amountIn, amountOut);
        
        // Update AI prediction
        _updateAIPrediction(pairId);

        totalTrades++;
        
        emit TradeExecuted(
            keccak256(abi.encodePacked(msg.sender, block.timestamp)),
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            block.timestamp
        );
    }

    /**
     * @dev Adds liquidity to a trading pair with AI-optimized ratios
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amountADesired Desired amount of token A
     * @param amountBDesired Desired amount of token B
     * @param amountAMin Minimum amount of token A
     * @param amountBMin Minimum amount of token B
     */
    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) external nonReentrant returns (uint256 amountA, uint256 amountB, uint256 liquidityMinted) {
        bytes32 pairId = _getPairId(tokenA, tokenB);
        TradingPair storage pair = tradingPairs[pairId];
        require(pair.isActive, "Pair not active");

        // Get AI-optimized amounts
        (amountA, amountB) = _getOptimalLiquidityAmounts(
            pairId,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );

        // Transfer tokens
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountA);
        IERC20(tokenB).safeTransferFrom(msg.sender, address(this), amountB);

        // Calculate liquidity tokens
        liquidityMinted = _calculateLiquidity(pairId, amountA, amountB);
        
        // Update state
        pair.reserveA += (tokenA == pair.tokenA) ? amountA : amountB;
        pair.reserveB += (tokenA == pair.tokenA) ? amountB : amountA;
        pair.totalLiquidity += liquidityMinted;
        liquidity[msg.sender][tokenA] += amountA;
        liquidity[msg.sender][tokenB] += amountB;

        // Update AI prediction with new liquidity
        _updateAIPrediction(pairId);

        emit LiquidityAdded(pairId, msg.sender, amountA, amountB, liquidityMinted);
    }

    /**
     * @dev Executes parallel trades to mitigate MEV and optimize execution
     */
    function _executeParallelTrade(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        AIPrediction memory prediction
    ) internal returns (uint256 amountOut) {
        // Create parallel batch for MEV-resistant execution
        IParallelExecutor.ParallelBatch memory batch;
        batch.batchId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        
        // Split trade into smaller parallel executions
        uint256 chunks = prediction.mevRisk ? 4 : 2;
        uint256 chunkSize = amountIn / chunks;
        
        batch.targets = new address[](chunks);
        batch.callData = new bytes[](chunks);
        batch.values = new uint256[](chunks);

        for (uint256 i = 0; i < chunks; i++) {
            batch.targets[i] = address(this);
            batch.callData[i] = abi.encodeWithSelector(
                this._executeChunk.selector,
                tokenIn,
                tokenOut,
                chunkSize,
                minAmountOut / chunks
            );
            batch.values[i] = 0;
        }

        // Execute parallel batch
        IParallelExecutor.ExecutionResult[] memory results = parallelExecutor.executeParallel(batch);
        
        // Aggregate results
        for (uint256 i = 0; i < results.length; i++) {
            require(results[i].success, "Parallel execution failed");
            amountOut += abi.decode(results[i].returnData, (uint256));
        }

        emit ParallelTradesBatched(batch.batchId, chunks, _calculateBatchGas(results));
    }

    /**
     * @dev Internal function for executing trade chunks in parallel
     */
    function _executeChunk(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut) {
        require(msg.sender == address(this), "Internal only");
        
        bytes32 pairId = _getPairId(tokenIn, tokenOut);
        amountOut = _calculateOutputAmount(pairId, tokenIn, amountIn);
        require(amountOut >= minAmountOut, "Insufficient chunk output");
        
        // Update reserves for this chunk
        _updateReserves(pairId, tokenIn, amountIn, amountOut);
        
        return amountOut;
    }

    /**
     * @dev Updates AI predictions using MetisVM inference
     */
    function _updateAIPrediction(bytes32 pairId) internal {
        TradingPair memory pair = tradingPairs[pairId];
        
        // Prepare data for AI inference
        bytes memory marketData = abi.encode(
            pair.reserveA,
            pair.reserveB,
            block.timestamp,
            pair.totalLiquidity,
            totalVolumeUSD
        );

        // Get price prediction
        uint256 predictedPrice = metisVM.inferenceCall(
            abi.encode(priceModelId, marketData)
        );

        // Get liquidity prediction
        uint256 liquidityNeeded = metisVM.inferenceCall(
            abi.encode(liquidityModelId, marketData)
        );

        // Get MEV risk assessment
        uint256 mevRiskScore = metisVM.inferenceCall(
            abi.encode(mevModelId, marketData)
        );

        // Store prediction
        predictions[pairId] = AIPrediction({
            predictedPrice: predictedPrice,
            confidence: 85, // Base confidence, could be enhanced with model output
            timestamp: block.timestamp,
            liquidityNeeded: liquidityNeeded,
            mevRisk: mevRiskScore > 50 // Risk threshold
        });

        emit AIPredictionUpdated(pairId, predictedPrice, 85, mevRiskScore > 50);
    }

    /**
     * @dev Initializes AI models on MetisVM
     */
    function _initializeAIModels() internal {
        // Register CNN-LSTM price prediction model
        priceModelId = metisVM.registerAIModel(
            keccak256("cnn-lstm-price-v1"),
            1, // CNN-LSTM model type
            50000 // Estimated gas requirement
        );

        // Register GNN liquidity forecasting model
        liquidityModelId = metisVM.registerAIModel(
            keccak256("gnn-liquidity-v1"),
            2, // GNN model type
            75000 // Estimated gas requirement
        );

        // Register MEV detection model
        mevModelId = metisVM.registerAIModel(
            keccak256("transformer-mev-v1"),
            3, // Transformer model type
            60000 // Estimated gas requirement
        );
    }

    // Utility functions
    function _getPairId(address tokenA, address tokenB) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(tokenA < tokenB ? tokenA : tokenB, tokenA < tokenB ? tokenB : tokenA));
    }

    function _getAIPrediction(bytes32 pairId) internal view returns (AIPrediction memory) {
        return predictions[pairId];
    }

    function _calculateOutputAmount(bytes32 pairId, address tokenIn, uint256 amountIn) internal view returns (uint256) {
        TradingPair memory pair = tradingPairs[pairId];
        
        uint256 reserveIn = (tokenIn == pair.tokenA) ? pair.reserveA : pair.reserveB;
        uint256 reserveOut = (tokenIn == pair.tokenA) ? pair.reserveB : pair.reserveA;
        
        uint256 amountInWithFee = amountIn * (10000 - pair.feeRate);
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 10000) + amountInWithFee;
        
        return numerator / denominator;
    }

    function _updateReserves(bytes32 pairId, address tokenIn, uint256 amountIn, uint256 amountOut) internal {
        TradingPair storage pair = tradingPairs[pairId];
        
        if (tokenIn == pair.tokenA) {
            pair.reserveA += amountIn;
            pair.reserveB -= amountOut;
        } else {
            pair.reserveB += amountIn;
            pair.reserveA -= amountOut;
        }
        
        pair.lastUpdateTime = block.timestamp;
    }

    function _getOptimalLiquidityAmounts(
        bytes32 pairId,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) internal view returns (uint256 amountA, uint256 amountB) {
        TradingPair memory pair = tradingPairs[pairId];
        
        uint256 amountBOptimal = (amountADesired * pair.reserveB) / pair.reserveA;
        if (amountBOptimal <= amountBDesired) {
            require(amountBOptimal >= amountBMin, "Insufficient B amount");
            return (amountADesired, amountBOptimal);
        } else {
            uint256 amountAOptimal = (amountBDesired * pair.reserveA) / pair.reserveB;
            require(amountAOptimal <= amountADesired && amountAOptimal >= amountAMin, "Insufficient A amount");
            return (amountAOptimal, amountBDesired);
        }
    }

    function _calculateLiquidity(bytes32 pairId, uint256 amountA, uint256 amountB) internal view returns (uint256) {
        TradingPair memory pair = tradingPairs[pairId];
        return sqrt(amountA * amountB);
    }

    function _calculateBatchGas(IParallelExecutor.ExecutionResult[] memory results) internal pure returns (uint256 totalGas) {
        for (uint256 i = 0; i < results.length; i++) {
            totalGas += results[i].gasUsed;
        }
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    // View functions
    function getActivePairs() external view returns (bytes32[] memory) {
        return activePairs;
    }

    function getPairDetails(bytes32 pairId) external view returns (TradingPair memory) {
        return tradingPairs[pairId];
    }

    function getAIPrediction(bytes32 pairId) external view returns (AIPrediction memory) {
        return predictions[pairId];
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
} 