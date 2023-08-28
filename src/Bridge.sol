//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "src/interfaces/IBridge.sol";
import "src/interfaces/IProxy.sol";
import "src/interfaces/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract Bridge is IBridge, ReentrancyGuard {
    uint8 private immutable version;
    uint256 private immutable thresholdVotingPower;

    bytes32 public currentBridgeValidatorSetHash;
    bytes32 public nextBridgeValidatorSetHash;

    bytes32 public currentGovernanceValidatorSetHash;
    bytes32 public nextGovernanceValidatorSetHash;

    uint256 public transferToErc20Nonce = 0;
    uint256 public transferToChainNonce = 0;

    uint256 public validatorSetNonce = 0;

    IProxy private proxy;

    constructor(
        uint8 _version,
        bytes32[] memory _currentBridgeValidatorSet,
        bytes32[] memory _nextBridgeValidatorSet,
        bytes32[] memory _currentGovernanceValidatorSet,
        bytes32[] memory _nextGovernanceValidatorSet,
        uint256 _thresholdVotingPower,
        IProxy _proxy
    ) {
        require(_isEnoughVotingPower(_currentBridgeValidatorSet, _thresholdVotingPower), "Invalid voting power threshold.");
        require(_isEnoughVotingPower(_nextBridgeValidatorSet, _thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        thresholdVotingPower = _thresholdVotingPower;
        currentBridgeValidatorSetHash = _computeValidatorSetHash("bridge", _currentBridgeValidatorSet, validatorSetNonce);
        nextBridgeValidatorSetHash = _computeValidatorSetHash("bridge", _nextBridgeValidatorSet, validatorSetNonce);
        currentGovernanceValidatorSetHash = _computeValidatorSetHash("governane", _currentGovernanceValidatorSet, validatorSetNonce);
        nextGovernanceValidatorSetHash = _computeValidatorSetHash("governane", _nextGovernanceValidatorSet, validatorSetNonce);

        proxy = IProxy(_proxy);
    }

    function transferToChain(
        ChainTransfer[] calldata _transfers, 
        uint256 confirmations
    ) external {
        address vaultAddress = proxy.getContract("vault");

        bool[] memory validTransfers = new bool[](_transfers.length);

        for (uint256 i = 0; i < _transfers.length; ++i) {
            try IERC20(_transfers[i].from).transferFrom(msg.sender, vaultAddress, _transfers[i].amount) {
                validTransfers[i] = true;
            } catch {
                validTransfers[i] = false;
            }
        }

        uint256 currentNonce = transferToChainNonce;
        transferToChainNonce = transferToChainNonce + 1;

        emit TransferToChain(currentNonce, _transfers, validTransfers, confirmations);
    }


    function transferToErc(RelayProof calldata relayProof) external nonReentrant {
        require(transferToErc20Nonce == relayProof.batchNonce, "Invalid batchNonce.");
        require(_isValidSignatureSet(relayProof.validatorSetArgs, relayProof.signatures), "Mismatch array length.");

        require(
            _computeValidatorSetHash("bridge", relayProof.validatorSetArgs) == currentBridgeValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

        bytes32 trasferPoolRoot = _computeTransferPoolRootHash(relayProof.poolRoot, relayProof.batchNonce);
        require(
            _checkValidatorSetVotingPowerAndSignature(
                relayProof.validatorSetArgs,
                relayProof.signatures,
                trasferPoolRoot
            ),
            "Invalid validator set signature."
        );

        bytes32[] memory leaves = new bytes32[](relayProof.transfers.length);

        for (uint256 i = 0; i < relayProof.transfers.length; i++) {
            bytes32 transferHash = _computeTransferHash(relayProof.transfers[i], relayProof.transfersInfo[i]);
            leaves[i] = transferHash;
        }

        bytes32 root = MerkleProof.processMultiProof(relayProof.proof, relayProof.proofFlags, leaves);

        require(relayProof.poolRoot == root, "Invalid transfers proof.");

        transferToErc20Nonce = relayProof.batchNonce + 1;

        address vaultAddress = proxy.getContract("vault");
        IVault vault = IVault(vaultAddress);

        bool[] memory completedTransfers = vault.batchTransferToErc20(relayProof.transfers);

        emit TransferToErc(relayProof.batchNonce, relayProof.transfers, completedTransfers, relayProof.relayerAddress);
    }

    function updateValidatorsSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        bytes32 _bridgeValidatorSetHash,
        bytes32 _governanceValidatorSetHash,
        Signature[] calldata _signatures,
        uint256 _nonce
    ) external {
        require(_isValidSignatureSet(_currentValidatorSetArgs, _signatures), "Malformed input.");
        require(validatorSetNonce + 1 == _nonce, "Invalid nonce.");

        bytes32 messageHash = _computeValidatorSetUpdateMessage(_bridgeValidatorSetHash, _governanceValidatorSetHash, _nonce);

        require(_authorize(_currentValidatorSetArgs, _signatures, messageHash), "Unauthorized.");

        currentBridgeValidatorSetHash = nextBridgeValidatorSetHash;
        nextBridgeValidatorSetHash = _bridgeValidatorSetHash;
        currentGovernanceValidatorSetHash = nextGovernanceValidatorSetHash;
        nextGovernanceValidatorSetHash = _governanceValidatorSetHash;
        validatorSetNonce = _nonce;

        emit ValidatorSetUpdate(validatorSetNonce, nextBridgeValidatorSetHash, nextGovernanceValidatorSetHash);
    }

    function _computeTransferPoolRootHash(bytes32 poolRoot, uint256 nonce) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(poolRoot, nonce));
    }

    function _computeTransferHash(Erc20Transfer calldata transfer, Erc20TransferInfo calldata transferInfo) internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    version,
                    "transfer",
                    transfer.from,
                    transfer.to,
                    transfer.amount,
                    transferInfo.feeFrom,
                    transferInfo.fee,
                    transferInfo.sender,
                    transferInfo.kind
                )
            );
    }

    function _authorize(
        ValidatorSetArgs calldata _validatorSetArgs,
        Signature[] calldata _signatures,
        bytes32 _message
    ) internal view returns (bool) {
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Mismatch array length.");
        require(
            _computeValidatorSetHash("bridge", _validatorSetArgs) == currentBridgeValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

        return _checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, _message);
    }

    function _checkValidatorSetVotingPowerAndSignature(
        ValidatorSetArgs calldata _validatorSet,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    ) internal view returns (bool) {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < _validatorSet.validatorSet.length; i++) {
            address addr = _getAddress(_validatorSet.validatorSet[i]);
            if (!_isValidSignature(addr, _messageHash, _signatures[i])) {
                continue;
            }

            powerAccumulator = powerAccumulator + _getVotingPower(_validatorSet.validatorSet[i]);
            if (powerAccumulator >= thresholdVotingPower) {
                return true;
            }
        }
        return powerAccumulator >= thresholdVotingPower;
    }

    function _isValidSignature(
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

    function _isEnoughVotingPower(
        bytes32[] memory _validatorSet,
        uint256 _thresholdVotingPower
    ) internal pure returns (bool) {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < _validatorSet.length; i++) {
            powerAccumulator = powerAccumulator + _getVotingPower(_validatorSet[i]);
            if (powerAccumulator >= _thresholdVotingPower) {
                return true;
            }
        }
        return false;
    }

    function _computeValidatorSetHash(
        string memory namespace,
        bytes32[] memory _validatorSet,
        uint256 nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(version, namespace, _validatorSet, nonce));
    }
    
    function _computeValidatorSetUpdateMessage(
        bytes32 _bridgeValidatorSetHash,
        bytes32 _governanceValidatorSetHash,
        uint256 _nonce
    ) internal view returns (bytes32) {
        return keccak256(abi.encode(version, "updateValidatorsSet", _bridgeValidatorSetHash, _governanceValidatorSetHash, _nonce));
    }

    function _computeValidatorSetHash(
        string memory namespace,
        ValidatorSetArgs calldata validatorSetArgs
    ) internal view returns (bytes32) {
    return
        keccak256(
            abi.encode(
                version,
                namespace,
                validatorSetArgs.validatorSet,
                validatorSetArgs.nonce
            )
        );
    }

    function _isValidValidatorSetArg(ValidatorSetArgs calldata validatorSetArg) internal pure returns (bool) {
        return validatorSetArg.validatorSet > 0;
    }

    function _isValidSignatureSet(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signature
    ) internal pure returns (bool) {
        return _isValidValidatorSetArg(validatorSetArgs) && validatorSetArgs.validatorSet.length == signature.length;
    }

    function _getVotingPower(
        bytes32 _bytes
    ) private pure returns (uint96) {
        bytes12 x;
        assembly {
            x := shl(160, _bytes)
        }
        return uint96(x);
    }

    function _getAddress(
        bytes32 _bytes
    ) private pure returns (address) {
        return address(bytes20(_bytes));
    }
}