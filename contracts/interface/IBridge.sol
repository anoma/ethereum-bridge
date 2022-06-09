//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToNamada(
        uint256 indexed nonce,
        address[] froms,
        string[] tos,
        uint256[] amounts,
        uint256 confirmations
    );
    event TrasferToERC(uint256 indexed nonce, address[] froms, address[] tos, uint256[] amounts);

    function authorize(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        bytes32 message
    ) external view returns (bool);

    function updateTokenWhitelist(address[] calldata tokens, uint256[] calldata tokensCap) external;

    function withdraw(address[] calldata tokens, address payable to) external;

    function updateValidatorSetHash(bytes32 _validatorSetHash) external;
}
