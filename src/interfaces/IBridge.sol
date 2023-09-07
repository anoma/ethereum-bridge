//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToChain(uint256 nonce, ChainTransfer[] transfers, uint256 confirmations);

    event TransferToErc(uint256 indexed nonce, Erc20Transfer[] transfers, string relayerAddress);

    event ValidatorSetUpdate(
        uint256 indexed validatorSetNonce, bytes32 bridgeValidatorSetHash, bytes32 governanceValidatorSetHash
    );

    function transferToChain(ChainTransfer[] calldata transfers, uint256 confirmations) external;

    function transferToErc(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        RelayProof calldata relayProof
    )
        external;

    function updateValidatorSet(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        bytes32 bridgeValidatorSetHash,
        bytes32 governanceValidatorSetHash,
        Signature[] calldata signatures
    )
        external;

    function withdraw(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        Erc20Transfer[] calldata transfers,
        Signature[] calldata signatures,
        uint256 nonce
    )
        external;

    function upgrade(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        Signature[] calldata signatures,
        address to,
        uint256 nonce
    )
        external;
}
