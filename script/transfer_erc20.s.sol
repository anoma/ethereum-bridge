// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.13;

import "forge-std/console.sol";
import "forge-std/Script.sol";

import "script/repl.s.sol";

contract TransferErc20 is Script {
    function run() external {
        string memory mnemonic = vm.envString("MNEMONIC");
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        vm.rememberKey(deployerPrivateKey);

        uint256 amount = vm.envUint("TRANSFER_AMOUNT");
        string memory target = vm.envString("TRANSFER_TARGET");

        console.log("Transfering %s from %s to %s", amount, msg.sender, target);

        TestERC20 testerc20 = TestERC20(address(contractTestERC20()));
        Bridge bridge = Bridge(address(contractBridge()));

        ICommon.ChainTransfer[] memory transfers = new ICommon.ChainTransfer[](1);
        transfers[0] = ICommon.ChainTransfer(amount, address(testerc20), target);

        console.log("Bridge allowance: %s", testerc20.allowance(msg.sender, address(bridge)));
        console.log("Balance before: %s", testerc20.balanceOf(msg.sender));
        vm.startBroadcast();
        bridge.transferToChain(transfers, 1);
        vm.stopBroadcast();
        console.log("Balance after: %s", testerc20.balanceOf(msg.sender));
    }
}
