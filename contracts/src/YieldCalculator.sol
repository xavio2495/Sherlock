// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./PythOracleReader.sol";

/**
 * @title YieldCalculator
 * @notice Compute yield/return based on oracle data
 * @dev Optional for MVP - provides APY calculations and token value previews
 */
contract YieldCalculator is Ownable {
    // ============ State Variables ============
    
    struct YieldConfig {
        uint256 baseAPY;          // Base annual percentage yield (in basis points, 1 bp = 0.01%)
        uint256 lastUpdateTime;
        bool isActive;
    }

    PythOracleReader public pythOracle;
    
    mapping(uint256 => YieldConfig) public tokenYieldConfig;
    
    // Constants
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_DAY = 86400;
    uint256 public constant DAYS_PER_YEAR = 365;

    // ============ Events ============
    
    event YieldConfigured(uint256 indexed tokenId, uint256 baseAPY);
    event YieldCalculated(uint256 indexed tokenId, uint256 principal, uint256 yield);

    // ============ Constructor ============
    
    constructor(address _pythOracle) Ownable(msg.sender) {
        pythOracle = PythOracleReader(_pythOracle);
    }

    // ============ Core Functions ============
    
    /**
     * @notice Calculate yield for a token over a duration
     * @param tokenId The token ID
     * @param principalAmount Principal amount in USD cents
     * @param durationDays Duration in days
     * @return uint256 Calculated yield amount
     */
    function calculateYield(
        uint256 tokenId,
        uint256 principalAmount,
        uint256 durationDays
    ) external view returns (uint256) {
        // TODO: Get yield config for token
        // TODO: Calculate simple interest: principal * rate * time
        // TODO: Return yield amount
        return 0;
    }

    /**
     * @notice Preview current token value based on oracle price
     * @param tokenId The token ID
     * @return uint256 Current estimated value
     */
    function previewTokenValue(uint256 tokenId) external view returns (uint256) {
        // TODO: Get price at mint from PythOracleReader
        // TODO: Get current price from oracle
        // TODO: Calculate value change
        // TODO: Return current value estimate
        return 0;
    }

    /**
     * @notice Calculate APY based on oracle interest rate benchmark
     * @param tokenId The token ID
     * @param benchmarkPriceId Pyth price feed for benchmark rate
     * @return uint256 Calculated APY in basis points
     */
    function calculateAPY(
        uint256 tokenId,
        bytes32 benchmarkPriceId
    ) external view returns (uint256) {
        // TODO: Fetch benchmark rate from oracle
        // TODO: Apply token-specific adjustments
        // TODO: Return APY
        return 0;
    }

    /**
     * @notice Calculate compound yield (future enhancement)
     * @param tokenId The token ID
     * @param principalAmount Principal amount
     * @param durationDays Duration in days
     * @param compoundingPeriods Number of compounding periods per year
     * @return uint256 Compound yield amount
     */
    function calculateCompoundYield(
        uint256 tokenId,
        uint256 principalAmount,
        uint256 durationDays,
        uint256 compoundingPeriods
    ) external view returns (uint256) {
        // TODO: Implement compound interest formula
        // TODO: A = P(1 + r/n)^(nt)
        return 0;
    }

    // ============ Admin Functions ============
    
    /**
     * @notice Set yield configuration for a token
     * @param tokenId The token ID
     * @param baseAPY Base APY in basis points
     */
    function setYieldConfig(uint256 tokenId, uint256 baseAPY) external onlyOwner {
        require(baseAPY <= BASIS_POINTS * 100, "APY too high"); // Max 100% APY
        
        tokenYieldConfig[tokenId] = YieldConfig({
            baseAPY: baseAPY,
            lastUpdateTime: block.timestamp,
            isActive: true
        });

        emit YieldConfigured(tokenId, baseAPY);
    }

    /**
     * @notice Update base APY for a token
     * @param tokenId The token ID
     * @param newAPY New APY in basis points
     */
    function updateAPY(uint256 tokenId, uint256 newAPY) external onlyOwner {
        require(tokenYieldConfig[tokenId].isActive, "Token config not active");
        tokenYieldConfig[tokenId].baseAPY = newAPY;
        tokenYieldConfig[tokenId].lastUpdateTime = block.timestamp;
    }

    /**
     * @notice Deactivate yield for a token
     * @param tokenId The token ID
     */
    function deactivateYield(uint256 tokenId) external onlyOwner {
        tokenYieldConfig[tokenId].isActive = false;
    }

    /**
     * @notice Update PythOracleReader address
     * @param newOracle New oracle address
     */
    function setPythOracle(address newOracle) external onlyOwner {
        pythOracle = PythOracleReader(newOracle);
    }

    /**
     * @notice Get yield configuration for a token
     * @param tokenId The token ID
     * @return YieldConfig struct
     */
    function getYieldConfig(uint256 tokenId) external view returns (YieldConfig memory) {
        return tokenYieldConfig[tokenId];
    }
}
