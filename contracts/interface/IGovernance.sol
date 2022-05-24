//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IHub.sol";
import "../interface/ICommon.sol";

interface IGovernance is ICommon {
    event ValidatorSetUpdate(
        uint256 indexed validatorSetNonce,
        bytes32 bridgeValidatoreSetHash,
        bytes32 governanceValidatoreSetHash
    );
    event NewContract(string indexed name, address addr);
    event UpgradedContract(string indexed name, address addr);
    event UpdateBridgeWhitelist(uint256 indexed nonce, address[] tokens, uint256[] tokenCap);

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

    function updateValidatorsSet(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        bytes32 bridgeValidatorSetHash,
        bytes32 governanceValidatorSetHash,
        Signature[] calldata signatures
    ) external;

    function updateBridgeWhitelist(
        ValidatorSetArgs calldata currentValidatorSetArgs,
        address[] calldata tokens,
        uint256[] calldata tokensCap,
        Signature[] calldata signatures
    ) external;

    function withdraw(
        ValidatorSetArgs calldata validators,
        Signature[] calldata signatures,
        address[] calldata tokens,
        address payable to
    ) external;
}
