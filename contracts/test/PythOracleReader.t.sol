// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PythOracleReader.sol";
import "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";

contract PythOracleReaderTest is Test {
    PythOracleReader public oracleReader;
    MockPyth public mockPyth;
    
    address public owner = address(1);
    address public user = address(2);
    address public backend = address(3);
    
    // Price feed IDs (matching PythOracleReader constants)
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    bytes32 public constant USDC_USD_FEED = 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a;
    
    // Test prices
    int64 constant ETH_PRICE = 2000_00000000; // $2000 with 8 decimals
    int64 constant BTC_PRICE = 50000_00000000; // $50000 with 8 decimals
    int64 constant USDC_PRICE = 1_00000000; // $1 with 8 decimals
    
    uint64 constant CONFIDENCE = 100000000; // 1.0 with 8 decimals
    int32 constant EXPO = -8; // Price is scaled by 10^-8
    
    function setUp() public {
        // Deploy MockPyth
        mockPyth = new MockPyth(60, 1); // validTimePeriod=60s, singleUpdateFee=1 wei
        
        // Deploy PythOracleReader with MockPyth
        vm.prank(owner);
        oracleReader = new PythOracleReader(address(mockPyth));
        
        // Give backend some ETH for price updates
        vm.deal(backend, 100 ether);
        vm.deal(user, 10 ether);
    }

    // ============ Constructor Tests ============

    function testConstructorInitialization() public {
        assertEq(address(oracleReader.pyth()), address(mockPyth));
        assertEq(oracleReader.owner(), owner);
        assertEq(oracleReader.stalenessThreshold(), 600); // 10 minutes
        
        // Check default supported feeds
        assertTrue(oracleReader.isSupportedFeed(ETH_USD_FEED));
        assertTrue(oracleReader.isSupportedFeed(BTC_USD_FEED));
        assertTrue(oracleReader.isSupportedFeed(USDC_USD_FEED));
    }

    function testConstructorRevertsWithZeroAddress() public {
        vm.expectRevert("Invalid Pyth address");
        new PythOracleReader(address(0));
    }

    // ============ Price Update Tests ============

    function testUpdatePrice() public {
        // Create price update for ETH/USD
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_USD_FEED,
            ETH_PRICE,
            CONFIDENCE,
            EXPO,
            ETH_PRICE,
            CONFIDENCE,
            uint64(block.timestamp)
        );
        
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        
        vm.prank(backend);
        vm.expectEmit(true, true, true, true);
        emit PythOracleReader.PriceUpdated(ETH_USD_FEED, ETH_PRICE, uint64(block.timestamp), CONFIDENCE);
        
        oracleReader.updatePrice{value: updateFee}(ETH_USD_FEED, updateData);
        
        // Verify cached price
        (int64 price, uint64 timestamp) = oracleReader.getLatestPrice(ETH_USD_FEED);
        assertEq(price, ETH_PRICE);
        assertEq(timestamp, block.timestamp);
    }

    function testUpdatePriceRevertsForUnsupportedFeed() public {
        bytes32 unsupportedFeed = bytes32(uint256(12345));
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            unsupportedFeed,
            ETH_PRICE,
            CONFIDENCE,
            EXPO,
            ETH_PRICE,
            CONFIDENCE,
            uint64(block.timestamp)
        );
        
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        
        vm.prank(backend);
        vm.expectRevert(abi.encodeWithSelector(PythOracleReader.PriceFeedNotSupported.selector, unsupportedFeed));
        oracleReader.updatePrice{value: updateFee}(unsupportedFeed, updateData);
    }

    function testUpdatePriceRevertsWithInsufficientFee() public {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_USD_FEED,
            ETH_PRICE,
            CONFIDENCE,
            EXPO,
            ETH_PRICE,
            CONFIDENCE,
            uint64(block.timestamp)
        );
        
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        
        vm.prank(backend);
        vm.expectRevert(abi.encodeWithSelector(
            PythOracleReader.InsufficientUpdateFee.selector,
            updateFee,
            0
        ));
        oracleReader.updatePrice{value: 0}(ETH_USD_FEED, updateData);
    }

    function testUpdatePriceRefundsExcessPayment() public {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_USD_FEED,
            ETH_PRICE,
            CONFIDENCE,
            EXPO,
            ETH_PRICE,
            CONFIDENCE,
            uint64(block.timestamp)
        );
        
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        uint256 excess = 1 ether;
        uint256 balanceBefore = backend.balance;
        
        vm.prank(backend);
        oracleReader.updatePrice{value: updateFee + excess}(ETH_USD_FEED, updateData);
        
        // Should refund excess
        assertEq(backend.balance, balanceBefore - updateFee);
    }

    // ============ Get Latest Price Tests ============

    function testGetLatestPrice() public {
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        (int64 price, uint64 timestamp) = oracleReader.getLatestPrice(ETH_USD_FEED);
        assertEq(price, ETH_PRICE);
        assertEq(timestamp, block.timestamp);
    }

    function testGetLatestPriceRevertsWhenNotAvailable() public {
        vm.expectRevert(abi.encodeWithSelector(PythOracleReader.PriceDataNotAvailable.selector, ETH_USD_FEED));
        oracleReader.getLatestPrice(ETH_USD_FEED);
    }

    function testGetLatestPriceRevertsWhenStale() public {
        // Update price at time T
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        // Advance time beyond staleness threshold
        vm.warp(block.timestamp + 601); // 10 minutes + 1 second
        
        vm.expectRevert(abi.encodeWithSelector(PythOracleReader.PriceDataStale.selector, ETH_USD_FEED, 601));
        oracleReader.getLatestPrice(ETH_USD_FEED);
    }

    function testGetCachedPriceUnsafe() public {
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        // Advance time beyond staleness threshold
        vm.warp(block.timestamp + 601);
        
        // Should still return price without staleness check
        (int64 price, uint64 timestamp) = oracleReader.getCachedPriceUnsafe(ETH_USD_FEED);
        assertEq(price, ETH_PRICE);
        assertEq(timestamp, block.timestamp - 601);
    }

    // ============ Mint Price Recording Tests ============

    function testRecordMintPrice() public {
        uint256 tokenId = 1;
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        vm.expectEmit(true, true, true, true);
        emit PythOracleReader.MintPriceRecorded(tokenId, ETH_USD_FEED, ETH_PRICE);
        
        oracleReader.recordMintPrice(tokenId, ETH_USD_FEED);
        
        assertEq(oracleReader.getPriceAtMint(tokenId), ETH_PRICE);
    }

    function testRecordMintPriceRevertsWhenNotAvailable() public {
        uint256 tokenId = 1;
        
        vm.expectRevert(abi.encodeWithSelector(PythOracleReader.PriceDataNotAvailable.selector, ETH_USD_FEED));
        oracleReader.recordMintPrice(tokenId, ETH_USD_FEED);
    }

    function testGetPriceAtMint() public {
        uint256 tokenId = 1;
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        oracleReader.recordMintPrice(tokenId, ETH_USD_FEED);
        
        assertEq(oracleReader.getPriceAtMint(tokenId), ETH_PRICE);
    }

    // ============ Staleness Check Tests ============

    function testIsPriceStale() public {
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        assertFalse(oracleReader.isPriceStale(ETH_USD_FEED));
        
        // Advance time
        vm.warp(block.timestamp + 601);
        
        assertTrue(oracleReader.isPriceStale(ETH_USD_FEED));
    }

    function testIsPriceStaleWithInvalidData() public {
        assertTrue(oracleReader.isPriceStale(ETH_USD_FEED)); // No data cached
    }

    function testGetPriceAge() public {
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        assertEq(oracleReader.getPriceAge(ETH_USD_FEED), 0);
        
        vm.warp(block.timestamp + 300); // 5 minutes
        
        assertEq(oracleReader.getPriceAge(ETH_USD_FEED), 300);
    }

    // ============ Admin Functions Tests ============

    function testAddPriceFeed() public {
        bytes32 newFeedId = bytes32(uint256(99999));
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit PythOracleReader.PriceFeedAdded(newFeedId);
        
        oracleReader.addPriceFeed(newFeedId);
        
        assertTrue(oracleReader.isSupportedFeed(newFeedId));
    }

    function testAddPriceFeedRevertsForNonOwner() public {
        bytes32 newFeedId = bytes32(uint256(99999));
        
        vm.prank(user);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user));
        oracleReader.addPriceFeed(newFeedId);
    }

    function testRemovePriceFeed() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit PythOracleReader.PriceFeedRemoved(ETH_USD_FEED);
        
        oracleReader.removePriceFeed(ETH_USD_FEED);
        
        assertFalse(oracleReader.isSupportedFeed(ETH_USD_FEED));
    }

    function testSetStalenessThreshold() public {
        uint256 newThreshold = 1200; // 20 minutes
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit PythOracleReader.StalenessThresholdUpdated(600, newThreshold);
        
        oracleReader.setStalenessThreshold(newThreshold);
        
        assertEq(oracleReader.stalenessThreshold(), newThreshold);
    }

    function testSetStalenessThresholdRevertsWithZero() public {
        vm.prank(owner);
        vm.expectRevert("Invalid threshold");
        oracleReader.setStalenessThreshold(0);
    }

    function testWithdrawETH() public {
        // Send some ETH to contract
        vm.deal(address(oracleReader), 1 ether);
        
        uint256 balanceBefore = owner.balance;
        
        vm.prank(owner);
        oracleReader.withdrawETH();
        
        assertEq(owner.balance, balanceBefore + 1 ether);
        assertEq(address(oracleReader).balance, 0);
    }

    // ============ Helper Functions Tests ============

    function testGetPriceData() public {
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        PythOracleReader.PriceData memory data = oracleReader.getPriceData(ETH_USD_FEED);
        
        assertEq(data.price, ETH_PRICE);
        assertEq(data.timestamp, block.timestamp);
        assertEq(data.confidence, CONFIDENCE);
        assertEq(data.expo, EXPO);
        assertTrue(data.isValid);
    }

    function testGetUpdateFee() public {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            ETH_USD_FEED,
            ETH_PRICE,
            CONFIDENCE,
            EXPO,
            ETH_PRICE,
            CONFIDENCE,
            uint64(block.timestamp)
        );
        
        uint256 fee = oracleReader.getUpdateFee(updateData);
        assertEq(fee, 1); // MockPyth singleUpdateFee
    }

    // ============ Integration Tests ============

    function testMultiplePriceFeeds() public {
        uint256 startTime = block.timestamp;
        
        // Update ETH price
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, startTime);
        
        // Update BTC price (same timestamp)
        _updateMockPrice(BTC_USD_FEED, BTC_PRICE, startTime);
        
        // Update USDC price (same timestamp)
        _updateMockPrice(USDC_USD_FEED, USDC_PRICE, startTime);
        
        // Verify all prices
        (int64 ethPrice,) = oracleReader.getLatestPrice(ETH_USD_FEED);
        (int64 btcPrice,) = oracleReader.getLatestPrice(BTC_USD_FEED);
        (int64 usdcPrice,) = oracleReader.getLatestPrice(USDC_USD_FEED);
        
        assertEq(ethPrice, ETH_PRICE);
        assertEq(btcPrice, BTC_PRICE);
        assertEq(usdcPrice, USDC_PRICE);
    }

    function testPriceUpdateAndMintRecording() public {
        uint256 tokenId = 1;
        
        // Update price
        _updateMockPrice(ETH_USD_FEED, ETH_PRICE, block.timestamp);
        
        // Record mint price
        oracleReader.recordMintPrice(tokenId, ETH_USD_FEED);
        
        // Update price again
        int64 newPrice = 2100_00000000;
        vm.warp(block.timestamp + 100);
        _updateMockPrice(ETH_USD_FEED, newPrice, block.timestamp);
        
        // Mint price should remain at original
        assertEq(oracleReader.getPriceAtMint(tokenId), ETH_PRICE);
        
        // Latest price should be updated
        (int64 latestPrice,) = oracleReader.getLatestPrice(ETH_USD_FEED);
        assertEq(latestPrice, newPrice);
    }

    // ============ Helper Functions ============

    function _updateMockPrice(bytes32 priceId, int64 price, uint256 timestamp) internal {
        bytes[] memory updateData = new bytes[](1);
        updateData[0] = mockPyth.createPriceFeedUpdateData(
            priceId,
            price,
            CONFIDENCE,
            EXPO,
            price,
            CONFIDENCE,
            uint64(timestamp)
        );
        
        uint256 updateFee = mockPyth.getUpdateFee(updateData);
        oracleReader.updatePrice{value: updateFee}(priceId, updateData);
    }
}
