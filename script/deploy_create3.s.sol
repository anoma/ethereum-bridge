// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/console.sol";
import "forge-std/Script.sol";
import "create/CREATE3Factory.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        string memory mnemonic = vm.envString("MNEMONIC");
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.rememberKey(deployerPrivateKey);

        CREATE3Factory factory = new CREATE3Factory();

        console.log("factory    | %s", address(factory));

        vm.stopBroadcast();
    }
}
