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
 * @dev Run with: forge script script/Deploy.s.sol:DeployScript --rpc-url $MANTLE_RPC_URL --broadcast --verify
 */
contract DeployScript is Script {
    // Default Pyth contract address on Mantle Testnet (can be overridden via env)
    address public constant DEFAULT_PYTH_CONTRACT = 0x98046Bd286715D3B0BC227Dd7a956b83D8978603;

    function run() external {
        // Read environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Get Pyth contract address (env override or default)
        address pythContract;
        try vm.envAddress("PYTH_CONTRACT_ADDRESS") returns (address envPyth) {
            pythContract = envPyth;
            console.log("Using PYTH_CONTRACT_ADDRESS from environment");
        } catch {
            pythContract = DEFAULT_PYTH_CONTRACT;
            console.log("Using default Pyth contract address");
        }

        console.log("==============================================");
        console.log("Sherlock RWA Platform - Contract Deployment");
        console.log("==============================================");
        console.log("Deployer:", deployer);
        console.log("Network: Mantle Testnet (Chain ID: 5003)");
        console.log("Pyth Contract:", pythContract);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy ZKVerifier
        console.log("1. Deploying ZKVerifier...");
        ZKVerifier zkVerifier = new ZKVerifier();
        console.log("   ZKVerifier deployed at:", address(zkVerifier));
        console.log("");

        // Step 2: Deploy PythOracleReader
        console.log("2. Deploying PythOracleReader...");
        PythOracleReader pythOracle = new PythOracleReader(pythContract);
        console.log("   PythOracleReader deployed at:", address(pythOracle));
        console.log("");

        // Step 3: Deploy FractionManager (with pythOracle as temporary placeholder)
        console.log("3. Deploying FractionManager...");
        FractionManager fractionManager = new FractionManager(address(pythOracle));
        console.log("   FractionManager deployed at:", address(fractionManager));
        console.log("");

        // Step 4: Deploy RWATokenFactory (main contract)
        console.log("4. Deploying RWATokenFactory...");
        RWATokenFactory rwaFactory = new RWATokenFactory(
            address(zkVerifier),
            payable(address(pythOracle)),
            address(fractionManager)
        );
        console.log("   RWATokenFactory deployed at:", address(rwaFactory));
        console.log("");

        // Step 5: Update FractionManager with correct RWAFactory address
        console.log("5. Updating FractionManager with RWAFactory address...");
        fractionManager.setRWAFactory(address(rwaFactory));
        console.log("   FractionManager updated successfully");
        console.log("");

        // Step 6: Deploy YieldCalculator with correct addresses
        console.log("6. Deploying YieldCalculator...");
        YieldCalculator yieldCalculator = new YieldCalculator(
            payable(address(pythOracle)),
            address(rwaFactory)
        );
        console.log("   YieldCalculator deployed at:", address(yieldCalculator));
        console.log("");

        vm.stopBroadcast();

        // Print deployment summary
        console.log("==============================================");
        console.log("Deployment Summary");
        console.log("==============================================");
        console.log("ZKVerifier:        ", address(zkVerifier));
        console.log("PythOracleReader:  ", address(pythOracle));
        console.log("FractionManager:   ", address(fractionManager));
        console.log("RWATokenFactory:   ", address(rwaFactory));
        console.log("YieldCalculator:   ", address(yieldCalculator));
        console.log("==============================================");
        console.log("");

        // Write deployment addresses to JSON file
        _writeDeploymentJson(
            address(zkVerifier),
            address(pythOracle),
            address(fractionManager),
            address(rwaFactory),
            address(yieldCalculator),
            pythContract
        );
        
        console.log("Deployment complete! Addresses saved to deployments.json");
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify contracts on Mantle Explorer (use --verify flag)");
        console.log("2. Update backend with deployed addresses from deployments.json");
        console.log("3. Test contract interactions with cast commands");
    }

    /**
     * @notice Write deployment addresses to JSON file for backend integration
     * @dev Creates deployments.json in the script directory
     */
    function _writeDeploymentJson(
        address zkVerifier,
        address pythOracle,
        address fractionManager,
        address rwaFactory,
        address yieldCalculator,
        address pythContract
    ) internal {
        string memory json = string(abi.encodePacked(
            '{\n',
            '  "network": "mantle-testnet",\n',
            '  "chainId": 5003,\n',
            '  "deploymentDate": "', vm.toString(block.timestamp), '",\n',
            '  "deployer": "', vm.toString(msg.sender), '",\n',
            '  "pythContract": "', vm.toString(pythContract), '",\n',
            '  "contracts": {\n',
            '    "ZKVerifier": "', vm.toString(zkVerifier), '",\n',
            '    "PythOracleReader": "', vm.toString(pythOracle), '",\n',
            '    "FractionManager": "', vm.toString(fractionManager), '",\n',
            '    "RWATokenFactory": "', vm.toString(rwaFactory), '",\n',
            '    "YieldCalculator": "', vm.toString(yieldCalculator), '"\n',
            '  }\n',
            '}\n'
        ));
        
        vm.writeFile("deployments.json", json);
    }
}
