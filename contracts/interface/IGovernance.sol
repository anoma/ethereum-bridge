//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IHub.sol";
import "../interface/ICommon.sol";

interface IGovernance is ICommon {
    event ValidatorSetUpdate(uint256 indexed validatorSetNonce, address[] validators, bytes32 validateSetHash);
    event NewContract(string indexed name, address addr);
    event UpgradedContract(string indexed name, address addr);

    function upgradeContract(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        string calldata name,
        address addr
    ) external;

    function upgradeBridgeContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        address[] calldata _tokens,
        address payable _address
    ) external;

    function addContract(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        string calldata name,
        address addr
    ) external;

    function updateGovernanceSet(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        ValidatorSetArgs calldata newValidatorSetArgs,
        Signature[] calldata signatures
    ) external;

    function withdraw(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        address[] calldata tokens,
        address payable to
    ) external;
}
