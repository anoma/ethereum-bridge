//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IHub.sol";
import "../interface/ICommon.sol";

interface IGovernance is ICommon {
    event ValidatorSetUpdate(
        uint256 indexed validatorSetNonce,
        address[] validators,
        bytes32 validateSetHash
    );
    event NewContract(string indexed name, address _address);
    event UpgradedContract(string indexed name, address _address);

    function upgradeContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external;

    function addContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external;

    function updateGovernanceSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        ValidatorSetArgs calldata _newValidatorSetArgs,
        Signature[] calldata _signatures
    ) external;
}
