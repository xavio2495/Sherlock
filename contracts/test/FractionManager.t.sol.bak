// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FractionManager.sol";

contract FractionManagerTest is Test {
    FractionManager public fractionManager;

    address public owner = address(1);
    address public holder = address(2);

    function setUp() public {
        vm.prank(owner);
        fractionManager = new FractionManager();
    }

    function testSetFractionSpec() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        uint256 totalSupply = 100;
        uint256 minUnitSize = 1;
        uint256 lockupPeriod = 30 days;
        
        // TODO: Uncomment when implementation is ready
        // fractionManager.setFractionSpec(
        //     tokenId,
        //     totalSupply,
        //     minUnitSize,
        //     lockupPeriod
        // );
        
        // FractionManager.FractionSpec memory spec = fractionManager.getFractionSpec(tokenId);
        // assertEq(spec.totalSupply, totalSupply);
        // assertEq(spec.minUnitSize, minUnitSize);
        // assertTrue(spec.isActive);
        
        vm.stopPrank();
    }

    function testIsTransferAllowed() public view {
        // TODO: Test transfer validation
        uint256 tokenId = 1;
        uint256 amount = 5;
        
        // bool allowed = fractionManager.isTransferAllowed(tokenId, amount);
    }

    function testLockupMechanism() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        uint256 lockupDuration = 30 days;
        
        // fractionManager.setLockup(tokenId, holder, lockupDuration);
        
        // bool isLocked = fractionManager.isLocked(tokenId, holder);
        // assertTrue(isLocked);
        
        vm.stopPrank();
    }

    function testRecombineFractions() public {
        // TODO: Test fraction recombination
        vm.startPrank(holder);
        
        uint256 tokenId = 1;
        uint256 amount = 10;
        
        // fractionManager.recombineFractions(tokenId, amount);
        
        vm.stopPrank();
    }

    function testGetRemainingLockup() public {
        vm.startPrank(owner);
        
        uint256 tokenId = 1;
        uint256 lockupDuration = 30 days;
        
        fractionManager.setLockup(tokenId, holder, lockupDuration);
        
        uint256 remaining = fractionManager.getRemainingLockup(tokenId, holder);
        assertGt(remaining, 0);
        assertLe(remaining, lockupDuration);
        
        vm.stopPrank();
    }

    function testFailUnauthorizedSetSpec() public {
        // Should fail when non-owner tries to set spec
        vm.prank(holder);
        fractionManager.setFractionSpec(1, 100, 1, 0);
    }
}
