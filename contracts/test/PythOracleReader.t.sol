// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/PythOracleReader.sol";

contract PythOracleReaderTest is Test {
    PythOracleReader public pythOracle;

    address public owner = address(1);
    address public updater = address(2);

    // Mock Pyth contract on Mantle Testnet
    address public mockPythContract = address(0xA2aa501b19aff244D90cc15a4Cf739D2725B5729);

    // Pyth price feed IDs (Mantle Testnet)
    bytes32 public constant ETH_USD_FEED = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
    bytes32 public constant BTC_USD_FEED = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;

    function setUp() public {
        vm.prank(owner);
        pythOracle = new PythOracleReader(mockPythContract);
    }

    function testInitialSetup() public view {
        assertEq(pythOracle.pythContract(), mockPythContract);
        assertTrue(pythOracle.supportedFeeds(ETH_USD_FEED));
        assertTrue(pythOracle.supportedFeeds(BTC_USD_FEED));
        assertEq(pythOracle.stalenessThreshold(), 300); // 5 minutes
    }

    function testUpdatePrice() public {
        // TODO: Test price update with mock Pyth data
        vm.startPrank(updater);
        bytes memory mockPriceUpdate = abi.encode("mock_price_data");
        
        // vm.deal(updater, 1 ether);
        // pythOracle.updatePrice{value: 0.001 ether}(ETH_USD_FEED, mockPriceUpdate);
        
        vm.stopPrank();
    }

    function testGetLatestPrice() public {
        // TODO: Test retrieving latest cached price
        // (int64 price, uint64 timestamp) = pythOracle.getLatestPrice(ETH_USD_FEED);
        // assertGt(price, 0);
        // assertGt(timestamp, 0);
    }

    function testRecordMintPrice() public {
        // TODO: Test recording price at mint time
        uint256 tokenId = 1;
        // pythOracle.recordMintPrice(tokenId, ETH_USD_FEED);
        // int64 mintPrice = pythOracle.getPriceAtMint(tokenId);
        // assertGt(mintPrice, 0);
    }

    function testPriceStaleCheck() public view {
        // TODO: Test staleness detection
        // bool isStale = pythOracle.isPriceStale(ETH_USD_FEED);
    }

    function testAddPriceFeed() public {
        vm.startPrank(owner);
        
        bytes32 newFeedId = keccak256("NEW_FEED");
        pythOracle.addPriceFeed(newFeedId);
        
        assertTrue(pythOracle.supportedFeeds(newFeedId));
        
        vm.stopPrank();
    }

    function testFailUnauthorizedAddFeed() public {
        // Should fail when non-owner tries to add feed
        vm.prank(updater);
        pythOracle.addPriceFeed(keccak256("UNAUTHORIZED_FEED"));
    }
}
