//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToNamada(uint256 nonce, NamadaTransfer[] trasfers, uint256 confirmations);

    event InvalidTransferToNamada(address from, string to, uint256 amount);

    event TransferToERC(uint256 indexed nonce, ERC20Transfer[] transfers);

    function authorize(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        bytes32 message
    ) external view returns (bool);

    function transferToNamada(NamadaTransfer[] calldata trasfers, uint256 confirmations) external;

    function transferToERC(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        ERC20Transfer[] calldata _transfers,
        bytes32 _poolRoot,
        bytes32[] calldata _proof,
        bool[] calldata _proofFlags,
        uint256 batchNonce
    ) external;

    function updateTokenWhitelist(address[] calldata tokens, uint256[] calldata tokensCap) external;

    function updateValidatorSetHash(bytes32 _validatorSetHash) external;
}
