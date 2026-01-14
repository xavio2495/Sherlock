// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title PythOracleReader
 * @notice Read and cache Pyth price feeds for asset valuation
 * @dev Interfaces with Pyth Network oracle on Mantle for real-time price data
 */
contract PythOracleReader is Ownable {
    // ============ State Variables ============
    
    struct PriceData {
        int64 price;
        uint64 timestamp;
        uint64 confidence;
        bool isValid;
    }

    // Pyth contract address on Mantle Testnet
    address public pythContract;

    // Cached prices: priceId => PriceData
    mapping(bytes32 => PriceData) public cachedPrices;

    // Token ID to price mapping (price at mint time)
    mapping(uint256 => int64) public tokenMintPrices;

    // Supported price feeds
    mapping(bytes32 => bool) public supportedFeeds;

    // Price staleness threshold (in seconds)
    uint256 public stalenessThreshold = 300; // 5 minutes

    // ============ Events ============
    
    event PriceUpdated(
        bytes32 indexed priceId,
        int64 price,
        uint64 timestamp,
        uint64 confidence
    );

    event PriceFeedAdded(bytes32 indexed priceId);
    event PriceFeedRemoved(bytes32 indexed priceId);
    event MintPriceRecorded(uint256 indexed tokenId, int64 price);

    // ============ Constructor ============
    
    constructor(address _pythContract) Ownable(msg.sender) {
        pythContract = _pythContract;
        
        // Initialize supported price feeds (Mantle Testnet)
        // ETH/USD
        supportedFeeds[0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace] = true;
        // BTC/USD
        supportedFeeds[0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43] = true;
        // USDC/USD
        supportedFeeds[0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a] = true;
    }

    // ============ Core Functions ============
    
    /**
     * @notice Update cached price from Pyth contract
     * @param priceId The Pyth price feed identifier
     * @param priceUpdate Price update data from Pyth
     * @dev Requires payment for Pyth update fee (sent as msg.value)
     */
    function updatePrice(bytes32 priceId, bytes calldata priceUpdate) external payable {
        // TODO: Verify price feed is supported
        // TODO: Call Pyth contract to update price
        // TODO: Cache price data on-chain
        // TODO: Validate timestamp and confidence
        // TODO: Emit PriceUpdated event
    }

    /**
     * @notice Get latest cached price for a feed
     * @param priceId The Pyth price feed identifier
     * @return price The latest price (scaled by 1e8)
     * @return timestamp The timestamp of the price update
     */
    function getLatestPrice(bytes32 priceId) external view returns (int64 price, uint64 timestamp) {
        PriceData memory data = cachedPrices[priceId];
        require(data.isValid, "Price data not available");
        require(block.timestamp - data.timestamp <= stalenessThreshold, "Price data stale");
        return (data.price, data.timestamp);
    }

    /**
     * @notice Record price at mint time for a token
     * @param tokenId The token ID
     * @param priceId The price feed to record
     */
    function recordMintPrice(uint256 tokenId, bytes32 priceId) external {
        // TODO: Get latest price
        // TODO: Store price for token
        // TODO: Emit MintPriceRecorded event
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
     * @return bool True if price is stale
     */
    function isPriceStale(bytes32 priceId) external view returns (bool) {
        PriceData memory data = cachedPrices[priceId];
        if (!data.isValid) return true;
        return block.timestamp - data.timestamp > stalenessThreshold;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Add a new supported price feed
     * @param priceId The Pyth price feed identifier
     */
    function addPriceFeed(bytes32 priceId) external onlyOwner {
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
        stalenessThreshold = newThreshold;
    }

    /**
     * @notice Update Pyth contract address
     * @param newPythContract New Pyth contract address
     */
    function setPythContract(address newPythContract) external onlyOwner {
        pythContract = newPythContract;
    }
}
