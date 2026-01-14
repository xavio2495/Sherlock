// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

// Interface for RWATokenFactory interaction
interface IRWATokenFactory {
    function burn(address from, uint256 id, uint256 amount) external;
    function mint(address to, uint256 id, uint256 amount) external;
}

/**
 * @title FractionManager
 * @notice Handle fraction specifications, transfers, and recombination
 * @dev Manages fractional ownership rules for RWA tokens
 * 
 * Key Features:
 * - Define min fraction size and lockup periods per token
 * - Validate transfers against fraction specs
 * - Burn-to-whole recombination (burn fractions → mint whole NFT)
 * - Global lockup per tokenId (all holders subject to same lockup)
 */
contract FractionManager is Ownable {
    // ============ State Variables ============
    
    struct FractionSpec {
        uint256 totalSupply;      // Total number of fractions
        uint256 minUnitSize;      // Minimum transferable unit
        uint256 lockupPeriod;     // Lockup duration in days
        uint256 lockupEnd;        // Timestamp when lockup expires
        bool isActive;            // Whether spec is set
    }

    // Token ID to fraction specification
    mapping(uint256 => FractionSpec) public fractionSpecs;

    // Reference to RWATokenFactory for burn/mint operations
    IRWATokenFactory public rwaFactory;

    // Constant for whole token ID offset (original tokenId + WHOLE_TOKEN_OFFSET)
    uint256 public constant WHOLE_TOKEN_OFFSET = 1_000_000;

    // ============ Errors ============
    
    error InvalidTotalSupply();
    error InvalidMinUnitSize();
    error FractionSpecNotSet(uint256 tokenId);
    error TransferBelowMinimum(uint256 amount, uint256 required);
    error TransferDuringLockup(uint256 currentTime, uint256 lockupEnd);
    error InsufficientFractionsForRecombination(uint256 amount, uint256 required);
    error RWAFactoryNotSet();

    // ============ Events ============
    
    event FractionSpecSet(
        uint256 indexed tokenId,
        uint256 totalSupply,
        uint256 minUnitSize,
        uint256 lockupPeriod,
        uint256 lockupEnd
    );

    event FractionsRecombined(
        uint256 indexed tokenId,
        address indexed holder,
        uint256 fractionalAmount,
        uint256 wholeTokenId
    );

    event RWAFactoryUpdated(address indexed oldFactory, address indexed newFactory);

    // ============ Constructor ============
    
    /**
     * @notice Initialize FractionManager
     * @param _rwaFactory Address of RWATokenFactory contract
     */
    constructor(address _rwaFactory) Ownable(msg.sender) {
        require(_rwaFactory != address(0), "Invalid factory address");
        rwaFactory = IRWATokenFactory(_rwaFactory);
    }

    // ============ Core Functions ============
    
    /**
     * @notice Define fraction parameters for a token
     * @param tokenId The token ID
     * @param totalSupply Total supply of fractions
     * @param minUnitSize Minimum transferable unit size
     * @param lockupPeriod Lockup duration in days
     */
    function setFractionSpec(
        uint256 tokenId,
        uint256 totalSupply,
        uint256 minUnitSize,
        uint256 lockupPeriod
    ) external onlyOwner {
        if (totalSupply == 0) revert InvalidTotalSupply();
        if (minUnitSize == 0 || minUnitSize > totalSupply) revert InvalidMinUnitSize();

        uint256 lockupEndTimestamp = _calculateLockupEnd(lockupPeriod);

        fractionSpecs[tokenId] = FractionSpec({
            totalSupply: totalSupply,
            minUnitSize: minUnitSize,
            lockupPeriod: lockupPeriod,
            lockupEnd: lockupEndTimestamp,
            isActive: true
        });

        emit FractionSpecSet(tokenId, totalSupply, minUnitSize, lockupPeriod, lockupEndTimestamp);
    }

    /**
     * @notice Recombine fractions back to whole asset
     * @param tokenId The fractional token ID
     * @param amount Number of fractions to recombine
     * @dev Burns fractional tokens and mints a whole token (tokenId + WHOLE_TOKEN_OFFSET)
     */
    function recombineFractions(uint256 tokenId, uint256 amount) external {
        if (address(rwaFactory) == address(0)) revert RWAFactoryNotSet();
        
        FractionSpec memory spec = fractionSpecs[tokenId];
        if (!spec.isActive) revert FractionSpecNotSet(tokenId);
        
        // Must recombine exact total supply to get whole asset
        if (amount != spec.totalSupply) {
            revert InsufficientFractionsForRecombination(amount, spec.totalSupply);
        }

        // Burn fractional tokens from sender
        rwaFactory.burn(msg.sender, tokenId, amount);

        // Mint whole token (original tokenId + offset)
        uint256 wholeTokenId = tokenId + WHOLE_TOKEN_OFFSET;
        rwaFactory.mint(msg.sender, wholeTokenId, 1);

        emit FractionsRecombined(tokenId, msg.sender, amount, wholeTokenId);
    }

    /**
     * @notice Check if transfer is allowed based on specs
     * @param tokenId The token ID
     * @param amount Transfer amount
     * @param from Address initiating transfer
     * @return bool True if transfer allowed
     */
    function isTransferAllowed(
        uint256 tokenId,
        uint256 amount,
        address from
    ) external view returns (bool) {
        FractionSpec memory spec = fractionSpecs[tokenId];
        
        // If no spec set, allow transfer (default behavior)
        if (!spec.isActive) return true;

        // Check minimum unit size
        if (amount < spec.minUnitSize) {
            return false;
        }

        // Check lockup period (global for all holders)
        if (block.timestamp < spec.lockupEnd) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get fraction specification for a token
     * @param tokenId The token ID
     * @return FractionSpec struct
     */
    function getFractionSpec(uint256 tokenId) external view returns (FractionSpec memory) {
        return fractionSpecs[tokenId];
    }

    /**
     * @notice Check if lockup period has ended
     * @param tokenId The token ID
     * @return bool True if lockup has ended
     */
    function isLockupEnded(uint256 tokenId) external view returns (bool) {
        FractionSpec memory spec = fractionSpecs[tokenId];
        if (!spec.isActive) return true;
        return block.timestamp >= spec.lockupEnd;
    }

    /**
     * @notice Get remaining lockup time in seconds
     * @param tokenId The token ID
     * @return uint256 Seconds remaining (0 if ended)
     */
    function getRemainingLockup(uint256 tokenId) external view returns (uint256) {
        FractionSpec memory spec = fractionSpecs[tokenId];
        if (!spec.isActive || block.timestamp >= spec.lockupEnd) return 0;
        return spec.lockupEnd - block.timestamp;
    }

    /**
     * @notice Validate transfer with revert on failure
     * @param tokenId The token ID
     * @param amount Transfer amount
     * @param from Address initiating transfer
     */
    function validateTransfer(
        uint256 tokenId,
        uint256 amount,
        address from
    ) external view {
        FractionSpec memory spec = fractionSpecs[tokenId];
        
        // If no spec set, allow transfer
        if (!spec.isActive) return;

        // Check minimum unit size
        if (amount < spec.minUnitSize) {
            revert TransferBelowMinimum(amount, spec.minUnitSize);
        }

        // Check lockup period
        if (block.timestamp < spec.lockupEnd) {
            revert TransferDuringLockup(block.timestamp, spec.lockupEnd);
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update RWATokenFactory address
     * @param newFactory New factory address
     */
    function setRWAFactory(address newFactory) external onlyOwner {
        require(newFactory != address(0), "Invalid factory address");
        address oldFactory = address(rwaFactory);
        rwaFactory = IRWATokenFactory(newFactory);
        emit RWAFactoryUpdated(oldFactory, newFactory);
    }

    /**
     * @notice Update lockup period for a token
     * @param tokenId The token ID
     * @param newLockupPeriod New lockup period in days
     */
    function updateLockupPeriod(uint256 tokenId, uint256 newLockupPeriod) external onlyOwner {
        FractionSpec storage spec = fractionSpecs[tokenId];
        if (!spec.isActive) revert FractionSpecNotSet(tokenId);

        spec.lockupPeriod = newLockupPeriod;
        spec.lockupEnd = _calculateLockupEnd(newLockupPeriod);

        emit FractionSpecSet(
            tokenId,
            spec.totalSupply,
            spec.minUnitSize,
            newLockupPeriod,
            spec.lockupEnd
        );
    }

    /**
     * @notice Deactivate fraction spec for a token
     * @param tokenId The token ID
     */
    function deactivateFractionSpec(uint256 tokenId) external onlyOwner {
        fractionSpecs[tokenId].isActive = false;
    }

    // ============ Internal Helper Functions ============

    /**
     * @notice Calculate lockup end timestamp from duration in days
     * @param durationDays Duration in days
     * @return uint256 Unix timestamp when lockup ends
     */
    function _calculateLockupEnd(uint256 durationDays) internal view returns (uint256) {
        if (durationDays == 0) return block.timestamp; // No lockup
        return block.timestamp + (durationDays * 1 days);
    }
}
