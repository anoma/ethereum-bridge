//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "./ICommon.sol";

interface IVault is ICommon {
    event InvalidTransfer(Erc20Transfer transfer);

    function batchTransferToErc20(Erc20Transfer[] calldata tranfers, bool[] memory _valid) external returns (Erc20Transfer[] memory);
}
