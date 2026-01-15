// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/EligibilityVerifier.sol";
import "../src/RangeProofVerifier.sol";
import "../src/ZKVerifier.sol";
import "../src/ZKVerifierV2.sol";

/**
 * @title DeployVerifiers
 * @notice Deployment script for Groth16 ZK proof verifiers
 * @dev Deploy only new verifier contracts without redeploying existing infrastructure
 */
contract DeployVerifiers is Script {
    // Existing contract addresses from deployments.json
    address constant EXISTING_ZKVERIFIER = 0x56378BCC125EE84D2503983Be8A0ED6815D18B83;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("Deploying Groth16 Verifier Contracts");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy EligibilityVerifier
        console.log("Deploying EligibilityVerifier...");
        EligibilityVerifier eligibilityVerifier = new EligibilityVerifier();
        console.log("EligibilityVerifier deployed at:", address(eligibilityVerifier));

        // 2. Deploy RangeProofVerifier  
        console.log("Deploying RangeProofVerifier...");
        RangeProofVerifier rangeProofVerifier = new RangeProofVerifier();
        // 3. Deploy ZKVerifierV2 with new Groth16 verifiers
        console.log("Deploying ZKVerifierV2...");
        ZKVerifierV2 zkVerifierV2 = new ZKVerifierV2(
            address(eligibilityVerifier),
            address(rangeProofVerifier)
        );
        console.log("ZKVerifierV2 deployed at:", address(zkVerifierV2));

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("Deployment Complete!");
        console.log("========================================");
        console.log("");
        console.log("New Contract Addresses:");
        console.log("  EligibilityVerifier:", address(eligibilityVerifier));
        console.log("  RangeProofVerifier:", address(rangeProofVerifier));
        console.log("  ZKVerifierV2:", address(zkVerifierV2));
        console.log("");
        console.log("Existing Contracts (not redeployed):");
        console.log("  ZKVerifier (Legacy):", EXISTING_ZKVERIFIER);
        console.log("");
        console.log("Next Steps:");
        console.log("  1. Update deployments.json with new addresses");
        console.log("  2. Update RWATokenFactory to use ZKVerifierV2");
        console.log("  3. Verify contracts on Mantle Explorer");
    }
}
