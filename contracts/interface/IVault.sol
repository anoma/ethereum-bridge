//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "./ICommon.sol";

interface IVault is ICommon {
    event InvalidTransfer(Erc20Transfer transfer);

    function batchTransferToErc20(
        Erc20Transfer[] calldata tranfers,
        bool[] calldata validTransfers
    ) external returns (bool[] memory);
}
