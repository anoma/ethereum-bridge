//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.15;

import "../interface/IBridge.sol";
import "../interface/IHub.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Bridge is IBridge, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public currentValidatorSetHash;
    bytes32 public nextValidatorSetHash;

    uint256 private transferToERC20Nonce = 0;
    uint256 private transferToNamadaNonce = 0;

    uint256 private constant MAX_NONCE_INCREMENT = 10000;
    uint256 private constant MAX_UINT = 115792089237316195423570985008687907853269984665640564039457584007913129639935;

    mapping(address => uint256) tokenWhiteList;

    IHub private hub;

    constructor(
        uint8 _version,
        address[] memory _currentValidators,
        uint256[] memory _currentPowers,
        address[] memory _nextValidators,
        uint256[] memory _nextPowers,
        address[] memory _tokenList,
        uint256[] memory _tokenCap,
        uint256 _thresholdVotingPower,
        IHub _hub
    ) {
        require(_currentValidators.length == _currentPowers.length, "Mismatch array length.");
        require(_nextValidators.length == _nextPowers.length, "Mismatch array length.");
        require(_tokenList.length == _tokenCap.length, "Invalid token whitelist.");
        require(_isEnoughVotingPower(_currentPowers, _thresholdVotingPower), "Invalid voting power threshold.");
        require(_isEnoughVotingPower(_nextPowers, _thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        thresholdVotingPower = _thresholdVotingPower;
        currentValidatorSetHash = computeValidatorSetHash(_currentValidators, _currentPowers, 0);
        nextValidatorSetHash = computeValidatorSetHash(_nextValidators, _nextPowers, 0);

        for (uint256 i = 0; i < _tokenList.length; ++i) {
            address tokenAddress = _tokenList[i];
            uint256 tokenCap = _tokenCap[i];
            tokenWhiteList[tokenAddress] = tokenCap;
        }

        hub = IHub(_hub);
    }

    function authorize(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        bytes32 _message
    ) external view returns (bool) {
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");
        require(
            computeValidatorSetHash(_validatorSetArgs) == currentValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

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
            _batchNonce > transferToERC20Nonce && transferToERC20Nonce + MAX_NONCE_INCREMENT > _batchNonce,
            "Invalid nonce."
        );
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");

        require(
            computeValidatorSetHash(_validatorSetArgs) == currentValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );
        require(_isValidBatch(_froms.length, _tos.length, _amounts.length), "Invalid batch.");

        bytes32 batchHash = computeBatchHash(_froms, _tos, _amounts, _batchNonce);

        require(
            checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, batchHash),
            "Invalid validator set signature."
        );

        for (uint256 i = 0; i < _amounts.length; ++i) {
            IERC20(_froms[i]).safeTransfer(_tos[i], _amounts[i]);
        }

        transferToERC20Nonce = _batchNonce;
        emit TrasferToERC(transferToERC20Nonce, _froms, _tos, _amounts);
    }

    function transferToNamada(
        address[] calldata _froms,
        uint256[] calldata _amounts,
        string[] calldata _tos,
        uint256 confirmations
    ) external nonReentrant {
        require(_froms.length == _amounts.length, "Invalid batch.");

        uint256[] memory amounts = new uint256[](_amounts.length);

        for (uint256 i = 0; i < _amounts.length; ++i) {
            uint256 preBalance = IERC20(_froms[i]).balanceOf(address(this));

            IERC20(_froms[i]).safeTransferFrom(msg.sender, address(this), _amounts[i]);

            uint256 postBalance = IERC20(_froms[i]).balanceOf(address(this));
            require(postBalance > preBalance, "Invalid transfer.");

            amounts[i] = postBalance - preBalance;

            require(tokenWhiteList[_froms[i]] != 0, "Token is not whitelisted.");
            require(tokenWhiteList[_froms[i]] >= postBalance, "Token cap reached.");
        }

        transferToNamadaNonce = transferToNamadaNonce + 1;
        emit TransferToNamada(transferToNamadaNonce, _froms, _tos, amounts, confirmations);
    }

    function updateValidatorSetHash(bytes32 _validatorSetHash) external onlyLatestGovernanceContract {
        currentValidatorSetHash = nextValidatorSetHash;
        nextValidatorSetHash = _validatorSetHash;
    }

    function updateTokenWhitelist(address[] calldata _tokens, uint256[] calldata _tokensCap)
        external
        onlyLatestGovernanceContract
    {
        require(_tokens.length == _tokensCap.length, "Invalid inputs.");
        for (uint256 i = 0; i < _tokens.length; i++) {
            tokenWhiteList[_tokens[i]] = _tokensCap[i];
        }
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
            if (!isValidSignature(validatorSet.validators[i], _messageHash, _signatures[i])) {
                return false;
            }

            powerAccumulator = powerAccumulator + validatorSet.powers[i];
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

    function computeValidatorSetHash(ValidatorSetArgs calldata validatorSetArgs) internal view returns (bytes32) {
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
            keccak256(
                abi.encodePacked(version, "transfer", _froms, _tos, _amounts, _batchNonce, currentValidatorSetHash)
            );
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
