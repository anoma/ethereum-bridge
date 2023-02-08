//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToNamada(uint256 nonce, NamadaTransfer[] trasfers, uint256 confirmations);

    event InvalidTransferToNamada(address from, string to, uint256 amount);

    event TransferToErc(uint256 indexed nonce, Erc20Transfer[] transfers, string relayerAddress);

    struct RelayProof {
        ValidatorSetArgs validatorSetArgs;
        Signature[] signatures;
        Erc20Transfer[] transfers;
        bytes32 poolRoot;
        bytes32[] proof;
        bool[] proofFlags;
        uint256 batchNonce;
        string relayerAddress;
    }

    function authorize(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        bytes32 message
    ) external view returns (bool);

    function transferToNamada(NamadaTransfer[] calldata trasfers, uint256 confirmations) external;

    function transferToErc(
        RelayProof calldata relayProof
    ) external;

    function updateTokenWhitelist(address[] calldata tokens, uint256[] calldata tokensCap) external;

    function updateValidatorSetHash(bytes32 _validatorSetHash) external;
}
