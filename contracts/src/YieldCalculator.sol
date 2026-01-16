// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PythOracleReader.sol";

interface IRWATokenFactoryForYield {
    struct AssetMetadata {
        address issuer;
        string documentHash;
        uint256 totalValue;
        uint256 fractionCount;
        uint256 minFractionSize;
        uint256 mintTimestamp;
        uint256 oraclePriceAtMint;
        bytes32 priceId;
        bool verified;
    }
    
    function assets(uint256 tokenId) external view returns (
        address issuer,
        string memory documentHash,
        uint256 totalValue,
        uint256 fractionCount,
        uint256 minFractionSize,
        uint256 mintTimestamp,
        uint256 oraclePriceAtMint,
        bytes32 priceId,
        bool verified
    );
}

/**
 * @title YieldCalculator
 * @notice Compute yield/return based on oracle data
 * @dev Optional for MVP - provides APY calculations and token value previews
 */
contract YieldCalculator is Ownable {
    // ============ State Variables ============
    
    PythOracleReader public pythOracle;
    IRWATokenFactoryForYield public rwaFactory;
    
    // Configurable base APY (stored as percentage with 2 decimals: 525 = 5.25%)
    uint256 public baseAPY;
    
    // ============ Events ============
    
    event YieldCalculated(uint256 indexed tokenId, uint256 yield, uint256 timestamp);
    event BaseAPYUpdated(uint256 oldAPY, uint256 newAPY);

    // ============ Errors ============
    
    error AssetNotFound();
    error InvalidAPY();
    error PriceNotAvailable();
    error ZeroPrincipal();
    error ZeroDuration();

    // ============ Constructor ============
    
    constructor(
        address payable _pythOracle,
        address _rwaFactory
    ) Ownable(msg.sender) {
        pythOracle = PythOracleReader(_pythOracle);
        rwaFactory = IRWATokenFactoryForYield(_rwaFactory);
        baseAPY = 500; // Default 5.00% APY
    }

    // ============ Core Functions ============
    
    /**
     * @notice Calculate yield for a token over a duration (simple interest)
     * @param tokenId The token ID
     * @param principalAmount Principal amount in USD cents
     * @param durationDays Duration in days
     * @return uint256 Total amount (principal + interest)
     */
    function calculateYield(
        uint256 tokenId,
        uint256 principalAmount,
        uint256 durationDays
    ) external returns (uint256) {
        if (principalAmount == 0) revert ZeroPrincipal();
        if (durationDays == 0) revert ZeroDuration();
        
        // Verify asset exists
        (address issuer, , , , , , , , bool verified) = rwaFactory.assets(tokenId);
        if (issuer == address(0) || !verified) revert AssetNotFound();
        
        // Simple interest formula: interest = principal * rate * (days/365)
        // Rate is baseAPY / 10000 (e.g., 525 = 5.25%)
        uint256 interest = (principalAmount * baseAPY * durationDays) / (10000 * 365);
        uint256 totalAmount = principalAmount + interest;
        
        emit YieldCalculated(tokenId, totalAmount, block.timestamp);
        
        return totalAmount;
    }

    /**
     * @notice Preview current value of ONE fraction based on oracle price changes
     * @param tokenId The token ID
     * @return uint256 Current estimated value per fraction in USD cents
     */
    function previewTokenValue(uint256 tokenId) external view returns (uint256) {
        // Get asset metadata
        (
            address issuer,
            ,
            uint256 totalValue,
            uint256 fractionCount,
            ,
            ,
            uint256 oraclePriceAtMint,
            bytes32 priceId,
            bool verified
        ) = rwaFactory.assets(tokenId);
        
        if (issuer == address(0) || !verified) revert AssetNotFound();
        
        // Get current oracle price
        (int64 currentPrice, ) = pythOracle.getLatestPrice(priceId);
        if (currentPrice <= 0) revert PriceNotAvailable();
        
        // Calculate value per fraction based on price appreciation/depreciation
        // Formula: (currentPrice / priceAtMint) * (totalValue / fractionCount)
        uint256 currentPriceUint = uint256(uint64(currentPrice));
        uint256 valuePerFraction = (currentPriceUint * totalValue) / (oraclePriceAtMint * fractionCount);
        
        return valuePerFraction;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Update the base APY rate
     * @param newAPY New base APY (e.g., 525 = 5.25%)
     */
    function setBaseAPY(uint256 newAPY) external onlyOwner {
        if (newAPY > 10000) revert InvalidAPY(); // Max 100%
        
        uint256 oldAPY = baseAPY;
        baseAPY = newAPY;
        
        emit BaseAPYUpdated(oldAPY, newAPY);
    }
}
