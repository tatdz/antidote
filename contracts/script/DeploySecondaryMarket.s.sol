// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {SecondaryMarket} from "../src/SecondaryMarket.sol";

contract DeploySecondaryMarket is Script {
    // Base Sepolia addresses
    address constant RISK_TOKEN_BASE_SEPOLIA = 0xAcd7FFd3Bbb6A57E6856655Cb34b17169584486A;
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant HOOK_BASE_SEPOLIA = 0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0;
    address constant STATE_VIEW_BASE_SEPOLIA = 0x571291b572ed32ce6751a2Cb2486EbEe8DEfB9B4;

    // Ethereum Sepolia addresses
    address constant RISK_TOKEN_ETHEREUM_SEPOLIA = 0xEba681bc4C4e5EdA7Dabace33890947Aa99B98F3;
    address constant USDC_ETHEREUM_SEPOLIA = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant HOOK_ETHEREUM_SEPOLIA = 0x1C9f149Ab2eb65d1928f5373b91bD5e8E48BCfC0;
    address constant STATE_VIEW_ETHEREUM_SEPOLIA = 0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C;

    function run() external {
        deployToBaseSepolia();
        deployToEthereumSepolia();
    }

    function deployToBaseSepolia() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("ALCHEMY_BASE_SEPOLIA_URL");
        
        vm.createSelectFork(rpcUrl);
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying SecondaryMarket to Base Sepolia...");
        console.log("RiskToken:", RISK_TOKEN_BASE_SEPOLIA);
        console.log("USDC:", USDC_BASE_SEPOLIA);
        console.log("InsuranceHook:", HOOK_BASE_SEPOLIA);
        console.log("StateView:", STATE_VIEW_BASE_SEPOLIA);
        
        SecondaryMarket secondaryMarket = new SecondaryMarket(
            RISK_TOKEN_BASE_SEPOLIA,
            USDC_BASE_SEPOLIA,
            HOOK_BASE_SEPOLIA,
            STATE_VIEW_BASE_SEPOLIA,
            msg.sender // fee recipient
        );

        console.log("SecondaryMarket deployed at:", address(secondaryMarket));
        
        vm.stopBroadcast();

        // Generate verification command
        string memory verificationCmd = string(abi.encodePacked(
            "forge verify-contract ",
            vm.toString(address(secondaryMarket)),
            " src/SecondaryMarket.sol:SecondaryMarket --chain-id 84532 --etherscan-api-key $BASESCAN_API_KEY --compiler-version 0.8.24 --num-of-optimizations 1000000 --constructor-args $(cast abi-encode 'constructor(address,address,address,address,address)' ",
            vm.toString(RISK_TOKEN_BASE_SEPOLIA),
            " ",
            vm.toString(USDC_BASE_SEPOLIA),
            " ",
            vm.toString(HOOK_BASE_SEPOLIA),
            " ",
            vm.toString(STATE_VIEW_BASE_SEPOLIA),
            " ",
            vm.toString(msg.sender),
            ")"
        ));

        console.log("\nVerification command:");
        console.log(verificationCmd);
    }

    function deployToEthereumSepolia() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("ALCHEMY_ETHEREUM_SEPOLIA_URL");
        
        vm.createSelectFork(rpcUrl);
        vm.startBroadcast(deployerPrivateKey);

        console.log("Deploying SecondaryMarket to Ethereum Sepolia...");
        console.log("RiskToken:", RISK_TOKEN_ETHEREUM_SEPOLIA);
        console.log("USDC:", USDC_ETHEREUM_SEPOLIA);
        console.log("InsuranceHook:", HOOK_ETHEREUM_SEPOLIA);
        console.log("StateView:", STATE_VIEW_ETHEREUM_SEPOLIA);
        
        SecondaryMarket secondaryMarket = new SecondaryMarket(
            RISK_TOKEN_ETHEREUM_SEPOLIA,
            USDC_ETHEREUM_SEPOLIA,
            HOOK_ETHEREUM_SEPOLIA,
            STATE_VIEW_ETHEREUM_SEPOLIA,
            msg.sender // fee recipient
        );

        console.log("SecondaryMarket deployed at:", address(secondaryMarket));
        
        vm.stopBroadcast();

        // Generate verification command
        string memory verificationCmd = string(abi.encodePacked(
            "forge verify-contract ",
            vm.toString(address(secondaryMarket)),
            " src/SecondaryMarket.sol:SecondaryMarket --chain-id 11155111 --etherscan-api-key $ETHERSCAN_API_KEY --compiler-version 0.8.24 --num-of-optimizations 1000000 --constructor-args $(cast abi-encode 'constructor(address,address,address,address,address)' ",
            vm.toString(RISK_TOKEN_ETHEREUM_SEPOLIA),
            " ",
            vm.toString(USDC_ETHEREUM_SEPOLIA),
            " ",
            vm.toString(HOOK_ETHEREUM_SEPOLIA),
            " ",
            vm.toString(STATE_VIEW_ETHEREUM_SEPOLIA),
            " ",
            vm.toString(msg.sender),
            ")"
        ));

        console.log("\nVerification command:");
        console.log(verificationCmd);
    }

    function deployToNetwork(string memory network) external {
        if (keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("base-sepolia"))) {
            deployToBaseSepolia();
        } else if (keccak256(abi.encodePacked(network)) == keccak256(abi.encodePacked("ethereum-sepolia"))) {
            deployToEthereumSepolia();
        } else {
            revert("Unsupported network");
        }
    }
}