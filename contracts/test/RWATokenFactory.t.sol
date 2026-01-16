// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RWATokenFactory.sol";
import "../src/ZKVerifier.sol";
import "../src/PythOracleReader.sol";
import "../src/FractionManager.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract RWATokenFactoryTest is Test {
    RWATokenFactory public factory;
    ZKVerifier public zkVerifier;
    PythOracleReader public pythOracle;
    FractionManager public fractionManager;
    MockPyth public mockPyth;

    address public owner = address(1);
    address public issuer = address(2);
    address public buyer = address(3);
    address public unauthorized = address(4);

    bytes32 public constant ETH_USD_PRICE_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    
    // Sample data for minting
    string constant DOCUMENT_HASH = "QmTest123456789";
    uint256 constant TOTAL_VALUE = 100000; // $1000.00 in cents
    uint256 constant FRACTION_COUNT = 100;
    uint256 constant MIN_FRACTION_SIZE = 1;
    uint256 constant LOCKUP_WEEKS = 0;
    
    function setUp() public {
        // Fund owner first
        vm.deal(owner, 100 ether);
        
        vm.startPrank(owner);
        
        // Deploy MockPyth
        uint64 validTimePeriod = 3600; // 1 hour
        mockPyth = new MockPyth(validTimePeriod, 1);
        
        // Deploy core contracts
        zkVerifier = new ZKVerifier();
        pythOracle = new PythOracleReader(address(mockPyth));
        fractionManager = new FractionManager(address(pythOracle));
        
        // Deploy factory
        factory = new RWATokenFactory(
            address(zkVerifier),
            payable(address(pythOracle)),
            address(fractionManager)
        );
        
        // Set factory reference in FractionManager
        fractionManager.setRWAFactory(address(factory));
        
        vm.stopPrank();
        
        // Fund test accounts
        vm.deal(issuer, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(unauthorized, 100 ether);
        
        // Register commitments for issuer and buyer
        vm.prank(issuer);
        zkVerifier.registerCommitment(keccak256(abi.encodePacked("issuer_secret")));
        
        vm.prank(buyer);
        zkVerifier.registerCommitment(keccak256(abi.encodePacked("buyer_secret")));
        
        // Setup mock price feed
        int64 ethPrice = 2000_00000000; // $2000 with 8 decimals
        uint64 timestamp = uint64(block.timestamp);
        
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_USD_PRICE_ID,
            ethPrice,
            1_00000000, // confidence
            -8, // expo
            ethPrice, // ema price
            1_00000000, // ema confidence
            timestamp
        );
        
        // Get update fee and update price through PythOracleReader
        vm.startPrank(owner);
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        pythOracle.updatePrice{value: updateFee}(ETH_USD_PRICE_ID, updateData);
        vm.stopPrank();
    }

    // ============ Constructor Tests ============
    
    function testConstructor() public view {
        assertEq(address(factory.zkVerifier()), address(zkVerifier));
        assertEq(address(factory.pythOracle()), address(pythOracle));
        assertEq(address(factory.fractionManager()), address(fractionManager));
        assertEq(factory.nextTokenId(), 1);
        assertEq(factory.owner(), owner);
    }

    // ============ mintRWAToken Tests ============
    
    function testMintRWAToken() public {
        vm.startPrank(issuer);
        
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
        
        // Verify token ID
        assertEq(tokenId, 1);
        assertEq(factory.nextTokenId(), 2);
        
        // Verify asset metadata
        RWATokenFactory.AssetMetadata memory metadata = factory.getAssetMetadata(tokenId);
        assertEq(metadata.issuer, issuer);
        assertEq(metadata.documentHash, DOCUMENT_HASH);
        assertEq(metadata.totalValue, TOTAL_VALUE);
        assertEq(metadata.fractionCount, FRACTION_COUNT);
        assertEq(metadata.minFractionSize, MIN_FRACTION_SIZE);
        assertEq(metadata.mintTimestamp, block.timestamp);
        assertEq(metadata.oraclePriceAtMint, 2000_00000000);
        assertEq(metadata.priceId, ETH_USD_PRICE_ID);
        assertTrue(metadata.verified);
        
        // Verify issuer received all fractions
        assertEq(factory.balanceOf(issuer, tokenId), FRACTION_COUNT);
    }
    
    function testMintRWATokenWithLockup() public {
        vm.startPrank(issuer);
        
        uint256 lockupWeeks = 4; // 4 weeks = 28 days
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            lockupWeeks,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
        
        // Verify lockup was set in FractionManager
        (uint256 totalSupply, uint256 minUnitSize, uint256 lockupPeriod, uint256 lockupEnd, bool isActive) = 
            fractionManager.fractionSpecs(tokenId);
        
        assertEq(totalSupply, FRACTION_COUNT);
        assertEq(minUnitSize, MIN_FRACTION_SIZE);
        assertEq(lockupPeriod, lockupWeeks * 7); // Converted to days
        assertEq(lockupEnd, block.timestamp + (lockupWeeks * 7 days));
        assertTrue(isActive);
    }
    
    function testMintRWATokenRevertsWithZeroTotalValue() public {
        vm.startPrank(issuer);
        
        vm.expectRevert(RWATokenFactory.InvalidTotalValue.selector);
        factory.mintRWAToken(
            DOCUMENT_HASH,
            0, // Invalid
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
    }
    
    function testMintRWATokenRevertsWithZeroFractionCount() public {
        vm.startPrank(issuer);
        
        vm.expectRevert(RWATokenFactory.InvalidFractionCount.selector);
        factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            0, // Invalid
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
    }
    
    function testMintRWATokenRevertsWithInvalidMinFractionSize() public {
        vm.startPrank(issuer);
        
        // Zero min fraction size
        vm.expectRevert(RWATokenFactory.InvalidMinFractionSize.selector);
        factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            0, // Invalid
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        // Min fraction size greater than fraction count
        vm.expectRevert(RWATokenFactory.InvalidMinFractionSize.selector);
        factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            FRACTION_COUNT + 1, // Invalid
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
    }
    
    function testMintRWATokenRevertsWithoutCommitment() public {
        vm.startPrank(unauthorized);
        
        vm.expectRevert(RWATokenFactory.IssuerNotEligible.selector);
        factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
    }
    
    function testMintRWATokenEmitsEvent() public {
        vm.startPrank(issuer);
        
        vm.expectEmit(true, true, false, true);
        emit RWATokenFactory.AssetMinted(
            1,
            issuer,
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            ETH_USD_PRICE_ID,
            2000_00000000
        );
        
        factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.stopPrank();
    }

    // ============ purchaseFraction Tests ============
    
    function testPurchaseFraction() public {
        // First, mint an RWA token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        // Calculate expected cost
        uint256 amount = 10;
        uint256 expectedCost = (TOTAL_VALUE * amount) / FRACTION_COUNT; // $100 in cents = 10000
        
        // Buyer purchases fractions
        vm.startPrank(buyer);
        
        uint256 ownerBalanceBefore = owner.balance;
        uint256 buyerBalanceBefore = buyer.balance;
        
        factory.purchaseFraction{value: expectedCost}(tokenId, amount, "");
        
        vm.stopPrank();
        
        // Verify buyer received fractions
        assertEq(factory.balanceOf(buyer, tokenId), amount);
        
        // Verify issuer's balance decreased
        assertEq(factory.balanceOf(issuer, tokenId), FRACTION_COUNT - amount);
        
        // Verify payment went to owner
        assertEq(owner.balance, ownerBalanceBefore + expectedCost);
        assertEq(buyer.balance, buyerBalanceBefore - expectedCost);
    }
    
    function testPurchaseFractionWithExcessPayment() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        uint256 amount = 10;
        uint256 expectedCost = (TOTAL_VALUE * amount) / FRACTION_COUNT;
        uint256 excessPayment = 1 ether;
        
        // Purchase with excess payment
        vm.startPrank(buyer);
        
        uint256 buyerBalanceBefore = buyer.balance;
        
        factory.purchaseFraction{value: expectedCost + excessPayment}(tokenId, amount, "");
        
        vm.stopPrank();
        
        // Verify excess was refunded
        assertEq(buyer.balance, buyerBalanceBefore - expectedCost);
    }
    
    function testPurchaseFractionRevertsForNonExistentAsset() public {
        vm.startPrank(buyer);
        
        vm.expectRevert(RWATokenFactory.AssetNotFound.selector);
        factory.purchaseFraction{value: 1 ether}(999, 10, "");
        
        vm.stopPrank();
    }
    
    function testPurchaseFractionRevertsWithoutCommitment() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.startPrank(unauthorized);
        
        // Try with value to pass payment check
        vm.expectRevert(RWATokenFactory.BuyerNotEligible.selector);
        factory.purchaseFraction{value: 100000}(tokenId, 10, "");
        
        vm.stopPrank();
    }
    
    function testPurchaseFractionRevertsWithInsufficientFractions() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.startPrank(buyer);
        
        // Try to purchase more than available
        vm.expectRevert(RWATokenFactory.InsufficientFractionsAvailable.selector);
        factory.purchaseFraction{value: 1 ether}(tokenId, FRACTION_COUNT + 1, "");
        
        vm.stopPrank();
    }
    
    function testPurchaseFractionRevertsWithInsufficientPayment() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        uint256 amount = 10;
        uint256 expectedCost = (TOTAL_VALUE * amount) / FRACTION_COUNT;
        
        vm.startPrank(buyer);
        
        vm.expectRevert(RWATokenFactory.InsufficientPayment.selector);
        factory.purchaseFraction{value: expectedCost - 1}(tokenId, amount, "");
        
        vm.stopPrank();
    }
    
    function testPurchaseFractionEmitsEvent() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        uint256 amount = 10;
        uint256 expectedCost = (TOTAL_VALUE * amount) / FRACTION_COUNT;
        
        vm.startPrank(buyer);
        
        vm.expectEmit(true, true, false, true);
        emit RWATokenFactory.FractionPurchased(tokenId, buyer, amount, expectedCost);
        
        factory.purchaseFraction{value: expectedCost}(tokenId, amount, "");
        
        vm.stopPrank();
    }

    // ============ Transfer Override Tests ============
    
    function testSafeTransferFromWithValidation() public {
        // Mint token with no lockup
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        // Transfer within valid parameters
        vm.startPrank(issuer);
        factory.safeTransferFrom(issuer, buyer, tokenId, 10, "");
        vm.stopPrank();
        
        // Verify transfer succeeded
        assertEq(factory.balanceOf(buyer, tokenId), 10);
        assertEq(factory.balanceOf(issuer, tokenId), FRACTION_COUNT - 10);
    }
    
    function testSafeTransferFromRevertsBelowMinimum() public {
        // Mint token with minFractionSize = 5
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            5, // minFractionSize
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.startPrank(issuer);
        
        // Try to transfer below minimum - should revert
        vm.expectRevert();
        factory.safeTransferFrom(issuer, buyer, tokenId, 3, "");
        
        vm.stopPrank();
    }
    
    function testSafeTransferFromRevertsDuringLockup() public {
        // Mint token with 4 week lockup
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            4, // 4 weeks lockup
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.startPrank(issuer);
        
        // Try to transfer during lockup - should revert
        vm.expectRevert();
        factory.safeTransferFrom(issuer, buyer, tokenId, 10, "");
        
        vm.stopPrank();
    }
    
    function testSafeTransferFromSucceedsAfterLockup() public {
        // Mint token with 1 week lockup
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            1, // 1 week lockup
            "",
            ETH_USD_PRICE_ID
        );
        
        // Fast forward past lockup
        vm.warp(block.timestamp + 8 days);
        
        // Transfer should succeed
        vm.startPrank(issuer);
        factory.safeTransferFrom(issuer, buyer, tokenId, 10, "");
        vm.stopPrank();
        
        assertEq(factory.balanceOf(buyer, tokenId), 10);
    }
    
    function testSafeTransferFromRevertsToUnregisteredAddress() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.startPrank(issuer);
        
        // Try to transfer to unauthorized address
        vm.expectRevert(RWATokenFactory.BuyerNotEligible.selector);
        factory.safeTransferFrom(issuer, unauthorized, tokenId, 10, "");
        
        vm.stopPrank();
    }
    
    function testSafeBatchTransferFromWithValidation() public {
        // Mint two tokens
        vm.startPrank(issuer);
        uint256 tokenId1 = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        uint256 tokenId2 = factory.mintRWAToken(
            "QmTest987654321",
            TOTAL_VALUE * 2,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        vm.stopPrank();
        
        // Batch transfer
        uint256[] memory ids = new uint256[](2);
        ids[0] = tokenId1;
        ids[1] = tokenId2;
        
        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;
        
        vm.startPrank(issuer);
        factory.safeBatchTransferFrom(issuer, buyer, ids, amounts, "");
        vm.stopPrank();
        
        // Verify transfers
        assertEq(factory.balanceOf(buyer, tokenId1), 10);
        assertEq(factory.balanceOf(buyer, tokenId2), 20);
    }

    // ============ Admin Functions Tests ============
    
    function testSetURI() public {
        vm.prank(owner);
        factory.setURI("https://example.com/metadata/");
        
        // URI is set (can't directly test without minting and checking)
    }
    
    function testSetURIRevertsForNonOwner() public {
        vm.prank(unauthorized);
        vm.expectRevert();
        factory.setURI("https://example.com/metadata/");
    }
    
    function testWithdraw() public {
        // Send some funds to factory
        vm.deal(address(factory), 10 ether);
        
        uint256 ownerBalanceBefore = owner.balance;
        
        vm.prank(owner);
        factory.withdraw();
        
        assertEq(owner.balance, ownerBalanceBefore + 10 ether);
        assertEq(address(factory).balance, 0);
    }
    
    function testWithdrawRevertsForNonOwner() public {
        vm.deal(address(factory), 10 ether);
        
        vm.prank(unauthorized);
        vm.expectRevert();
        factory.withdraw();
    }

    // ============ Burn and Mint Interface Tests ============
    
    function testBurnOnlyByFractionManager() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        // Only FractionManager can burn
        vm.prank(address(fractionManager));
        factory.burn(issuer, tokenId, 10);
        
        assertEq(factory.balanceOf(issuer, tokenId), FRACTION_COUNT - 10);
    }
    
    function testBurnRevertsForUnauthorized() public {
        // Mint token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        vm.prank(unauthorized);
        vm.expectRevert("Only FractionManager can burn");
        factory.burn(issuer, tokenId, 10);
    }
    
    function testMintOnlyByFractionManager() public {
        // Only FractionManager can mint
        vm.prank(address(fractionManager));
        factory.mint(buyer, 999, 1);
        
        assertEq(factory.balanceOf(buyer, 999), 1);
    }
    
    function testMintRevertsForUnauthorized() public {
        vm.prank(unauthorized);
        vm.expectRevert("Only FractionManager can mint");
        factory.mint(buyer, 999, 1);
    }

    // ============ Integration Tests ============
    
    function testFullWorkflow() public {
        // 1. Issuer mints RWA token
        vm.prank(issuer);
        uint256 tokenId = factory.mintRWAToken(
            DOCUMENT_HASH,
            TOTAL_VALUE,
            FRACTION_COUNT,
            MIN_FRACTION_SIZE,
            LOCKUP_WEEKS,
            "",
            ETH_USD_PRICE_ID
        );
        
        // 2. Buyer purchases fractions
        uint256 purchaseAmount = 25;
        uint256 cost = (TOTAL_VALUE * purchaseAmount) / FRACTION_COUNT;
        
        vm.prank(buyer);
        factory.purchaseFraction{value: cost}(tokenId, purchaseAmount, "");
        
        // 3. Buyer transfers to another registered user
        address thirdParty = address(5);
        vm.deal(thirdParty, 100 ether);
        vm.prank(thirdParty);
        zkVerifier.registerCommitment(keccak256(abi.encodePacked("third_party_secret")));
        
        vm.prank(buyer);
        factory.safeTransferFrom(buyer, thirdParty, tokenId, 10, "");
        
        // Verify final balances
        assertEq(factory.balanceOf(issuer, tokenId), FRACTION_COUNT - purchaseAmount);
        assertEq(factory.balanceOf(buyer, tokenId), purchaseAmount - 10);
        assertEq(factory.balanceOf(thirdParty, tokenId), 10);
    }
}
