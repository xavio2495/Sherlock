// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/YieldCalculator.sol";
import "../src/PythOracleReader.sol";

contract YieldCalculatorTest is Test {
    YieldCalculator public yieldCalculator;
    PythOracleReader public pythOracle;

    address public owner = address(1);
    address public mockPythContract = address(0xA2aa501b19aff244D90cc15a4Cf739D2725B5729);

    function setUp() public {
        vm.startPrank(owner);
        
        pythOracle = new PythOracleReader(mockPythContract);
        yieldCalculator = new YieldCalculator(payable(address(pythOracle)));
        
        vm.stopPrank();
    }

    function testSetYieldConfig() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        uint256 baseAPY = 500; // 5% APY (500 basis points)
        
        yieldCalculator.setYieldConfig(tokenId, baseAPY);
        
        YieldCalculator.YieldConfig memory config = yieldCalculator.getYieldConfig(tokenId);
        assertEq(config.baseAPY, baseAPY);
        assertTrue(config.isActive);
        
        vm.stopPrank();
    }

    function testCalculateYield() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        uint256 baseAPY = 500; // 5% APY
        yieldCalculator.setYieldConfig(tokenId, baseAPY);
        
        vm.stopPrank();
        
        // TODO: Test yield calculation
        uint256 principalAmount = 100000; // $1000.00
        uint256 durationDays = 365; // 1 year
        
        // uint256 yield = yieldCalculator.calculateYield(tokenId, principalAmount, durationDays);
        // Expected yield for 5% APY over 1 year: ~5000 ($50.00)
        // assertGt(yield, 0);
    }

    function testPreviewTokenValue() public {
        // TODO: Test token value preview based on oracle price
        uint256 tokenId = 1;
        // uint256 value = yieldCalculator.previewTokenValue(tokenId);
    }

    function testCalculateAPY() public {
        // TODO: Test APY calculation with oracle benchmark
        uint256 tokenId = 1;
        bytes32 benchmarkPriceId = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;
        
        // uint256 apy = yieldCalculator.calculateAPY(tokenId, benchmarkPriceId);
    }

    function testUpdateAPY() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        yieldCalculator.setYieldConfig(tokenId, 500);
        
        uint256 newAPY = 750; // 7.5% APY
        yieldCalculator.updateAPY(tokenId, newAPY);
        
        YieldCalculator.YieldConfig memory config = yieldCalculator.getYieldConfig(tokenId);
        assertEq(config.baseAPY, newAPY);
        
        vm.stopPrank();
    }

    function testFailExcessiveAPY() public {
        vm.prank(owner);
        // Should fail with APY > 100%
        yieldCalculator.setYieldConfig(1, 1000001);
    }

    function testDeactivateYield() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        yieldCalculator.setYieldConfig(tokenId, 500);
        yieldCalculator.deactivateYield(tokenId);
        
        YieldCalculator.YieldConfig memory config = yieldCalculator.getYieldConfig(tokenId);
        assertFalse(config.isActive);
        
        vm.stopPrank();
    }
}
