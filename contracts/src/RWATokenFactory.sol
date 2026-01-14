// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ZKVerifier.sol";
import "./PythOracleReader.sol";
import "./FractionManager.sol";

/**
 * @title RWATokenFactory
 * @notice Main factory for minting RWA tokens as ERC-1155
 * @dev Integrates with ZKVerifier for issuer eligibility and PythOracleReader for price feeds
 */
contract RWATokenFactory is ERC1155, Ownable, ReentrancyGuard {
    // ============ State Variables ============
    
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

    mapping(uint256 => AssetMetadata) public assets;
    uint256 public nextTokenId;

    ZKVerifier public zkVerifier;
    PythOracleReader public pythOracle;
    FractionManager public fractionManager;

    // ============ Events ============
    
    event AssetMinted(
        uint256 indexed tokenId,
        address indexed issuer,
        string documentHash,
        uint256 totalValue,
        uint256 fractionCount,
        bytes32 priceId,
        uint256 oraclePrice
    );

    event FractionPurchased(
        uint256 indexed tokenId,
        address indexed buyer,
        uint256 amount,
        uint256 totalCost
    );

    // ============ Custom Errors ============
    
    error IssuerNotEligible();
    error BuyerNotEligible();
    error InvalidTotalValue();
    error InvalidFractionCount();
    error InvalidMinFractionSize();
    error AssetNotFound();
    error InsufficientFractionsAvailable();
    error InsufficientPayment();
    error PriceNotAvailable();

    // ============ Constructor ============
    
    constructor(
        address _zkVerifier,
        address payable _pythOracle,
        address _fractionManager
    ) ERC1155("") Ownable(msg.sender) {
        zkVerifier = ZKVerifier(_zkVerifier);
        pythOracle = PythOracleReader(_pythOracle);
        fractionManager = FractionManager(_fractionManager);
        nextTokenId = 1;
    }

    // ============ Core Functions ============
    
    /**
     * @notice Mint new RWA tokens with issuer-defined fraction specs
     * @param documentHash SHA256 hash of asset documentation
     * @param totalValue Total value of the asset in USD cents
     * @param fractionCount Number of fractions to create
     * @param minFractionSize Minimum fraction size for transfers
     * @param lockupWeeks Lockup period in weeks (0 for no lockup)
     * @param zkProof Zero-knowledge proof for issuer eligibility
     * @param priceId Pyth price feed ID for asset valuation
     * @return tokenId The ID of the newly minted token
     */
    function mintRWAToken(
        string memory documentHash,
        uint256 totalValue,
        uint256 fractionCount,
        uint256 minFractionSize,
        uint256 lockupWeeks,
        bytes memory zkProof,
        bytes32 priceId
    ) external nonReentrant returns (uint256 tokenId) {
        // Validate inputs
        if (totalValue == 0) revert InvalidTotalValue();
        if (fractionCount == 0) revert InvalidFractionCount();
        if (minFractionSize == 0 || minFractionSize > fractionCount) revert InvalidMinFractionSize();
        
        // Verify issuer has registered commitment (check eligibility)
        (, , bool isActive) = zkVerifier.userCommitments(msg.sender);
        if (!isActive) revert IssuerNotEligible();
        
        // Fetch current oracle price
        (int64 price, uint64 timestamp) = pythOracle.getLatestPrice(priceId);
        if (price <= 0 || timestamp == 0) revert PriceNotAvailable();
        
        // Generate new token ID
        tokenId = nextTokenId++;
        
        // Store asset metadata
        assets[tokenId] = AssetMetadata({
            issuer: msg.sender,
            documentHash: documentHash,
            totalValue: totalValue,
            fractionCount: fractionCount,
            minFractionSize: minFractionSize,
            mintTimestamp: block.timestamp,
            oraclePriceAtMint: uint256(uint64(price)),
            priceId: priceId,
            verified: true
        });
        
        // Set fraction specs in FractionManager (convert weeks to days)
        uint256 lockupDays = lockupWeeks * 7;
        fractionManager.setFractionSpec(tokenId, fractionCount, minFractionSize, lockupDays);
        
        // Mint all fractions to issuer
        _mint(msg.sender, tokenId, fractionCount, "");
        
        // Emit event
        emit AssetMinted(tokenId, msg.sender, documentHash, totalValue, fractionCount, priceId, uint256(uint64(price)));
    }

    /**
     * @notice Purchase fractions of an RWA token
     * @param tokenId The ID of the RWA token
     * @param amount Number of fractions to purchase
     * @param buyerZKProof Zero-knowledge proof for buyer eligibility
     */
    function purchaseFraction(
        uint256 tokenId,
        uint256 amount,
        bytes memory buyerZKProof
    ) external payable nonReentrant {
        AssetMetadata storage asset = assets[tokenId];
        
        // Check asset exists
        if (asset.issuer == address(0)) revert AssetNotFound();
        
        // Verify buyer eligibility (check if they have registered commitment)
        (, , bool buyerIsActive) = zkVerifier.userCommitments(msg.sender);
        if (!buyerIsActive) revert BuyerNotEligible();
        
        // Check issuer has enough fractions
        uint256 issuerBalance = balanceOf(asset.issuer, tokenId);
        if (issuerBalance < amount) revert InsufficientFractionsAvailable();
        
        // Calculate cost based on asset total value
        uint256 cost = (asset.totalValue * amount) / asset.fractionCount;
        if (msg.value < cost) revert InsufficientPayment();
        
        // Transfer payment to contract owner
        (bool success, ) = owner().call{value: cost}("");
        require(success, "Payment transfer failed");
        
        // Refund excess payment
        if (msg.value > cost) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - cost}("");
            require(refundSuccess, "Refund failed");
        }
        
        // Transfer fractions from issuer to buyer
        _safeTransferFrom(asset.issuer, msg.sender, tokenId, amount, "");
        
        // Emit event
        emit FractionPurchased(tokenId, msg.sender, amount, cost);
    }

    /**
     * @notice Get metadata for a specific RWA token
     * @param tokenId The ID of the RWA token
     * @return AssetMetadata struct containing all asset information
     */
    function getAssetMetadata(uint256 tokenId) external view returns (AssetMetadata memory) {
        return assets[tokenId];
    }

    /**
     * @notice Override safeTransferFrom to integrate FractionManager validation
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public override {
        // Validate transfer through FractionManager (reverts on failure)
        fractionManager.validateTransfer(id, value, from);
        
        // Check recipient eligibility (must have registered commitment)
        (, , bool toIsActive) = zkVerifier.userCommitments(to);
        if (!toIsActive) revert BuyerNotEligible();
        
        // Call parent implementation
        super.safeTransferFrom(from, to, id, value, data);
    }

    /**
     * @notice Override safeBatchTransferFrom to integrate FractionManager validation
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public override {
        // Validate each transfer through FractionManager
        for (uint256 i = 0; i < ids.length; i++) {
            fractionManager.validateTransfer(ids[i], values[i], from);
        }
        
        // Check recipient eligibility
        (, , bool batchToIsActive) = zkVerifier.userCommitments(to);
        if (!batchToIsActive) revert BuyerNotEligible();
        
        // Call parent implementation
        super.safeBatchTransferFrom(from, to, ids, values, data);
    }

    /**
     * @notice Update the URI for token metadata
     * @param newuri New base URI for token metadata
     */
    function setURI(string memory newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @notice Withdraw contract balance (emergency function)
     */
    function withdraw() external onlyOwner {
        (bool success, ) = owner().call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @notice Burn fractions (implements IRWATokenFactory interface for FractionManager)
     */
    function burn(address account, uint256 tokenId, uint256 amount) external {
        require(msg.sender == address(fractionManager), "Only FractionManager can burn");
        _burn(account, tokenId, amount);
    }

    /**
     * @notice Mint whole token (implements IRWATokenFactory interface for FractionManager)
     */
    function mint(address account, uint256 tokenId, uint256 amount) external {
        require(msg.sender == address(fractionManager), "Only FractionManager can mint");
        _mint(account, tokenId, amount, "");
    }
}
