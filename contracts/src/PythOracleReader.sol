// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/**
 * @title PythOracleReader
 * @notice Read and cache Pyth price feeds for asset valuation
 * @dev Interfaces with Pyth Network oracle on Mantle for real-time price data
 * 
 * Pyth Integration Pattern:
 * 1. Backend fetches price updates from Pyth Price Service API
 * 2. Backend calls updatePrice() with the update data
 * 3. Contract forwards update to Pyth contract and caches result
 * 4. Other contracts query cached prices with staleness checks
 */
contract PythOracleReader is Ownable {
    // ============ State Variables ============
    
    struct PriceData {
        int64 price;
        uint64 timestamp;
        uint64 confidence;
        int32 expo;
        bool isValid;
    }

    // Pyth contract interface
    IPyth public immutable pyth;

    // Cached prices: priceId => PriceData
    mapping(bytes32 => PriceData) public cachedPrices;

    // Token ID to price mapping (price at mint time)
    mapping(uint256 => int64) public tokenMintPrices;
    mapping(uint256 => bytes32) public tokenMintPriceIds;

    // Supported price feeds
    mapping(bytes32 => bool) public supportedFeeds;

    // Price staleness threshold (in seconds) - 10 minutes
    uint256 public stalenessThreshold = 600;

    // ============ Constants ============
    
    // Pyth price feed IDs for Mantle Testnet
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 public constant USDC_USD_FEED = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    // ============ Errors ============
    
    error PriceFeedNotSupported(bytes32 priceId);
    error PriceDataNotAvailable(bytes32 priceId);
    error PriceDataStale(bytes32 priceId, uint256 age);
    error InvalidPriceUpdate();
    error InsufficientUpdateFee(uint256 required, uint256 provided);

    // ============ Events ============
    
    event PriceUpdated(
        bytes32 indexed priceId,
        int64 price,
        uint64 timestamp,
        uint64 confidence
    );

    event PriceFeedAdded(bytes32 indexed priceId);
    event PriceFeedRemoved(bytes32 indexed priceId);
    event MintPriceRecorded(uint256 indexed tokenId, bytes32 priceId, int64 price);
    event StalenessThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    // ============ Constructor ============
    
    /**
     * @notice Initialize with Pyth contract address
     * @param _pythContract Address of Pyth oracle contract on Mantle
     */
    constructor(address _pythContract) Ownable(msg.sender) {
        require(_pythContract != address(0), "Invalid Pyth address");
        pyth = IPyth(_pythContract);
        
        // Initialize supported price feeds (Mantle Testnet)
        supportedFeeds[ETH_USD_FEED] = true;
        supportedFeeds[BTC_USD_FEED] = true;
        supportedFeeds[USDC_USD_FEED] = true;

        emit PriceFeedAdded(ETH_USD_FEED);
        emit PriceFeedAdded(BTC_USD_FEED);
        emit PriceFeedAdded(USDC_USD_FEED);
    }

    // ============ Core Functions ============
    
    /**
     * @notice Update cached price from Pyth contract
     * @param priceId The Pyth price feed identifier
     * @param priceUpdate Price update data from Pyth Price Service API
     * @dev Requires payment for Pyth update fee (sent as msg.value)
     *      Backend should fetch priceUpdate from: https://hermes.pyth.network/api/latest_vaas?ids[]={priceId}
     */
    function updatePrice(bytes32 priceId, bytes[] calldata priceUpdate) external payable {
        if (!supportedFeeds[priceId]) {
            revert PriceFeedNotSupported(priceId);
        }

        // Get the required update fee from Pyth
        uint256 updateFee = pyth.getUpdateFee(priceUpdate);
        if (msg.value < updateFee) {
            revert InsufficientUpdateFee(updateFee, msg.value);
        }

        // Update price on Pyth contract (forwards to Pyth with fee)
        pyth.updatePriceFeeds{value: updateFee}(priceUpdate);

        // Fetch and cache the updated price
        PythStructs.Price memory pythPrice = pyth.getPriceUnsafe(priceId);
        
        cachedPrices[priceId] = PriceData({
            price: pythPrice.price,
            timestamp: uint64(pythPrice.publishTime),
            confidence: pythPrice.conf,
            expo: pythPrice.expo,
            isValid: true
        });

        // Refund excess payment
        if (msg.value > updateFee) {
            (bool success, ) = msg.sender.call{value: msg.value - updateFee}("");
            require(success, "Refund failed");
        }

        emit PriceUpdated(priceId, pythPrice.price, uint64(pythPrice.publishTime), pythPrice.conf);
    }

    /**
     * @notice Get latest cached price for a feed
     * @param priceId The Pyth price feed identifier
     * @return price The latest price (with expo scaling, e.g., price * 10^expo)
     * @return timestamp The timestamp of the price update
     * @dev Reverts if price is stale or unavailable
     */
    function getLatestPrice(bytes32 priceId) external view returns (int64 price, uint64 timestamp) {
        PriceData memory data = cachedPrices[priceId];
        
        if (!data.isValid) {
            revert PriceDataNotAvailable(priceId);
        }
        
        uint256 age = block.timestamp - data.timestamp;
        if (age > stalenessThreshold) {
            revert PriceDataStale(priceId, age);
        }
        
        return (data.price, data.timestamp);
    }

    /**
     * @notice Get cached price without staleness check (unsafe)
     * @param priceId The price feed identifier
     * @return price The cached price
     * @return timestamp The timestamp of the cached price
     * @dev Use with caution - does not check if price is stale
     */
    function getCachedPriceUnsafe(bytes32 priceId) external view returns (int64 price, uint64 timestamp) {
        PriceData memory data = cachedPrices[priceId];
        
        if (!data.isValid) {
            revert PriceDataNotAvailable(priceId);
        }
        
        return (data.price, data.timestamp);
    }

    /**
     * @notice Record price at mint time for a token
     * @param tokenId The token ID
     * @param priceId The price feed to record
     * @dev Should be called during token minting to snapshot the price
     */
    function recordMintPrice(uint256 tokenId, bytes32 priceId) external {
        PriceData memory data = cachedPrices[priceId];
        
        if (!data.isValid) {
            revert PriceDataNotAvailable(priceId);
        }
        
        tokenMintPrices[tokenId] = data.price;
        tokenMintPriceIds[tokenId] = priceId;
        
        emit MintPriceRecorded(tokenId, priceId, data.price);
    }

    /**
     * @notice Get the price recorded at token mint time
     * @param tokenId The token ID
     * @return price The price at mint time
     */
    function getPriceAtMint(uint256 tokenId) external view returns (int64) {
        return tokenMintPrices[tokenId];
    }

    /**
     * @notice Check if price data is stale
     * @param priceId The price feed identifier
     * @return bool True if price is stale or invalid
     */
    function isPriceStale(bytes32 priceId) external view returns (bool) {
        PriceData memory data = cachedPrices[priceId];
        if (!data.isValid) return true;
        return block.timestamp - data.timestamp > stalenessThreshold;
    }

    /**
     * @notice Get full price data including confidence and expo
     * @param priceId The price feed identifier
     * @return PriceData struct with all price information
     */
    function getPriceData(bytes32 priceId) external view returns (PriceData memory) {
        return cachedPrices[priceId];
    }

    /**
     * @notice Get the update fee required for a price update
     * @param priceUpdate The price update data
     * @return fee The required fee in wei
     */
    function getUpdateFee(bytes[] calldata priceUpdate) external view returns (uint256) {
        return pyth.getUpdateFee(priceUpdate);
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Add a new supported price feed
     * @param priceId The Pyth price feed identifier
     */
    function addPriceFeed(bytes32 priceId) external onlyOwner {
        require(priceId != bytes32(0), "Invalid price ID");
        supportedFeeds[priceId] = true;
        emit PriceFeedAdded(priceId);
    }

    /**
     * @notice Remove a price feed
     * @param priceId The price feed identifier
     */
    function removePriceFeed(bytes32 priceId) external onlyOwner {
        supportedFeeds[priceId] = false;
        emit PriceFeedRemoved(priceId);
    }

    /**
     * @notice Update staleness threshold
     * @param newThreshold New threshold in seconds
     */
    function setStalenessThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0, "Invalid threshold");
        uint256 oldThreshold = stalenessThreshold;
        stalenessThreshold = newThreshold;
        emit StalenessThresholdUpdated(oldThreshold, newThreshold);
    }

    /**
     * @notice Emergency withdraw of stuck ETH
     * @dev Should not be needed in normal operation
     */
    function withdrawETH() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }

    // ============ Helper Functions ============

    /**
     * @notice Check if a price feed is supported
     * @param priceId The price feed identifier
     * @return bool True if supported
     */
    function isSupportedFeed(bytes32 priceId) external view returns (bool) {
        return supportedFeeds[priceId];
    }

    /**
     * @notice Get the age of cached price data in seconds
     * @param priceId The price feed identifier
     * @return age Age in seconds (0 if invalid)
     */
    function getPriceAge(bytes32 priceId) external view returns (uint256) {
        PriceData memory data = cachedPrices[priceId];
        if (!data.isValid) return 0;
        return block.timestamp - data.timestamp;
    }

    // Allow contract to receive ETH for Pyth fee payments
    receive() external payable {}
}
