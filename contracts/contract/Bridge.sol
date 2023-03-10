//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

import "../interface/IBridge.sol";
import "../interface/IProxy.sol";
import "../interface/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Bridge is IBridge, ReentrancyGuard {
    uint8 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public currentValidatorSetHash;
    bytes32 public nextValidatorSetHash;

    uint256 private transferToERC20Nonce = 0;
    uint256 private transferToNamadaNonce = 0;

    uint256 private constant MAX_NONCE_INCREMENT = 10000;

    mapping(address => uint256) private tokenWhiteList;

    IProxy private proxy;

    constructor(
        uint8 _version,
        address[] memory _currentValidators,
        uint256[] memory _currentPowers,
        address[] memory _nextValidators,
        uint256[] memory _nextPowers,
        address[] memory _tokenList,
        uint256[] memory _tokenCap,
        uint256 _thresholdVotingPower,
        IProxy _proxy
    ) {
        require(_currentValidators.length == _currentPowers.length, "Mismatch array length.");
        require(_nextValidators.length == _nextPowers.length, "Mismatch array length.");
        require(_tokenList.length == _tokenCap.length, "Invalid token whitelist.");
        require(_isEnoughVotingPower(_currentPowers, _thresholdVotingPower), "Invalid voting power threshold.");
        require(_isEnoughVotingPower(_nextPowers, _thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        thresholdVotingPower = _thresholdVotingPower;
        currentValidatorSetHash = _computeValidatorSetHash(_currentValidators, _currentPowers, 0);
        nextValidatorSetHash = _computeValidatorSetHash(_nextValidators, _nextPowers, 0);

        for (uint256 i = 0; i < _tokenList.length; ++i) {
            address tokenAddress = _tokenList[i];
            uint256 tokenCap = _tokenCap[i];
            tokenWhiteList[tokenAddress] = tokenCap;
        }

        proxy = IProxy(_proxy);
    }

    function authorize(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        bytes32 _message
    ) external view returns (bool) {
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");
        require(
            _computeValidatorSetHash(_validatorSetArgs) == currentValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

        return checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, _message);
    }

    function transferToERC(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        ERC20Transfer[] calldata _transfers,
        bytes32 _poolRoot,
        bytes32[] calldata _proof,
        bool[] calldata _proofFlags,
        uint256 batchNonce,
        string calldata relayerAddress
    ) external nonReentrant {
        require(transferToERC20Nonce + 1 == batchNonce, "Invalid batchNonce.");
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");

        require(
            _computeValidatorSetHash(_validatorSetArgs) == currentValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

        bytes32 trasferPoolRoot = _computeTransferPoolRootHash(_poolRoot, batchNonce);
        require(
            checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, trasferPoolRoot),
            "Invalid validator set signature."
        );

        bytes32[] memory leaves = new bytes32[](_transfers.length);
        for (uint256 i = 0; i < _transfers.length; i++) {
            bytes32 transferHash = _computeTransferHash(_transfers[i]);
            leaves[i] = transferHash;
        }

        bytes32 root = MerkleProof.processMultiProof(_proof, _proofFlags, leaves);

        require(_poolRoot == root, "Invalid transfers proof.");

        transferToERC20Nonce = batchNonce;

        address vaultAddress = proxy.getContract("vault");
        IVault vault = IVault(vaultAddress);

        ERC20Transfer[] memory validTransfers = new ERC20Transfer[](_transfers.length);

        validTransfers = vault.batchTransferToERC20(_transfers);
        for (uint256 i = 0; i < validTransfers.length; i++) {
            tokenWhiteList[validTransfers[i].from] += validTransfers[i].amount;
        }

        emit TransferToERC(transferToERC20Nonce, validTransfers, relayerAddress);
    }

    // this function assumes that the the tokens are transfered from a ERC20 compliant contract
    function transferToNamada(NamadaTransfer[] calldata _tranfers, uint256 confirmations) external nonReentrant {
        address vaultAddress = proxy.getContract("vault");

        NamadaTransfer[] memory validTransfers = new NamadaTransfer[](_tranfers.length);

        for (uint256 i = 0; i < _tranfers.length; ++i) {
            if (tokenWhiteList[_tranfers[i].from] == 0 || _tranfers[i].amount >= tokenWhiteList[_tranfers[i].from]) {
                emit InvalidTransferToNamada(_tranfers[i].from, _tranfers[i].to, _tranfers[i].amount);
                continue;
            }

            tokenWhiteList[_tranfers[i].from] -= _tranfers[i].amount;

            try IERC20(_tranfers[i].from).transferFrom(msg.sender, vaultAddress, _tranfers[i].amount) {
                validTransfers[i] = _tranfers[i];
            } catch {
                emit InvalidTransferToNamada(_tranfers[i].from, _tranfers[i].to, _tranfers[i].amount);
            }
        }

        transferToNamadaNonce = transferToNamadaNonce + 1;
        emit TransferToNamada(transferToNamadaNonce, validTransfers, confirmations);
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

    function checkValidatorSetVotingPowerAndSignature(
        ValidatorSetArgs calldata validatorSet,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    ) private view returns (bool) {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < validatorSet.powers.length; i++) {
            if (!isValidSignature(validatorSet.validators[i], _messageHash, _signatures[i])) {
                continue;
            }

            powerAccumulator = powerAccumulator + validatorSet.powers[i];
            if (powerAccumulator >= thresholdVotingPower) {
                return true;
            }
        }
        return powerAccumulator >= thresholdVotingPower;
    }

    function getWhitelistAmountFor(address tokenAddress) external view returns (uint256) {
        return tokenWhiteList[tokenAddress];
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
                abi.encode(
                    version,
                    "bridge",
                    validatorSetArgs.validators,
                    validatorSetArgs.powers,
                    validatorSetArgs.nonce
                )
            );
    }

    function _computeTransferHash(ERC20Transfer calldata transfer) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    version,
                    "transfer",
                    transfer.from,
                    transfer.to,
                    transfer.amount,
                    transfer.feeFrom,
                    transfer.fee,
                    transfer.sender
                )
            );
    }

    function _computeTransferPoolRootHash(bytes32 poolRoot, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encode(poolRoot, nonce));
    }

    // duplicate since calldata can't be used in constructor
    function _computeValidatorSetHash(
        address[] memory validators,
        uint256[] memory powers,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(version, "bridge", validators, powers, nonce));
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

    modifier onlyLatestGovernanceContract() {
        address governanceAddress = proxy.getContract("governance");
        require(msg.sender == governanceAddress, "Invalid caller.");
        _;
    }
}
