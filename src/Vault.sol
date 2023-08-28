//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "src/interfaces/IProxy.sol";
import "src/interfaces/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault is IVault {
    IProxy private proxy;

    constructor(IProxy _proxy) {
        proxy = IProxy(_proxy);
    }

    function batchTransferToErc20(
        Erc20Transfer[] calldata _transfers
    ) external onlyBridge returns (bool[] memory) {
        bool[] memory transfersStatus = new bool[](_transfers.length);

        for (uint256 i = 0; i < _transfers.length; ++i) {
            try IERC20(_transfers[i].from).transfer(_transfers[i].to, _transfers[i].amount) {
                transfersStatus[i] = true;
            } catch {
                transfersStatus[i] = false;
            }
        }

        return transfersStatus;
    }

    modifier onlyBridge() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}