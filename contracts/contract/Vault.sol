//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "../interface/IProxy.sol";
import "../interface/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is IVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IProxy private proxy;

    constructor(IProxy _proxy) {
        proxy = IProxy(_proxy);
    }

    function batchTransferToERC20(
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts
    ) external onlyLatestBridgeContract nonReentrant {
        for (uint256 i = 0; i < _amounts.length; ++i) {
            IERC20(_froms[i]).safeTransfer(_tos[i], _amounts[i]);
        }
    }

    function transferToERC20(
        address _froms,
        address _tos,
        uint256 _amounts
    ) external onlyLatestBridgeContract nonReentrant {
        IERC20(_froms).safeTransfer(_tos, _amounts);
    }

    modifier onlyLatestBridgeContract() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}
