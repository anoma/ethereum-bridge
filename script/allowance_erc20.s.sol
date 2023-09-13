// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.13;

import "forge-std/console.sol";
import "forge-std/Script.sol";

import "script/repl.s.sol";

contract AllowanceErc20 is Script {
    function run() external {
        string memory mnemonic = vm.envString("MNEMONIC");
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        vm.rememberKey(deployerPrivateKey);

        uint256 amount = vm.envUint("TRANSFER_AMOUNT");

        console.log("Allowing %s from %s to Bridge", amount, msg.sender);

        TestERC20 testerc20 = TestERC20(address(contractTestERC20()));
        Bridge bridge = Bridge(address(contractBridge()));

        vm.startBroadcast();
        testerc20.approve(address(bridge), amount);
        vm.stopBroadcast();
    }
}
