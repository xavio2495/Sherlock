// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FractionManager.sol";

// Mock RWATokenFactory for testing
contract MockRWATokenFactory {
    mapping(address => mapping(uint256 => uint256)) public balances;
    
    event Burned(address indexed from, uint256 indexed id, uint256 amount);
    event Minted(address indexed to, uint256 indexed id, uint256 amount);
    
    function burn(address from, uint256 id, uint256 amount) external {
        require(balances[from][id] >= amount, "Insufficient balance");
        balances[from][id] -= amount;
        emit Burned(from, id, amount);
    }
    
    function mint(address to, uint256 id, uint256 amount) external {
        balances[to][id] += amount;
        emit Minted(to, id, amount);
    }
    
    function setBalance(address account, uint256 id, uint256 amount) external {
        balances[account][id] = amount;
    }
    
    function balanceOf(address account, uint256 id) external view returns (uint256) {
        return balances[account][id];
    }
}

contract FractionManagerTest is Test {
    FractionManager public fractionManager;
    MockRWATokenFactory public mockFactory;
    
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);
    
    uint256 constant TOKEN_ID = 1;
    uint256 constant TOTAL_SUPPLY = 100;
    uint256 constant MIN_UNIT_SIZE = 10;
    uint256 constant LOCKUP_PERIOD = 30; // 30 days
    
    function setUp() public {
        // Deploy mock factory
        mockFactory = new MockRWATokenFactory();
        
        // Deploy FractionManager
        vm.prank(owner);
        fractionManager = new FractionManager(address(mockFactory));
    }

    // ============ Constructor Tests ============

    function testConstructor() public {
        assertEq(address(fractionManager.rwaFactory()), address(mockFactory));
        assertEq(fractionManager.owner(), owner);
        assertEq(fractionManager.WHOLE_TOKEN_OFFSET(), 1_000_000);
    }

    function testConstructorRevertsWithZeroAddress() public {
        vm.expectRevert("Invalid factory address");
        new FractionManager(address(0));
    }

    // ============ SetFractionSpec Tests ============

    function testSetFractionSpec() public {
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit FractionManager.FractionSpecSet(
            TOKEN_ID,
            TOTAL_SUPPLY,
            MIN_UNIT_SIZE,
            LOCKUP_PERIOD,
            block.timestamp + (LOCKUP_PERIOD * 1 days)
        );
        
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        FractionManager.FractionSpec memory spec = fractionManager.getFractionSpec(TOKEN_ID);
        assertEq(spec.totalSupply, TOTAL_SUPPLY);
        assertEq(spec.minUnitSize, MIN_UNIT_SIZE);
        assertEq(spec.lockupPeriod, LOCKUP_PERIOD);
        assertEq(spec.lockupEnd, block.timestamp + (LOCKUP_PERIOD * 1 days));
        assertTrue(spec.isActive);
    }

    function testSetFractionSpecWithNoLockup() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        FractionManager.FractionSpec memory spec = fractionManager.getFractionSpec(TOKEN_ID);
        assertEq(spec.lockupEnd, block.timestamp); // No lockup
    }

    function testSetFractionSpecRevertsWithZeroSupply() public {
        vm.prank(owner);
        vm.expectRevert(FractionManager.InvalidTotalSupply.selector);
        fractionManager.setFractionSpec(TOKEN_ID, 0, MIN_UNIT_SIZE, LOCKUP_PERIOD);
    }

    function testSetFractionSpecRevertsWithZeroMinUnit() public {
        vm.prank(owner);
        vm.expectRevert(FractionManager.InvalidMinUnitSize.selector);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, 0, LOCKUP_PERIOD);
    }

    function testSetFractionSpecRevertsWithMinUnitGreaterThanSupply() public {
        vm.prank(owner);
        vm.expectRevert(FractionManager.InvalidMinUnitSize.selector);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, TOTAL_SUPPLY + 1, LOCKUP_PERIOD);
    }

    function testSetFractionSpecRevertsForNonOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
    }

    // ============ IsTransferAllowed Tests ============

    function testIsTransferAllowedWithNoSpec() public {
        // No spec set, should allow transfer
        assertTrue(fractionManager.isTransferAllowed(TOKEN_ID, 5, user1));
    }

    function testIsTransferAllowedMeetsMinimum() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0); // No lockup
        
        // Transfer >= minimum should be allowed
        assertTrue(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE, user1));
        assertTrue(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE + 5, user1));
    }

    function testIsTransferAllowedBelowMinimum() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        // Transfer < minimum should be rejected
        assertFalse(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE - 1, user1));
        assertFalse(fractionManager.isTransferAllowed(TOKEN_ID, 1, user1));
    }

    function testIsTransferAllowedDuringLockup() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        // Transfer during lockup should be rejected (even if meets minimum)
        assertFalse(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE, user1));
    }

    function testIsTransferAllowedAfterLockup() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        // Advance time past lockup
        vm.warp(block.timestamp + (LOCKUP_PERIOD * 1 days) + 1);
        
        // Transfer should now be allowed
        assertTrue(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE, user1));
    }

    // ============ RecombineFractions Tests ============

    function testRecombineFractions() public {
        // Setup fraction spec
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        // Give user1 the exact total supply
        mockFactory.setBalance(user1, TOKEN_ID, TOTAL_SUPPLY);
        
        uint256 wholeTokenId = TOKEN_ID + fractionManager.WHOLE_TOKEN_OFFSET();
        
        vm.prank(user1);
        vm.expectEmit(true, true, true, true);
        emit FractionManager.FractionsRecombined(TOKEN_ID, user1, TOTAL_SUPPLY, wholeTokenId);
        
        fractionManager.recombineFractions(TOKEN_ID, TOTAL_SUPPLY);
        
        // Verify fractional tokens burned
        assertEq(mockFactory.balanceOf(user1, TOKEN_ID), 0);
        
        // Verify whole token minted
        assertEq(mockFactory.balanceOf(user1, wholeTokenId), 1);
    }

    function testRecombineFractionsRevertsWithWrongAmount() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        mockFactory.setBalance(user1, TOKEN_ID, TOTAL_SUPPLY);
        
        vm.prank(user1);
        vm.expectRevert(
            abi.encodeWithSelector(
                FractionManager.InsufficientFractionsForRecombination.selector,
                TOTAL_SUPPLY - 1,
                TOTAL_SUPPLY
            )
        );
        fractionManager.recombineFractions(TOKEN_ID, TOTAL_SUPPLY - 1);
    }

    function testRecombineFractionsRevertsWithNoSpec() public {
        mockFactory.setBalance(user1, TOKEN_ID, TOTAL_SUPPLY);
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(FractionManager.FractionSpecNotSet.selector, TOKEN_ID));
        fractionManager.recombineFractions(TOKEN_ID, TOTAL_SUPPLY);
    }

    function testRecombineFractionsRevertsWithInsufficientBalance() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        // User only has 50, needs 100
        mockFactory.setBalance(user1, TOKEN_ID, 50);
        
        vm.prank(user1);
        vm.expectRevert("Insufficient balance");
        fractionManager.recombineFractions(TOKEN_ID, TOTAL_SUPPLY);
    }

    // ============ ValidateTransfer Tests ============

    function testValidateTransferSuccess() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        // Should not revert
        fractionManager.validateTransfer(TOKEN_ID, MIN_UNIT_SIZE, user1);
    }

    function testValidateTransferRevertsBelowMinimum() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, 0);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                FractionManager.TransferBelowMinimum.selector,
                MIN_UNIT_SIZE - 1,
                MIN_UNIT_SIZE
            )
        );
        fractionManager.validateTransfer(TOKEN_ID, MIN_UNIT_SIZE - 1, user1);
    }

    function testValidateTransferRevertsDuringLockup() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        uint256 lockupEnd = block.timestamp + (LOCKUP_PERIOD * 1 days);
        
        vm.expectRevert(
            abi.encodeWithSelector(
                FractionManager.TransferDuringLockup.selector,
                block.timestamp,
                lockupEnd
            )
        );
        fractionManager.validateTransfer(TOKEN_ID, MIN_UNIT_SIZE, user1);
    }

    // ============ Lockup Query Tests ============

    function testIsLockupEnded() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        // Initially locked
        assertFalse(fractionManager.isLockupEnded(TOKEN_ID));
        
        // Advance time
        vm.warp(block.timestamp + (LOCKUP_PERIOD * 1 days) + 1);
        
        // Now unlocked
        assertTrue(fractionManager.isLockupEnded(TOKEN_ID));
    }

    function testIsLockupEndedWithNoSpec() public {
        // No spec, should return true
        assertTrue(fractionManager.isLockupEnded(TOKEN_ID));
    }

    function testGetRemainingLockup() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        // Initially full lockup
        uint256 expected = LOCKUP_PERIOD * 1 days;
        assertEq(fractionManager.getRemainingLockup(TOKEN_ID), expected);
        
        // Advance time halfway
        vm.warp(block.timestamp + (LOCKUP_PERIOD * 1 days) / 2);
        uint256 remaining = fractionManager.getRemainingLockup(TOKEN_ID);
        assertApproxEqAbs(remaining, expected / 2, 1);
        
        // Advance past lockup
        vm.warp(block.timestamp + (LOCKUP_PERIOD * 1 days));
        assertEq(fractionManager.getRemainingLockup(TOKEN_ID), 0);
    }

    // ============ Admin Function Tests ============

    function testSetRWAFactory() public {
        address newFactory = address(0x123);
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit FractionManager.RWAFactoryUpdated(address(mockFactory), newFactory);
        
        fractionManager.setRWAFactory(newFactory);
        
        assertEq(address(fractionManager.rwaFactory()), newFactory);
    }

    function testSetRWAFactoryRevertsWithZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid factory address");
        fractionManager.setRWAFactory(address(0));
    }

    function testSetRWAFactoryRevertsForNonOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        fractionManager.setRWAFactory(address(0x123));
    }

    function testUpdateLockupPeriod() public {
        // Set initial spec
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        uint256 newLockupPeriod = 60; // 60 days
        uint256 newLockupEnd = block.timestamp + (newLockupPeriod * 1 days);
        
        vm.prank(owner);
        vm.expectEmit(true, true, true, true);
        emit FractionManager.FractionSpecSet(
            TOKEN_ID,
            TOTAL_SUPPLY,
            MIN_UNIT_SIZE,
            newLockupPeriod,
            newLockupEnd
        );
        
        fractionManager.updateLockupPeriod(TOKEN_ID, newLockupPeriod);
        
        FractionManager.FractionSpec memory spec = fractionManager.getFractionSpec(TOKEN_ID);
        assertEq(spec.lockupPeriod, newLockupPeriod);
        assertEq(spec.lockupEnd, newLockupEnd);
    }

    function testUpdateLockupPeriodRevertsWithNoSpec() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(FractionManager.FractionSpecNotSet.selector, TOKEN_ID));
        fractionManager.updateLockupPeriod(TOKEN_ID, 60);
    }

    function testDeactivateFractionSpec() public {
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        FractionManager.FractionSpec memory spec = fractionManager.getFractionSpec(TOKEN_ID);
        assertTrue(spec.isActive);
        
        vm.prank(owner);
        fractionManager.deactivateFractionSpec(TOKEN_ID);
        
        spec = fractionManager.getFractionSpec(TOKEN_ID);
        assertFalse(spec.isActive);
    }

    // ============ Integration Tests ============

    function testFullWorkflow() public {
        // 1. Owner sets fraction spec with lockup
        vm.prank(owner);
        fractionManager.setFractionSpec(TOKEN_ID, TOTAL_SUPPLY, MIN_UNIT_SIZE, LOCKUP_PERIOD);
        
        // 2. User tries to transfer during lockup - should fail
        assertFalse(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE, user1));
        
        // 3. Advance time past lockup
        vm.warp(block.timestamp + (LOCKUP_PERIOD * 1 days) + 1);
        
        // 4. User can now transfer (if meets minimum)
        assertTrue(fractionManager.isTransferAllowed(TOKEN_ID, MIN_UNIT_SIZE, user1));
        
        // 5. User collects all fractions and recombines
        mockFactory.setBalance(user1, TOKEN_ID, TOTAL_SUPPLY);
        
        vm.prank(user1);
        fractionManager.recombineFractions(TOKEN_ID, TOTAL_SUPPLY);
        
        // 6. Verify whole token received
        uint256 wholeTokenId = TOKEN_ID + fractionManager.WHOLE_TOKEN_OFFSET();
        assertEq(mockFactory.balanceOf(user1, wholeTokenId), 1);
        assertEq(mockFactory.balanceOf(user1, TOKEN_ID), 0);
    }

    function testMultipleTokensWithDifferentSpecs() public {
        uint256 token1 = 1;
        uint256 token2 = 2;
        
        vm.startPrank(owner);
        fractionManager.setFractionSpec(token1, 100, 10, 30);
        fractionManager.setFractionSpec(token2, 200, 20, 60);
        vm.stopPrank();
        
        FractionManager.FractionSpec memory spec1 = fractionManager.getFractionSpec(token1);
        FractionManager.FractionSpec memory spec2 = fractionManager.getFractionSpec(token2);
        
        assertEq(spec1.totalSupply, 100);
        assertEq(spec1.minUnitSize, 10);
        assertEq(spec1.lockupPeriod, 30);
        
        assertEq(spec2.totalSupply, 200);
        assertEq(spec2.minUnitSize, 20);
        assertEq(spec2.lockupPeriod, 60);
    }
}
