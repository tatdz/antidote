// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {MarginCallInsuranceHook} from "../src/MarginCallInsuranceHook.sol";
import {RiskToken} from "../src/RiskToken.sol";
import {IPyth} from "@pyth/IPyth.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

contract FinalHookDeploy is Script {
    // Network addresses
    address constant PYTH_BASE_SEPOLIA = 0xA2aa501b19aff244D90cc15a4Cf739D2725B5729;
    address constant PYTH_ETHEREUM_SEPOLIA = 0xDd24F84d36BF92C65F92307595335bdFab5Bbd21;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant USDC_ETHEREUM_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    address constant POOL_MANAGER_BASE_SEPOLIA = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POOL_MANAGER_ETHEREUM_SEPOLIA = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    
    // Create2 deployer
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    // CORRECT Hook flags - must match EXACTLY what's in getHookPermissions()
    // Based on your hook implementation:
    // - beforeAddLiquidity: true (bit 11 = 1)
    // - afterAddLiquidity: true (bit 10 = 1)  
    // - beforeRemoveLiquidity: true (bit 9 = 1)
    // - afterRemoveLiquidity: true (bit 8 = 1)
    // - beforeSwap: true (bit 7 = 1)
    // - afterSwap: true (bit 6 = 1)
    // All others: false (bits 5-0 = 0)
    uint160 constant HOOK_FLAGS = uint160(
        Hooks.BEFORE_ADD_LIQUIDITY_FLAG |  // bit 11 = 1
        Hooks.AFTER_ADD_LIQUIDITY_FLAG |   // bit 10 = 1  
        Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG | // bit 9 = 1
        Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | // bit 8 = 1
        Hooks.BEFORE_SWAP_FLAG |           // bit 7 = 1
        Hooks.AFTER_SWAP_FLAG              // bit 6 = 1
        // All other flags are 0 by default
    );

    function run() external {
        deployEthereumSepolia();
    }

    function deployEthereumSepolia() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying to Ethereum Sepolia ===");
        console.log("Deployer: %s", deployer);
        console.log("Target flags: 0x%04x", uint16(HOOK_FLAGS & 0x3FFF));

        // Step 1: Mine for a valid hook address with EXACT flags
        console.log("Step 1: Mining for valid hook address with exact flags...");
        
        bytes memory creationCode = type(MarginCallInsuranceHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER_ETHEREUM_SEPOLIA),
            IPyth(PYTH_ETHEREUM_SEPOLIA),
            USDC_ETHEREUM_SEPOLIA
        );
        
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            HOOK_FLAGS,
            creationCode,
            constructorArgs
        );

        console.log("Found valid hook address: %s", hookAddress);
        console.log("Using salt: 0x%x", uint256(salt));
        
        // Verify the address has the exact bits we need (bottom 14 bits)
        uint16 actualBits = uint16(uint160(hookAddress) & 0x3FFF); // Mask bottom 14 bits
        uint16 expectedBits = uint16(HOOK_FLAGS & 0x3FFF); // Mask bottom 14 bits
        console.log("Expected bits: 0x%04x", expectedBits);
        console.log("Actual bits:   0x%04x", actualBits);
        require(actualBits == expectedBits, "Address bits don't match expected");

        // Step 2: Deploy the hook with CREATE2
        console.log("Step 2: Deploying MarginCallInsuranceHook...");
        
        MarginCallInsuranceHook insuranceHook = new MarginCallInsuranceHook{salt: salt}(
            IPoolManager(POOL_MANAGER_ETHEREUM_SEPOLIA),
            IPyth(PYTH_ETHEREUM_SEPOLIA),
            USDC_ETHEREUM_SEPOLIA
        );

        console.log("Hook deployed at: %s", address(insuranceHook));
        
        // Verify deployment
        require(address(insuranceHook) == hookAddress, "Address mismatch");
        uint256 codeSize = address(insuranceHook).code.length;
        require(codeSize > 0, "No code at address");
        console.log("Hook deployment verified! Code size: %d", codeSize);

        // Step 3: Deploy RiskToken
        console.log("Step 3: Deploying RiskToken...");
        RiskToken riskToken = new RiskToken(
            "Antidote Risk Token",
            "aRISK",
            deployer,
            address(insuranceHook)
        );
        console.log("RiskToken deployed at: %s", address(riskToken));

        // Step 4: Enable trading
        console.log("Step 4: Enabling trading...");
        riskToken.enableTrading();
        console.log("Trading enabled");

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE - Ethereum Sepolia ===");
        console.log("MarginCallInsuranceHook: %s", address(insuranceHook));
        console.log("RiskToken: %s", address(riskToken));
    }

    function deployBaseSepolia() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying to Base Sepolia ===");
        console.log("Deployer: %s", deployer);
        console.log("Target flags: 0x%04x", uint16(HOOK_FLAGS & 0x3FFF));

        // Step 1: Mine for a valid hook address with EXACT flags
        console.log("Step 1: Mining for valid hook address with exact flags...");
        
        bytes memory creationCode = type(MarginCallInsuranceHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            IPoolManager(POOL_MANAGER_BASE_SEPOLIA),
            IPyth(PYTH_BASE_SEPOLIA),
            USDC_BASE_SEPOLIA
        );
        
        (address hookAddress, bytes32 salt) = HookMiner.find(
            CREATE2_DEPLOYER,
            HOOK_FLAGS,
            creationCode,
            constructorArgs
        );

        console.log("Found valid hook address: %s", hookAddress);
        console.log("Using salt: 0x%x", uint256(salt));
        
        // Verify the address has the exact bits we need (bottom 14 bits)
        uint16 actualBits = uint16(uint160(hookAddress) & 0x3FFF); // Mask bottom 14 bits
        uint16 expectedBits = uint16(HOOK_FLAGS & 0x3FFF); // Mask bottom 14 bits
        console.log("Expected bits: 0x%04x", expectedBits);
        console.log("Actual bits:   0x%04x", actualBits);
        require(actualBits == expectedBits, "Address bits don't match expected");

        // Step 2: Deploy the hook with CREATE2
        console.log("Step 2: Deploying MarginCallInsuranceHook...");
        
        MarginCallInsuranceHook insuranceHook = new MarginCallInsuranceHook{salt: salt}(
            IPoolManager(POOL_MANAGER_BASE_SEPOLIA),
            IPyth(PYTH_BASE_SEPOLIA),
            USDC_BASE_SEPOLIA
        );

        console.log("Hook deployed at: %s", address(insuranceHook));
        
        // Verify deployment
        require(address(insuranceHook) == hookAddress, "Address mismatch");
        uint256 codeSize = address(insuranceHook).code.length;
        require(codeSize > 0, "No code at address");
        console.log("Hook deployment verified! Code size: %d", codeSize);

        // Step 3: Deploy RiskToken
        console.log("Step 3: Deploying RiskToken...");
        RiskToken riskToken = new RiskToken(
            "Antidote Risk Token",
            "aRISK",
            deployer,
            address(insuranceHook)
        );
        console.log("RiskToken deployed at: %s", address(riskToken));

        // Step 4: Enable trading
        console.log("Step 4: Enabling trading...");
        riskToken.enableTrading();
        console.log("Trading enabled");

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE - Base Sepolia ===");
        console.log("MarginCallInsuranceHook: %s", address(insuranceHook));
        console.log("RiskToken: %s", address(riskToken));
    }

    // Individual deployment functions
    function deployOnlyEthereumSepolia() external {
        deployEthereumSepolia();
    }

    function deployOnlyBaseSepolia() external {
        deployBaseSepolia();
    }
}
