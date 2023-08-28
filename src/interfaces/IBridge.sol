//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToChain(uint256 nonce, ChainTransfer[] transfers, bool[] validMap, uint256 confirmations);

    event TransferToErc(uint256 indexed nonce, Erc20Transfer[] transfers, bool[] validMap, string relayerAddress);

    event ValidatorSetUpdate(uint256 indexed validatorSetNonce, bytes32 bridgeValidatorSetHash, bytes32 governanceValidatorSetHash);

    function transferToChain(ChainTransfer[] calldata transfers, uint256 confirmations) external;

    function transferToErc(RelayProof calldata relayProof) external;

    function updateValidatorsSet(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        bytes32 bridgeValidatorSetHash,
        bytes32 governanceValidatorSetHash,
        Signature[] calldata signatures,
        uint256 nonce
    ) external;
}