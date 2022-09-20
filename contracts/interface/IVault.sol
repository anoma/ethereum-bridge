//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

interface IVault {
    function batchTransferToERC20(address[] calldata _froms, address[] calldata _tos, uint256[] calldata _amounts) external;

    function transferToERC20(address _froms, address _tos, uint256 _amounts) external;
}
