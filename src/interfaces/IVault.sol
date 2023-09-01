//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "src/interfaces/ICommon.sol";

interface IVault is ICommon {
    function batchTransferToErc20(Erc20Transfer[] calldata _transfers) external;
}
