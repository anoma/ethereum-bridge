//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "../interface/IProxy.sol";
import "../interface/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vault is IVault {
    IProxy private proxy;

    constructor(IProxy _proxy) {
        proxy = IProxy(_proxy);
    }

    function batchTransferToErc20(Erc20Transfer[] calldata _transfers, bool[] calldata _validTransfers)
        external
        onlyLatestBridgeContract
        returns (bool[] memory)
    {
        bool[] memory transfersStatus = new bool[](_transfers.length);

        for (uint256 i = 0; i < _transfers.length; ++i) {
            if (_validTransfers[i]) {
                transfersStatus[i] = false;
            }

            try IERC20(_transfers[i].from).transfer(_transfers[i].to, _transfers[i].amount) {
                transfersStatus[i] = true;
            } catch {
                transfersStatus[i] = false;
            }
        }

        return transfersStatus;
    }

    modifier onlyLatestBridgeContract() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}
