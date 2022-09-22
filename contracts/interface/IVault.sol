//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

interface IVault {
    event InvalidTransfer(address indexed from, address indexed to, uint256 amounts);

    function batchTransferToERC20(
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts
    )
        external
        returns (
            address[] memory froms,
            address[] memory tos,
            uint256[] memory amounts
        );
}
