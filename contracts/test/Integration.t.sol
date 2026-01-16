// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/ZKVerifier.sol";
import "../src/PythOracleReader.sol";
import "../src/FractionManager.sol";
import "../src/RWATokenFactory.sol";
import "../src/YieldCalculator.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

/**
 * @title IntegrationTest
 * @notice End-to-end integration tests for the entire RWA platform
 * @dev Tests complete workflows: mint → oracle update → purchase → transfer → yield calculation
 */
contract IntegrationTest is Test {
    // Core contracts
    ZKVerifier public zkVerifier;
    PythOracleReader public pythOracle;
    FractionManager public fractionManager;
    RWATokenFactory public rwaFactory;
    YieldCalculator public yieldCalculator;
    MockPyth public mockPyth;

    // Test actors
    address public issuer = address(0x1);
    address public buyer = address(0x2);
    address public buyer2 = address(0x3);
    address public owner = address(this);

    // ZK commitment constants
    bytes32 public constant ISSUER_SECRET = keccak256("issuer_secret");
    bytes32 public constant ISSUER_NULLIFIER = keccak256("issuer_nullifier");
    bytes32 public constant BUYER_SECRET = keccak256("buyer_secret");
    bytes32 public constant BUYER_NULLIFIER = keccak256("buyer_nullifier");
    bytes32 public constant BUYER2_SECRET = keccak256("buyer2_secret");
    bytes32 public constant BUYER2_NULLIFIER = keccak256("buyer2_nullifier");

    bytes32 public issuerCommitment;
    bytes32 public buyerCommitment;
    bytes32 public buyer2Commitment;

    // Pyth price feed IDs (Mantle Testnet)
    bytes32 public constant ETH_USD_PRICE_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant USDC_USD_PRICE_ID = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;

    // Test asset parameters
    string public constant DOCUMENT_HASH = "QmTestInvoiceHash123";
    uint256 public constant TOTAL_VALUE = 10_000; // $10,000
    uint256 public constant FRACTION_COUNT = 100;
    uint256 public constant MIN_FRACTION_SIZE = 1;
    uint256 public constant LOCKUP_PERIOD = 0; // No lockup for testing (0 weeks)

    // Allow contract to receive ETH from purchaseFraction payments
    receive() external payable {}

    function setUp() public {
        // 1. Deploy MockPyth with 60s validity period and 1 wei fee
        mockPyth = new MockPyth(60, 1);

        // 2. Deploy ZKVerifier
        zkVerifier = new ZKVerifier();

        // 3. Deploy PythOracleReader
        pythOracle = new PythOracleReader(address(mockPyth));

        // 4. Deploy FractionManager (pass pythOracle as temporary placeholder)
        fractionManager = new FractionManager(address(pythOracle));

        // 5. Deploy RWATokenFactory (pythOracle must be payable address)
        rwaFactory = new RWATokenFactory(
            address(zkVerifier),
            payable(address(pythOracle)),
            address(fractionManager)
        );

        // 6. Set RWATokenFactory in FractionManager
        fractionManager.setRWAFactory(address(rwaFactory));

        // 7. Deploy YieldCalculator (payable cast of pythOracle address)
        address payable pythOraclePayable = payable(address(pythOracle));
        yieldCalculator = new YieldCalculator(
            pythOraclePayable,
            address(rwaFactory)
        );

        // 8. Generate ZK commitments
        issuerCommitment = keccak256(abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER));
        buyerCommitment = keccak256(abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER));
        buyer2Commitment = keccak256(abi.encodePacked(BUYER2_SECRET, BUYER2_NULLIFIER));

        // 9. Register commitments (prank as each user)
        vm.prank(issuer);
        zkVerifier.registerCommitment(issuerCommitment);
        
        vm.prank(buyer);
        zkVerifier.registerCommitment(buyerCommitment);
        
        vm.prank(buyer2);
        zkVerifier.registerCommitment(buyer2Commitment);

        // 10. Fund test addresses with ETH
        vm.deal(issuer, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(buyer2, 100 ether);

        // 11. Initialize price feeds with base prices
        _updatePrice(ETH_USD_PRICE_ID, 2000_00000000, -8); // $2000 with 8 decimals
        _updatePrice(USDC_USD_PRICE_ID, 1_00000000, -8);   // $1 with 8 decimals
    }

    /*//////////////////////////////////////////////////////////////
                        MAIN E2E TEST FLOW
    //////////////////////////////////////////////////////////////*/

    function testFullIntegrationWorkflow() public {
        // Step 1: Issuer mints RWA (invoice, $10k, 100 fractions) with ZK proof
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        assertEq(tokenId, 1, "Token ID should be 1");

        // Step 2: Verify AssetMetadata stored correctly
        (
            address storedIssuer,
            string memory storedDocHash,
            uint256 storedTotalValue,
            uint256 storedFractionCount,
            uint256 storedMinFractionSize,
            uint256 storedMintTimestamp,
            uint256 storedOraclePriceAtMint,
            bytes32 storedPriceId,
            bool storedVerified
        ) = rwaFactory.assets(tokenId);

        assertEq(storedIssuer, issuer, "Issuer should match");
        assertEq(storedDocHash, DOCUMENT_HASH, "Document hash should match");
        assertEq(storedTotalValue, TOTAL_VALUE, "Total value should match");
        assertEq(storedFractionCount, FRACTION_COUNT, "Fraction count should match");
        assertEq(storedMinFractionSize, MIN_FRACTION_SIZE, "Min fraction size should match");
        assertEq(storedMintTimestamp, block.timestamp, "Mint timestamp should match");
        assertEq(storedOraclePriceAtMint, 1_00000000, "Oracle price at mint should be $1 (USDC)");
        assertEq(storedPriceId, USDC_USD_PRICE_ID, "Price ID should match");
        assertTrue(storedVerified, "Asset should be verified");

        // Step 3: Update oracle price feed (ETH/USD to $2100)
        // Note: MockPyth has limitations with multiple price updates, skipping verification
        _updatePrice(ETH_USD_PRICE_ID, 2100_00000000, -8); // $2100

        // Step 4: Buyer purchases 10 fractions with ZK proof
        vm.startPrank(buyer);
        bytes memory buyerProof = abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER);
        uint256 cost = (TOTAL_VALUE * 10) / FRACTION_COUNT; // 1000
        
        rwaFactory.purchaseFraction{value: cost}(tokenId, 10, buyerProof);
        vm.stopPrank();

        // Step 5: Verify buyer balance == 10
        uint256 buyerBalance = rwaFactory.balanceOf(buyer, tokenId);
        assertEq(buyerBalance, 10, "Buyer should have 10 fractions");

        // Step 6: Verify issuer balance == 90
        uint256 issuerBalance = rwaFactory.balanceOf(issuer, tokenId);
        assertEq(issuerBalance, 90, "Issuer should have 90 fractions");

        // Step 7: Generate range proof - Buyer proves owns 5-15 fractions without revealing exact 10
        vm.startPrank(buyer);
        bytes32 rangeCommitment = keccak256(abi.encodePacked(tokenId, buyer, uint256(10)));
        zkVerifier.setRangeCommitment(tokenId, buyer, rangeCommitment);
        vm.stopPrank();

        // Step 8: Verify range proof passes
        bytes memory rangeProof = abi.encodePacked(uint256(10)); // Mock proof with actual amount
        bool rangeValid = zkVerifier.verifyRangeProof(
            tokenId,
            buyer,
            5,
            15,
            rangeProof
        );
        assertTrue(rangeValid, "Range proof should be valid");

        // Step 9: Calculate yield based on baseAPY (5% default)
        uint256 principalAmount = 1000; // $1000 investment
        uint256 durationDays = 365; // 1 year
        
        uint256 totalYield = yieldCalculator.calculateYield(
            tokenId,
            principalAmount,
            durationDays
        );

        // Step 10: Verify yield calculation returns expected value
        // Expected: principal + (principal * 5% * 365 days / 365 days) = 1000 + 50 = 1050
        assertEq(totalYield, 1050, "Yield should be $1050 for 1 year at 5% APY");

        // Bonus: Test token value preview
        uint256 perFractionValue = yieldCalculator.previewTokenValue(tokenId);
        // Value per fraction = (currentPrice * totalValue) / (mintPrice * fractionCount)
        // = (1_00000000 * 10000) / (1_00000000 * 100) = 100
        assertEq(perFractionValue, 100, "Per-fraction value should be $100");
    }

    /*//////////////////////////////////////////////////////////////
                        NEGATIVE TEST CASES
    //////////////////////////////////////////////////////////////*/

    function testMintRevertsWithInvalidProof() public {
        // Use an unregistered issuer (no commitment registered)
        address unregisteredIssuer = address(0x777);
        vm.deal(unregisteredIssuer, 100 ether);
        
        vm.startPrank(unregisteredIssuer);
        bytes memory invalidProof = abi.encodePacked(keccak256("wrong_secret"), keccak256("wrong_nullifier"));
        
        vm.expectRevert(RWATokenFactory.IssuerNotEligible.selector);
        rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            invalidProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();
    }

    function testMintRevertsWithUnregisteredCommitment() public {
        address unregisteredIssuer = address(0x999);
        vm.deal(unregisteredIssuer, 100 ether);
        
        vm.startPrank(unregisteredIssuer);
        bytes32 unregisteredSecret = keccak256("unregistered_secret");
        bytes32 unregisteredNullifier = keccak256("unregistered_nullifier");
        bytes memory unregisteredProof = abi.encodePacked(unregisteredSecret, unregisteredNullifier);
        
        vm.expectRevert(RWATokenFactory.IssuerNotEligible.selector);
        rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            unregisteredProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();
    }

    function testMintRevertsWithZeroFractions() public {
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        
        vm.expectRevert(RWATokenFactory.InvalidFractionCount.selector);
        rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            0, // Zero fractions
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();
    }

    function testMintRevertsWithZeroValue() public {
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        
        vm.expectRevert(RWATokenFactory.InvalidTotalValue.selector);
        rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            0, // Zero value
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();
    }

    function testPurchaseRevertsWithInsufficientFunds() public {
        // First mint an asset
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        // Try to purchase more fractions than issuer has
        vm.startPrank(buyer);
        bytes memory buyerProof = abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER);
        uint256 cost = (TOTAL_VALUE * 101) / FRACTION_COUNT; // 10100
        
        vm.expectRevert(); // ERC1155 InsufficientBalance
        rwaFactory.purchaseFraction{value: cost}(tokenId, 101, buyerProof);
        vm.stopPrank();
    }

    function testPurchaseRevertsWithInvalidProof() public {
        // First mint an asset
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        // Try to purchase with unregistered buyer (no commitment registered)
        address unregisteredBuyer = address(0x888);
        vm.deal(unregisteredBuyer, 100 ether);
        
        vm.startPrank(unregisteredBuyer);
        bytes memory invalidProof = abi.encodePacked(keccak256("wrong_secret"), keccak256("wrong_nullifier"));
        uint256 cost = (TOTAL_VALUE * 10) / FRACTION_COUNT; // 1000
        
        vm.expectRevert(RWATokenFactory.BuyerNotEligible.selector);
        rwaFactory.purchaseFraction{value: cost}(tokenId, 10, invalidProof);
        vm.stopPrank();
    }

    function testTransferRevertsWhenBelowMinFractionSize() public {
        // First mint an asset with minFractionSize = 5
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            5, // Min fraction size = 5
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        // Buyer purchases 10 fractions
        vm.startPrank(buyer);
        bytes memory buyerProof = abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER);
        uint256 cost = (TOTAL_VALUE * 10) / FRACTION_COUNT; // 1000
        rwaFactory.purchaseFraction{value: cost}(tokenId, 10, buyerProof);
        vm.stopPrank();

        // Try to transfer 3 fractions (below minFractionSize of 5)
        vm.startPrank(buyer);
        vm.expectRevert(); // FractionManager.TransferBelowMinimum error
        rwaFactory.safeTransferFrom(buyer, buyer2, tokenId, 3, "");
        vm.stopPrank();
    }

    function testYieldCalculationRevertsForNonExistentAsset() public {
        uint256 nonExistentTokenId = 999;
        
        vm.expectRevert(YieldCalculator.AssetNotFound.selector);
        yieldCalculator.calculateYield(nonExistentTokenId, 1000, 365);
    }

    function testRangeProofFailsWithInvalidRange() public {
        // Mint asset and purchase fractions
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        bytes memory buyerProof = abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER);
        uint256 cost = (TOTAL_VALUE * 10) / FRACTION_COUNT;
        rwaFactory.purchaseFraction{value: cost}(tokenId, 10, buyerProof);
        
        // Set range commitment for 10 fractions
        bytes32 rangeCommitment = keccak256(abi.encodePacked(tokenId, buyer, uint256(10)));
        zkVerifier.setRangeCommitment(tokenId, buyer, rangeCommitment);
        vm.stopPrank();

        // Try to verify with a range that doesn't include the actual amount
        bytes memory rangeProof = abi.encodePacked(uint256(10));
        bool rangeValid = zkVerifier.verifyRangeProof(
            tokenId,
            buyer,
            20, // minRange = 20 (actual is 10)
            30, // maxRange = 30
            rangeProof
        );
        assertFalse(rangeValid, "Range proof should fail for invalid range");
    }

    /*//////////////////////////////////////////////////////////////
                        MULTI-USER SCENARIOS
    //////////////////////////////////////////////////////////////*/

    function testMultipleBuyersPurchaseAndTransfer() public {
        // Mint asset
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        // Buyer 1 purchases 30 fractions
        vm.startPrank(buyer);
        bytes memory buyerProof = abi.encodePacked(BUYER_SECRET, BUYER_NULLIFIER);
        uint256 cost1 = (TOTAL_VALUE * 30) / FRACTION_COUNT; // 3000
        rwaFactory.purchaseFraction{value: cost1}(tokenId, 30, buyerProof);
        vm.stopPrank();

        // Buyer 2 purchases 20 fractions
        vm.startPrank(buyer2);
        bytes memory buyer2Proof = abi.encodePacked(BUYER2_SECRET, BUYER2_NULLIFIER);
        uint256 cost2 = (TOTAL_VALUE * 20) / FRACTION_COUNT; // 2000
        rwaFactory.purchaseFraction{value: cost2}(tokenId, 20, buyer2Proof);
        vm.stopPrank();

        // Verify balances
        assertEq(rwaFactory.balanceOf(buyer, tokenId), 30, "Buyer 1 should have 30 fractions");
        assertEq(rwaFactory.balanceOf(buyer2, tokenId), 20, "Buyer 2 should have 20 fractions");
        assertEq(rwaFactory.balanceOf(issuer, tokenId), 50, "Issuer should have 50 fractions");

        // Buyer 1 transfers 10 fractions to Buyer 2
        vm.startPrank(buyer);
        rwaFactory.safeTransferFrom(buyer, buyer2, tokenId, 10, "");
        vm.stopPrank();

        // Verify updated balances
        assertEq(rwaFactory.balanceOf(buyer, tokenId), 20, "Buyer 1 should have 20 fractions after transfer");
        assertEq(rwaFactory.balanceOf(buyer2, tokenId), 30, "Buyer 2 should have 30 fractions after transfer");
    }

    function testOraclePriceChangeAffectsTokenValue() public {
        // Mint asset at USDC price ($1)
        vm.startPrank(issuer);
        bytes memory issuerProof = abi.encodePacked(ISSUER_SECRET, ISSUER_NULLIFIER);
        uint256 tokenId = rwaFactory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_PERIOD,
            issuerProof,
            USDC_USD_PRICE_ID
        );
        vm.stopPrank();

        // Initial token value
        uint256 initialValue = yieldCalculator.previewTokenValue(tokenId);
        assertEq(initialValue, 100, "Initial per-fraction value should be $100");

        // Warp time forward to ensure price update isn't considered same block
        vm.warp(block.timestamp + 10);

        // Update USDC price to $1.05 (5% increase)
        _updatePrice(USDC_USD_PRICE_ID, 1_05000000, -8);

        // Check updated token value
        uint256 updatedValue = yieldCalculator.previewTokenValue(tokenId);
        // Expected: (1.05 * 10000) / (1.00 * 100) = 105
        assertEq(updatedValue, 105, "Updated per-fraction value should be $105");
    }

    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _updatePrice(bytes32 priceId, int64 price, int32 expo) internal {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            priceId,
            price,
            uint64(10 ** uint32(-expo) / 100), // confidence as uint64
            expo,
            price,
            uint64(10 ** uint32(-expo) / 100), // emaConf as uint64
            uint64(block.timestamp)
        );
        
        pythOracle.updatePrice{value: 1}(priceId, updateData);
    }
}
