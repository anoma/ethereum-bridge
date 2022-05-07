//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IHub.sol";
import "../interface/ICommon.sol";

interface IGovernance is ICommon {
    event ValidatorSetUpdate(
        uint256 indexed validatorSetNonce,
        address[] bridgeValidatorsSet,
        address[] governanceValidatorsSet,
        bytes32 bridgeValidatorSetHash,
        bytes32 governanceValidatorSetHash
    );
    event NewContract(string indexed name, address addr);
    event UpgradedContract(string indexed name, address addr);

    function upgradeContract(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        string calldata name,
        address addr
    ) external;

    function addContract(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        string calldata name,
        address addr
    ) external;

    function updateValidatorSet(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        ValidatorSetArgs calldata bridgeValidatorSetArgs,
        ValidatorSetArgs calldata governanceValidatorSetArgs,
        Signature[] calldata signatures
    ) external;

    function withdraw(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        address[] calldata tokens,
        address payable to
    ) external;
}
