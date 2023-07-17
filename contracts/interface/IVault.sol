//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "./ICommon.sol";

interface IVault is ICommon {
    function batchTransferToErc20(Erc20Transfer[] calldata tranfers) external returns (bool[] memory);
}
