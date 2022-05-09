//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "../interface/IBridge.sol";
import "../interface/IHub.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "hardhat/console.sol";

contract Bridge is IBridge, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public lastValidatorSetHash;
    uint256 public lastValidatorSetNonce = 0;

    uint256 private lastTransferToERC20Nonce = 0;
    uint256 private lastTransferToNamadaNonce = 0;

    uint256 private constant MAX_NONCE_INCREMENT = 10000;
    uint256 private constant MAX_UINT = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

    IHub private hub;

    constructor(
        uint256 _version,
        address[] memory _validators,
        uint256[] memory _powers,
        uint256 _thresholdVotingPower,
        IHub _hub
    ) {
        require(_validators.length == _powers.length, "Mismatch array length.");
        require(_isEnoughVotingPower(_powers, _thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        thresholdVotingPower = _thresholdVotingPower;
        lastValidatorSetHash = computeValidatorSetHash(_validators, _powers, lastValidatorSetNonce);
        hub = IHub(_hub);

        emit ValidatorSetUpdate(lastValidatorSetNonce, _validators, lastValidatorSetHash);
    }

    function authorize(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        bytes32 _message
    ) external view returns (bool) {
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");
        require(computeValidatorSetHash(_validatorSetArgs) == lastValidatorSetHash, "Invalid validatorSetHash.");

        return checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, _message);
    }

    function transferToERC(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts,
        uint256 _batchNonce
    ) external nonReentrant {
        require(
            _batchNonce > lastTransferToERC20Nonce && lastTransferToERC20Nonce + MAX_NONCE_INCREMENT > _batchNonce,
            "Invalid nonce."
        );
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");

        require(computeValidatorSetHash(_validatorSetArgs) == lastValidatorSetHash, "Invalid validatorSetHash.");
        require(_isValidBatch(_froms.length, _tos.length, _amounts.length), "Invalid batch.");

        bytes32 batchHash = computeBatchHash(_froms, _tos, _amounts, _batchNonce);

        require(
            checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, batchHash),
            "Invalid validator set signature."
        );

        for (uint256 i = 0; i < _amounts.length; ++i) {
            IERC20(_froms[i]).safeTransfer(_tos[i], _amounts[i]);
        }

        lastTransferToERC20Nonce = _batchNonce;
        emit TrasferToECR(lastTransferToERC20Nonce, _froms, _tos, _amounts);
    }

    function transferToNamada(address[] calldata _froms, uint256[] calldata _amounts) external nonReentrant {
        require(_froms.length == _amounts.length, "Invalid batch.");

        uint256[] memory amounts = new uint256[](_amounts.length);

        for (uint256 i = 0; i < _amounts.length; ++i) {
            uint256 preBalance = IERC20(_froms[i]).balanceOf(address(this));

            IERC20(_froms[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);

            uint256 postBalance = IERC20(_froms[i]).balanceOf(address(this));
            require(postBalance > preBalance, "Invalid transfer.");

            amounts[i] = postBalance - preBalance;
        }

        lastTransferToNamadaNonce = lastTransferToNamadaNonce + 1;
        emit TransferToNamada(lastTransferToNamadaNonce, _froms, amounts);
    }

    function updateValidatorSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        ValidatorSetArgs calldata _newValidatorSetArgs,
        Signature[] calldata _signatures
    ) external {
        require(
            _newValidatorSetArgs.nonce > _currentValidatorSetArgs.nonce &&
                _newValidatorSetArgs.nonce < _currentValidatorSetArgs.nonce + MAX_NONCE_INCREMENT,
            "Invalid validatorSetNonce"
        );
        require(
            _isValidSignatureSet(_currentValidatorSetArgs, _signatures) &&
                _isValidValidatorSetArg(_newValidatorSetArgs),
            "Mismatch array length."
        );
        require(computeValidatorSetHash(_currentValidatorSetArgs) == lastValidatorSetHash, "Invalid validatorSetHash.");

        require(_isEnoughVotingPower(_newValidatorSetArgs.powers, thresholdVotingPower), "Not enough voting power.");

        bytes32 newValidatorSetHash = computeValidatorSetHash(_newValidatorSetArgs);
        
        require(
            checkValidatorSetVotingPowerAndSignature(_currentValidatorSetArgs, _signatures, newValidatorSetHash),
            "Invalid validator set signature."
        );

        lastValidatorSetHash = newValidatorSetHash;
        lastValidatorSetNonce = _newValidatorSetArgs.nonce;

        emit ValidatorSetUpdate(lastValidatorSetNonce, _newValidatorSetArgs.validators, newValidatorSetHash);
    }

    function withdraw(address[] calldata _tokens, address payable _to) external onlyLatestGovernanceContract {
        require(_to != address(0), "Invalid address.");
        address self = address(this);

        for (uint256 i = 0; i < _tokens.length; i++) {
            uint256 balance = IERC20(_tokens[i]).balanceOf(self);
            IERC20(_tokens[i]).safeTransfer(_to, balance);
        }

        selfdestruct(_to);
    }

    function checkValidatorSetVotingPowerAndSignature(
        ValidatorSetArgs calldata validatorSet,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    ) private view returns (bool) {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < validatorSet.powers.length; i++) {
            console.log("%s", i);
            if (!isValidSignature(validatorSet.validators[i], _messageHash, _signatures[i])) {
                return false;
            }

            powerAccumulator = powerAccumulator + validatorSet.powers[i];
            if (powerAccumulator >= thresholdVotingPower) {
                console.log("OVER");
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

    function computeValidatorSetHash(ValidatorSetArgs calldata validatorSetArgs) private view returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    version,
                    "bridge",
                    validatorSetArgs.validators,
                    validatorSetArgs.powers,
                    validatorSetArgs.nonce
                )
            );
    }

    // duplicate since calldata can't be used in constructor
    function computeValidatorSetHash(
        address[] memory validators,
        uint256[] memory powers,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(version, "bridge", validators, powers, nonce));
    }

    function computeBatchHash(
        address[] calldata _froms,
        address[] calldata _tos,
        uint256[] calldata _amounts,
        uint256 _batchNonce
    ) private view returns (bytes32) {
        return
            keccak256(abi.encodePacked(version, "transfer", _froms, _tos, _amounts, _batchNonce, lastValidatorSetHash));
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

    function _isValidValidatorSetArg(ValidatorSetArgs calldata newValidatorSetArgs) internal pure returns (bool) {
        return
            newValidatorSetArgs.validators.length > 0 &&
            newValidatorSetArgs.validators.length == newValidatorSetArgs.powers.length;
    }

    function _isValidSignatureSet(ValidatorSetArgs calldata validatorSetArgs, Signature[] calldata signature)
        internal
        pure
        returns (bool)
    {
        return _isValidValidatorSetArg(validatorSetArgs) && validatorSetArgs.validators.length == signature.length;
    }

    function _isValidBatch(
        uint256 _froms,
        uint256 _tos,
        uint256 _amounts
    ) internal pure returns (bool) {
        return _froms == _tos && _froms == _amounts;
    }

    modifier onlyLatestGovernanceContract() {
        address governanceAddress = hub.getContract("governance");
        require(msg.sender == governanceAddress, "Invalid caller.");
        _;
    }
}
