//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "../interface/IProxy.sol";
import "../interface/IBridge.sol";
import "../interface/IGovernance.sol";
import "../interface/ICommon.sol";

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract Governance is IGovernance, ReentrancyGuard {
    uint8 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public validatorSetHash;
    uint256 public validatorSetNonce = 1;

    uint256 public whitelistNonce = 0;

    uint256 private constant MAX_NONCE_INCREMENT = 10000;

    IProxy private proxy;

    constructor(
        uint8 _version,
        address[] memory _validators,
        uint256[] memory _powers,
        uint256 _thresholdVotingPower,
        IProxy _proxy
    ) {
        require(_validators.length == _powers.length, "Mismatch array length.");
        require(_isEnoughVotingPower(_powers, _thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        validatorSetHash = _computeValidatorSetHash(_validators, _powers, 0);
        thresholdVotingPower = _thresholdVotingPower;
        proxy = IProxy(_proxy);
    }

    function upgradeContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external {
        require(_address != address(0), "Invalid address.");
        require(keccak256(abi.encodePacked(_name)) != keccak256(abi.encodePacked("bridge")), "Invalid contract name.");

        bytes32 messageHash = keccak256(abi.encodePacked(version, "upgradeContract", _name, _address));

        require(authorize(_validators, _signatures, messageHash), "Unauthorized.");

        proxy.upgradeContract(_name, _address);
    }

    function upgradeBridgeContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        address _address
    ) external {
        require(_address != address(0), "Invalid address.");
        bytes32 messageHash = keccak256(abi.encodePacked(version, "upgradeBridgeContract", "bridge", _address));
        address bridgeAddress = proxy.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        require(bridge.authorize(_validators, _signatures, messageHash), "Unauthorized.");

        proxy.upgradeContract("bridge", _address);
    }

    function addContract(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        string calldata _name,
        address _address
    ) external nonReentrant {
        require(_address != address(0), "Invalid address.");
        bytes32 messageHash = keccak256(abi.encodePacked(version, "addContract", _name, _address));

        require(authorize(_validators, _signatures, messageHash), "Unauthorized.");

        proxy.addContract(_name, _address);
    }

    function updateValidatorsSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        bytes32 _bridgeValidatorSetHash,
        bytes32 _governanceValidatorSetHash,
        Signature[] calldata _signatures,
        uint256 nonce
    ) external {
        require(
            _currentValidatorSetArgs.validators.length == _currentValidatorSetArgs.powers.length &&
                _currentValidatorSetArgs.validators.length == _signatures.length,
            "Malformed input."
        );
        require(validatorSetNonce == nonce + 1, "Invalid nonce.");

        address bridgeAddress = proxy.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                version,
                "updateValidatorsSet",
                _bridgeValidatorSetHash,
                _governanceValidatorSetHash,
                nonce
            )
        );

        validatorSetNonce = nonce;

        require(bridge.authorize(_currentValidatorSetArgs, _signatures, messageHash), "Unauthorized.");

        validatorSetHash = _governanceValidatorSetHash;
        bridge.updateValidatorSetHash(_bridgeValidatorSetHash);

        emit ValidatorSetUpdate(validatorSetNonce, _governanceValidatorSetHash, _bridgeValidatorSetHash);
    }

    function updateBridgeWhitelist(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        address[] calldata _tokens,
        uint256[] calldata _tokensCap,
        Signature[] calldata _signatures
    ) external {
        require(
            _currentValidatorSetArgs.validators.length == _currentValidatorSetArgs.powers.length &&
                _currentValidatorSetArgs.validators.length == _signatures.length,
            "Malformed input."
        );

        address bridgeAddress = proxy.getContract("bridge");
        IBridge bridge = IBridge(bridgeAddress);

        bytes32 messageHash = keccak256(
            abi.encodePacked(version, "updateBridgeWhitelist", _tokens, _tokensCap, whitelistNonce)
        );

        require(bridge.authorize(_currentValidatorSetArgs, _signatures, messageHash), "Unauthorized.");

        whitelistNonce = whitelistNonce + 1;
        bridge.updateTokenWhitelist(_tokens, _tokensCap);

        emit UpdateBridgeWhitelist(whitelistNonce - 1, _tokens, _tokensCap);
    }

    function authorize(
        ValidatorSetArgs calldata _validators,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    ) private view returns (bool) {
        require(_validators.validators.length == _validators.powers.length, "Malformed input.");
        require(_computeValidatorSetHash(_validators) == validatorSetHash, "Invalid validatorSetHash.");

        uint256 powerAccumulator = 0;
        for (uint256 i = 0; i < _validators.powers.length; i++) {
            if (!isValidSignature(_validators.validators[i], _messageHash, _signatures[i])) {
                continue;
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
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        (address signer, ECDSA.RecoverError error) = ECDSA.tryRecover(
            messageDigest,
            _signature.v,
            _signature.r,
            _signature.s
        );
        return error == ECDSA.RecoverError.NoError && _signer == signer;
    }

    function _computeValidatorSetHash(ValidatorSetArgs calldata validatorSetArgs) internal view returns (bytes32) {
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

    function _computeValidatorSetHash(
        address[] memory validators,
        uint256[] memory powers,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(version, "governance", validators, powers, nonce));
    }

    function _isEnoughVotingPower(uint256[] memory _powers, uint256 _thresholdVotingPower)
        internal
        pure
        returns (bool)
    {
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
