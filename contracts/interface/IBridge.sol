//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToNamada(uint256 indexed nonce, NamadaTransfer[] trasfers, uint256 confirmations);

    event InvalidTransferToNamada(address indexed from, string indexed to, uint256 amount);

    event TransferToERC(uint256 indexed nonce, address[] froms, address[] tos, uint256[] amounts);

    function authorize(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        bytes32 message
    ) external view returns (bool);

    function transferToNamada(NamadaTransfer[] calldata trasfers, uint256 confirmations) external;

    function transferToERC(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts,
        uint256 _batchNonce
    ) external;

    function updateTokenWhitelist(address[] calldata tokens, uint256[] calldata tokensCap) external;

    function updateValidatorSetHash(bytes32 _validatorSetHash) external;
}
