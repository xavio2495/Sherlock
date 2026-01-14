// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/RWATokenFactory.sol";
import "../src/ZKVerifier.sol";
import "../src/PythOracleReader.sol";
import "../src/FractionManager.sol";

contract RWATokenFactoryTest is Test {
    RWATokenFactory public factory;
    ZKVerifier public zkVerifier;
    PythOracleReader public pythOracle;
    FractionManager public fractionManager;

    address public owner = address(1);
    address public issuer = address(2);
    address public buyer = address(3);

    // Mock Pyth contract address
    address public mockPythContract = address(0xA2aa501b19aff244D90cc15a4Cf739D2725B5729);

    function setUp() public {
        vm.startPrank(owner);

        // Deploy dependency contracts
        zkVerifier = new ZKVerifier();
        pythOracle = new PythOracleReader(mockPythContract);
        fractionManager = new FractionManager(address(pythOracle)); // Placeholder

        // Deploy main factory
        factory = new RWATokenFactory(
            address(zkVerifier),
            payable(address(pythOracle)),
            address(fractionManager)
        );

        // Update FractionManager with correct factory address
        fractionManager.setRWAFactory(address(factory));

        vm.stopPrank();
    }

    function testInitialSetup() public view {
        // Verify contracts are deployed correctly
        assertEq(address(factory.zkVerifier()), address(zkVerifier));
        assertEq(address(factory.pythOracle()), address(pythOracle));
        assertEq(address(factory.fractionManager()), address(fractionManager));
        assertEq(factory.nextTokenId(), 1);
    }

    function testMintRWAToken() public {
        // TODO: Test minting RWA token with valid parameters
        // vm.startPrank(issuer);
        // bytes memory mockProof = abi.encode("mock_zk_proof");
        // uint256 tokenId = factory.mintRWAToken(
        //     "QmTestDocumentHash123",
        //     100000, // $1000.00
        //     100,    // 100 fractions
        //     1,      // min fraction size
        //     mockProof
        // );
        // assertEq(tokenId, 1);
        // vm.stopPrank();
    }

    function testGetAssetMetadata() public {
        // TODO: Test retrieval of asset metadata
    }

    function testPurchaseFraction() public {
        // TODO: Test purchasing fractions with ZK proof
    }

    function testFailUnauthorizedMint() public {
        // TODO: Test that unauthorized users cannot mint
    }
}
