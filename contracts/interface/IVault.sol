//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "./ICommon.sol";

interface IVault is ICommon {
    event InvalidTransfer(ERC20Transfer transfer);

    function batchTransferToERC20(ERC20Transfer[] calldata tranfers, bool[] calldata validTransfers) external returns (bool[] memory);
}
