//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IHub.sol";
import "../interface/IBridge.sol";
import "../interface/IGovernance.sol";
import "../interface/ICommon.sol";

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Governance is IGovernance {
    uint256 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public lastValidatorSetHash;
    uint256 public lastValidatorSetNonce = 0;

    IHub private hub;

    constructor(
        uint256 _version,
        address[] memory _validators,
        uint256[] memory _powers,
        uint256 _thresholdVotingPower,
        IHub _hub
    ) {
        require(_validators.length == _powers.length, "Mismatch array length.");
        require(
            _isEnoughVotingPower(_powers, _thresholdVotingPower),
            "Invalid voting power threshold."
        );

        version = _version;
        lastValidatorSetHash = computeValidatorSetHash(_validators, _powers, lastValidatorSetNonce);
        thresholdVotingPower = _thresholdVotingPower;
        hub = IHub(_hub);
    }

    function upgradeContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external {
        require(_address != address(0), "Invalid address");
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                version,
                "upgradeContract",
                _name,
                _address
            )
        );
        address bridgeAddress = hub.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        require(
            bridge.authorize(
                _validators,
                _signatures,
                messageHash
            ),
            "Unauthorized."
        );

        hub.upgradeContract(_name, _address);
    }

    function addContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external {
        require(_address != address(0), "Invalid address");
        bytes32 messageHash = keccak256(
            abi.encodePacked(version, "addContract", _name, _address)
        );

        address bridgeAddress = hub.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        require(
            bridge.authorize(
                _validators,
                _signatures,
                messageHash
            ),
            "Unauthorized."
        );

        hub.addContract(_name, _address);
    }

    function updateGovernanceSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        ValidatorSetArgs calldata _newValidatorSetArgs,
        Signature[] calldata _signatures
    ) external {
        require(
            lastValidatorSetNonce < _newValidatorSetArgs.nonce &&
                lastValidatorSetNonce + 10000 > _newValidatorSetArgs.nonce,
            "Invalid nonce."
        );

        address bridgeAddress = hub.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        bytes32 newValidatorSetHash = computeValidatorSetHash(
            _newValidatorSetArgs
        );
        require(
            bridge.authorize(
                _currentValidatorSetArgs,
                _signatures,
                newValidatorSetHash
            ),
            "Unauthorized."
        );

        lastValidatorSetHash = newValidatorSetHash;
        lastValidatorSetNonce = _newValidatorSetArgs.nonce;

        emit ValidatorSetUpdate(
            lastValidatorSetNonce,
            _newValidatorSetArgs.validators,
            newValidatorSetHash
        );
    }

    function authorize(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    ) private view returns (bool) {
        require(
            _validators.nonce > lastValidatorSetNonce &&
                lastValidatorSetNonce + 10000 < _validators.nonce,
            "Invalid nonce."
        );
        require(
            _validators.validators.length == _validators.powers.length,
            "Malformed input."
        );
        require(
            computeValidatorSetHash(_validators) ==
                lastValidatorSetHash,
            "Invalid validatorSetHash"
        );

        uint256 powerAccumulator = 0;
        for (uint256 i = 0; i < _validators.powers.length; i++) {
            if (
                !isValidSignature(
                    _validators.validators[i],
                    _messageHash,
                    _signatures[i]
                )
            ) {
                return false;
            }

            powerAccumulator = powerAccumulator + _validators.powers[i];
            if (powerAccumulator >= thresholdVotingPower) {
                return true;
            }
        }
        return powerAccumulator >= thresholdVotingPower;
    }

    function isValidSignature(
        address _signer,
        bytes32 _messageHash,
        Signature calldata _signature
    ) internal pure returns (bool) {
        bytes32 messageDigest = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash)
        );
        (address signer, ECDSA.RecoverError error) = ECDSA.tryRecover(
            messageDigest,
            _signature.v,
            _signature.r,
            _signature.s
        );
        return error == ECDSA.RecoverError.NoError && _signer == signer;
    }

    function computeValidatorSetHash(
        ValidatorSetArgs calldata validatorSetArgs
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    version,
                    "governance",
                    validatorSetArgs.validators,
                    validatorSetArgs.powers,
                    validatorSetArgs.nonce
                )
            );
    }

    function computeValidatorSetHash(
        address[] memory validators,
        uint256[] memory powers,
        uint256 nonce
    ) internal view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    version,
                    "governance",
                    validators,
                    powers,
                    nonce
                )
            );
    }

    function _isEnoughVotingPower(
        uint256[] memory _powers,
        uint256 _thresholdVotingPower
    ) internal pure returns (bool) {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < _powers.length; i++) {
            powerAccumulator = powerAccumulator + _powers[i];
            if (powerAccumulator >= _thresholdVotingPower) {
                return true;
            }
        }
        return false;
    }
}
