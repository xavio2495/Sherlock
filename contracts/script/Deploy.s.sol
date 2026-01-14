// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ZKVerifier.sol";
import "../src/PythOracleReader.sol";
import "../src/FractionManager.sol";
import "../src/YieldCalculator.sol";
import "../src/RWATokenFactory.sol";

/**
 * @title Deploy Script for Sherlock RWA Platform
 * @notice Deploys all contracts in correct dependency order to Mantle Testnet
 * @dev Run with: forge script script/Deploy.s.sol:DeployScript --rpc-url $MANTLE_RPC_URL --broadcast
 */
contract DeployScript is Script {
    // Pyth contract address on Mantle Testnet
    address public constant PYTH_CONTRACT = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==============================================");
        console.log("Sherlock RWA Platform - Contract Deployment");
        console.log("==============================================");
        console.log("Deployer:", deployer);
        console.log("Network: Mantle Testnet");
        console.log("Pyth Contract:", PYTH_CONTRACT);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy ZKVerifier
        console.log("1. Deploying ZKVerifier...");
        ZKVerifier zkVerifier = new ZKVerifier();
        console.log("   ZKVerifier deployed at:", address(zkVerifier));
        console.log("");

        // Step 2: Deploy PythOracleReader
        console.log("2. Deploying PythOracleReader...");
        PythOracleReader pythOracle = new PythOracleReader(PYTH_CONTRACT);
        console.log("   PythOracleReader deployed at:", address(pythOracle));
        console.log("");

        // Step 3: Deploy FractionManager
        console.log("3. Deploying FractionManager...");
        FractionManager fractionManager = new FractionManager();
        console.log("   FractionManager deployed at:", address(fractionManager));
        console.log("");

        // Step 4: Deploy YieldCalculator
        console.log("4. Deploying YieldCalculator...");
        YieldCalculator yieldCalculator = new YieldCalculator(payable(address(pythOracle)));
        console.log("   YieldCalculator deployed at:", address(yieldCalculator));
        console.log("");

        // Step 5: Deploy RWATokenFactory (main contract)
        console.log("5. Deploying RWATokenFactory...");
        RWATokenFactory rwaFactory = new RWATokenFactory(
            address(zkVerifier),
            payable(address(pythOracle)),
            address(fractionManager)
        );
        console.log("   RWATokenFactory deployed at:", address(rwaFactory));
        console.log("");

        vm.stopBroadcast();

        // Print summary
        console.log("==============================================");
        console.log("Deployment Summary");
        console.log("==============================================");
        console.log("ZKVerifier:        ", address(zkVerifier));
        console.log("PythOracleReader:  ", address(pythOracle));
        console.log("FractionManager:   ", address(fractionManager));
        console.log("YieldCalculator:   ", address(yieldCalculator));
        console.log("RWATokenFactory:   ", address(rwaFactory));
        console.log("");
        console.log("Copy these addresses to your .env file!");
        console.log("==============================================");

        // Save deployment addresses to a file for later use
        string memory deploymentInfo = string(
            abi.encodePacked(
                "ZKVERIFIER_ADDRESS=", vm.toString(address(zkVerifier)), "\n",
                "PYTH_ORACLE_READER_ADDRESS=", vm.toString(address(pythOracle)), "\n",
                "FRACTION_MANAGER_ADDRESS=", vm.toString(address(fractionManager)), "\n",
                "YIELD_CALCULATOR_ADDRESS=", vm.toString(address(yieldCalculator)), "\n",
                "RWA_TOKEN_FACTORY_ADDRESS=", vm.toString(address(rwaFactory)), "\n"
            )
        );

        vm.writeFile("deployments.txt", deploymentInfo);
        console.log("Deployment addresses saved to deployments.txt");
    }
}
