//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "../interface/IProxy.sol";
import "../interface/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault is IVault {
    IProxy private proxy;

    constructor(IProxy _proxy) {
        proxy = IProxy(_proxy);
    }

    function batchTransferToERC20(ERC20Transfer[] memory _transfers)
        external
        onlyLatestBridgeContract
        returns (ERC20Transfer[] memory)
    {
        ERC20Transfer[] memory validTransfers = new ERC20Transfer[](_transfers.length);

        for (uint256 i = 0; i < _transfers.length; ++i) {
            try IERC20(_transfers[i].from).transfer(_transfers[i].to, _transfers[i].amount) {
                validTransfers[i] = _transfers[i];
            } catch {
                emit InvalidTransfer(_transfers[i]);
            }
        }

        return validTransfers;
    }

    modifier onlyLatestBridgeContract() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}
