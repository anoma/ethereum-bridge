//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "src/interfaces/IProxy.sol";
import "src/interfaces/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is IVault, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IProxy private immutable proxy;

    constructor(IProxy _proxy) {
        proxy = IProxy(_proxy);
    }

    function batchTransferToErc20(Erc20Transfer[] calldata _transfers) external _onlyBridge nonReentrant {
        for (uint256 i = 0; i < _transfers.length;) {
            if (_transfers[i].amount > 0) {
                IERC20(_transfers[i].from).safeTransfer(_transfers[i].to, _transfers[i].amount);
            }
            unchecked {
                i++;
            }
        }
    }

    modifier _onlyBridge() {
        address bridgeAddress = proxy.getContract("bridge");
        require(msg.sender == bridgeAddress, "Invalid caller.");
        _;
    }
}
