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

    function batchTransferToERC20(
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts
    )
        external
        onlyLatestBridgeContract
        returns (
            address[] memory froms,
            address[] memory tos,
            uint256[] memory amounts
        )
    {
        address[] memory validFroms = new address[](_froms.length);
        address[] memory validTos = new address[](_tos.length);
        uint256[] memory validAmounts = new uint256[](_amounts.length);

        for (uint256 i = 0; i < _amounts.length; ++i) {
            try IERC20(_froms[i]).transfer(_tos[i], _amounts[i]) {
                validFroms[i] = _froms[i];
                validTos[i] = _tos[i];
                validAmounts[i] = _amounts[i];
            } catch {
                emit InvalidTransfer(_froms[i], _tos[i], _amounts[i]);
            }
        }

        return (validFroms, validTos, validAmounts);
    }

    modifier onlyLatestBridgeContract() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}
