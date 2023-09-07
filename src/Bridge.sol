//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "src/interfaces/IBridge.sol";
import "src/interfaces/IProxy.sol";
import "src/interfaces/IVault.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "forge-std/console.sol";

contract Bridge is IBridge, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint96 private constant thresholdVotingPower = 52_818_775_009_509_558_395_695_966_890;
    uint8 private immutable version;

    bytes32 public currentBridgeValidatorSetHash;
    bytes32 public nextBridgeValidatorSetHash;

    bytes32 public currentGovernanceValidatorSetHash;
    bytes32 public nextGovernanceValidatorSetHash;

    uint256 public transferToErc20Nonce = 0;
    uint256 public transferToChainNonce = 0;

    uint256 public validatorSetNonce = 0;

    uint256 public withdrawNonce = 0;
    uint256 public upgradeNonce = 0;

    IProxy private immutable proxy;

    bytes1 private constant prefixMin = bytes1(0);

    constructor(
        uint8 _version,
        bytes32[] memory _currentBridgeValidatorSet,
        bytes32[] memory _nextBridgeValidatorSet,
        bytes32[] memory _currentGovernanceValidatorSet,
        bytes32[] memory _nextGovernanceValidatorSet,
        IProxy _proxy
    ) {
        require(
            _isEnoughVotingPower(_currentBridgeValidatorSet, thresholdVotingPower), "Invalid voting power threshold."
        );
        require(_isEnoughVotingPower(_nextBridgeValidatorSet, thresholdVotingPower), "Invalid voting power threshold.");

        version = _version;
        currentBridgeValidatorSetHash = _computeValidatorSetHash("bridge", _currentBridgeValidatorSet, 2 ** 256 - 1);
        nextBridgeValidatorSetHash = _computeValidatorSetHash("bridge", _nextBridgeValidatorSet, validatorSetNonce);
        currentGovernanceValidatorSetHash =
            _computeValidatorSetHash("governance", _currentGovernanceValidatorSet, 2 ** 256 - 1);
        nextGovernanceValidatorSetHash =
            _computeValidatorSetHash("governance", _nextGovernanceValidatorSet, validatorSetNonce);

        proxy = IProxy(_proxy);
    }

    // all transfers in the batch must be valid or the whole batch will revert
    function transferToChain(ChainTransfer[] calldata _transfers, uint256 confirmations) external nonReentrant {
        address vaultAddress = proxy.getContract("vault");

        for (uint256 i = 0; i < _transfers.length;) {
            IERC20(_transfers[i].from).safeTransferFrom(msg.sender, vaultAddress, _transfers[i].amount);
            unchecked {
                i++;
            }
        }

        uint256 currentNonce = transferToChainNonce;
        transferToChainNonce = currentNonce + 1;

        emit TransferToChain(currentNonce, _transfers, confirmations);
    }

    // all transfers in the relay proof must be valid or the whole batch will revert
    function transferToErc(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        RelayProof calldata relayProof
    )
        external
        nonReentrant
    {
        require(transferToErc20Nonce == relayProof.batchNonce, "Invalid batchNonce.");
        require(_isValidSignatureSet(validatorSetArgs, signatures), "Mismatch array length.");
        require(relayProof.transfers.length > 0, "Invalid transfers count.");
        require(
            _computeValidatorSetHash("bridge", validatorSetArgs) == currentBridgeValidatorSetHash,
            "Invalid currentValidatorSetHash."
        );

        bytes32 trasferPoolRoot = _computeTransferPoolRootHash(relayProof.poolRoot, relayProof.batchNonce);
        require(
            _checkValidatorSetVotingPowerAndSignature(validatorSetArgs, signatures, trasferPoolRoot),
            "Invalid validator set signature."
        );

        bytes32[] memory leaves = new bytes32[](relayProof.transfers.length);

        for (uint256 i = 0; i < relayProof.transfers.length;) {
            leaves[i] = _computeTransferHash(relayProof.transfers[i]);
            unchecked {
                i++;
            }
        }

        require(
            _multiProofVerifyCalldata(relayProof.proof, relayProof.proofFlags, relayProof.poolRoot, leaves),
            "Invalid transfers proof."
        );

        address vaultAddress = proxy.getContract("vault");
        IVault(vaultAddress).batchTransferToErc20(relayProof.transfers);

        transferToErc20Nonce = relayProof.batchNonce + 1;

        emit TransferToErc(relayProof.batchNonce, relayProof.transfers, relayProof.relayerAddress);
    }

    function updateValidatorSet(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        bytes32 _bridgeValidatorSetHash,
        bytes32 _governanceValidatorSetHash,
        Signature[] calldata _signatures
    )
        external
    {
        require(_isValidSignatureSet(_currentValidatorSetArgs, _signatures), "Malformed input.");

        bytes32 messageHash = _computeValidatorSetUpdateMessage(
            _bridgeValidatorSetHash, _governanceValidatorSetHash, validatorSetNonce + 1
        );

        require(
            _authorize(_currentValidatorSetArgs, nextBridgeValidatorSetHash, "bridge", _signatures, messageHash),
            "Unauthorized."
        );

        currentBridgeValidatorSetHash = nextBridgeValidatorSetHash;
        nextBridgeValidatorSetHash = _bridgeValidatorSetHash;
        currentGovernanceValidatorSetHash = nextGovernanceValidatorSetHash;
        nextGovernanceValidatorSetHash = _governanceValidatorSetHash;
        validatorSetNonce = validatorSetNonce + 1;

        emit ValidatorSetUpdate(validatorSetNonce, nextBridgeValidatorSetHash, nextGovernanceValidatorSetHash);
    }

    function withdraw(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        Erc20Transfer[] calldata transfers,
        Signature[] calldata _signatures,
        uint256 _nonce
    )
        external
        nonReentrant
    {
        require(withdrawNonce + 1 == _nonce, "Invalid nonce.");
        require(_isValidSignatureSet(_currentValidatorSetArgs, _signatures), "Malformed input.");

        bytes32 messageHash = _computeWithdrawalMessage(_currentValidatorSetArgs, transfers, _nonce);

        require(
            _authorize(
                _currentValidatorSetArgs, currentGovernanceValidatorSetHash, "governance", _signatures, messageHash
            ),
            "Unauthorized."
        );

        address vaultAddress = proxy.getContract("vault");
        IVault vault = IVault(vaultAddress);

        vault.batchTransferToErc20(transfers);

        withdrawNonce = _nonce;
    }

    function upgrade(
        ValidatorSetArgs calldata _currentValidatorSetArgs,
        Signature[] calldata _signatures,
        address _to,
        uint256 _nonce
    )
        external
    {
        require(upgradeNonce + 1 == _nonce, "Invalid nonce.");
        require(_isValidSignatureSet(_currentValidatorSetArgs, _signatures), "Malformed input.");

        bytes32 messageHash = _computeUpgradeMessage(_currentValidatorSetArgs, _to, _nonce);

        require(
            _authorize(
                _currentValidatorSetArgs, currentGovernanceValidatorSetHash, "governance", _signatures, messageHash
            ),
            "Unauthorized."
        );

        proxy.upgradeContract("bridge", _to);

        upgradeNonce = _nonce;
    }

    function _computeTransferPoolRootHash(
        bytes32 poolRoot,
        uint256 nonce
    )
        internal
        pure
        returns (bytes32 signableHash)
    {
        assembly ("memory-safe") {
            let scratch := mload(0x40)

            mstore(scratch, poolRoot)
            mstore(add(scratch, 0x20), nonce)

            signableHash := keccak256(scratch, 64)
        }
    }

    function _computeTransferHash(Erc20Transfer calldata transfer) internal view returns (bytes32) {
        return
            keccak256(abi.encode(version, "transfer", transfer.from, transfer.to, transfer.amount, transfer.dataDigest));
    }

    function _authorize(
        ValidatorSetArgs calldata _validatorSetArgs,
        bytes32 _validatorSetHash,
        string memory namespace,
        Signature[] calldata _signatures,
        bytes32 _message
    )
        internal
        view
        returns (bool)
    {
        require(_isValidSignatureSet(_validatorSetArgs, _signatures), "Malformed input.");
        require(
            _computeValidatorSetHash(namespace, _validatorSetArgs) == _validatorSetHash, "Invalid validatorSetHash."
        );

        return _checkValidatorSetVotingPowerAndSignature(_validatorSetArgs, _signatures, _message);
    }

    function _checkValidatorSetVotingPowerAndSignature(
        ValidatorSetArgs calldata _validatorSet,
        Signature[] calldata _signatures,
        bytes32 _messageHash
    )
        internal
        pure
        returns (bool)
    {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < _validatorSet.validatorSet.length;) {
            address addr = _getAddress(_validatorSet.validatorSet[i]);
            if (!_isValidSignature(addr, _messageHash, _signatures[i])) {
                unchecked {
                    i++;
                }
                continue;
            }
            powerAccumulator = powerAccumulator + _getVotingPower(_validatorSet.validatorSet[i]);
            if (powerAccumulator >= thresholdVotingPower) {
                return true;
            }
            unchecked {
                i++;
            }
        }
        return powerAccumulator >= thresholdVotingPower;
    }

    function _isValidSignature(
        address _signer,
        bytes32 _messageHash,
        Signature calldata _signature
    )
        internal
        pure
        returns (bool)
    {
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _messageHash));
        (address signer, ECDSA.RecoverError error) =
            ECDSA.tryRecover(messageDigest, _signature.v, _signature.r, _signature.s);
        return error == ECDSA.RecoverError.NoError && _signer == signer;
    }

    function _isEnoughVotingPower(
        bytes32[] memory _validatorSet,
        uint256 _thresholdVotingPower
    )
        internal
        pure
        returns (bool)
    {
        uint256 powerAccumulator = 0;

        for (uint256 i = 0; i < _validatorSet.length;) {
            powerAccumulator = powerAccumulator + _getVotingPower(_validatorSet[i]);
            if (powerAccumulator >= _thresholdVotingPower) {
                return true;
            }
            unchecked {
                i++;
            }
        }
        return false;
    }

    function _computeValidatorSetHash(
        string memory namespace,
        bytes32[] memory _validatorSet,
        uint256 _nonce
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(version, namespace, _validatorSet, _nonce));
    }

    function _computeWithdrawalMessage(
        ValidatorSetArgs calldata _validatorSetArgs,
        Erc20Transfer[] calldata _transfers,
        uint256 _nonce
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(version, "withdraw", _validatorSetArgs.validatorSet, _transfers, _nonce));
    }

    function _computeUpgradeMessage(
        ValidatorSetArgs calldata _validatorSetArgs,
        address _to,
        uint256 _nonce
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(version, "upgrade", _validatorSetArgs.validatorSet, _to, _nonce));
    }

    function _computeValidatorSetUpdateMessage(
        bytes32 _bridgeValidatorSetHash,
        bytes32 _governanceValidatorSetHash,
        uint256 _nonce
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encode(version, "updateValidatorSet", _bridgeValidatorSetHash, _governanceValidatorSetHash, _nonce)
        );
    }

    function _computeValidatorSetHash(
        string memory namespace,
        ValidatorSetArgs calldata validatorSetArgs
    )
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(version, namespace, validatorSetArgs.validatorSet, validatorSetArgs.nonce));
    }

    function _isValidValidatorSetArg(ValidatorSetArgs calldata validatorSetArg) internal pure returns (bool) {
        return validatorSetArg.validatorSet.length > 0;
    }

    function _isValidSignatureSet(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signature
    )
        internal
        pure
        returns (bool)
    {
        return _isValidValidatorSetArg(validatorSetArgs) && validatorSetArgs.validatorSet.length == signature.length;
    }

    function _getVotingPower(bytes32 _bytes) private pure returns (uint96) {
        bytes12 x;
        assembly {
            x := shl(160, _bytes)
        }
        return uint96(x);
    }

    function _getAddress(bytes32 _bytes) private pure returns (address) {
        return address(bytes20(_bytes));
    }

    // implementation copied from openzeppeling
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/MerkleProof.sol#L88
    function _multiProofVerifyCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32 root,
        bytes32[] memory leaves
    )
        internal
        pure
        returns (bool)
    {
        return _processMultiProofCalldata(proof, proofFlags, leaves) == root;
    }

    // implementation copied from openzeppeling
    // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/MerkleProof.sol#L163
    // we changed the hashing function `_hashPair` to include a prefix
    // this is done to avoid any second pre-image attack
    function _processMultiProofCalldata(
        bytes32[] calldata proof,
        bool[] calldata proofFlags,
        bytes32[] memory leaves
    )
        internal
        pure
        returns (bytes32 merkleRoot)
    {
        uint256 leavesLen = leaves.length;
        uint256 totalHashes = proofFlags.length;

        if (leavesLen + proof.length - 1 != totalHashes) {
            revert MerkleProofInvalidMultiproof();
        }

        bytes32[] memory hashes = new bytes32[](totalHashes);
        uint256 leafPos = 0;
        uint256 hashPos = 0;
        uint256 proofPos = 0;

        for (uint256 i = 0; i < totalHashes; i++) {
            (bytes32 a, bytes1 prefix) =
                leafPos < leavesLen ? (leaves[leafPos++], prefixMin) : (hashes[hashPos++], ~prefixMin);
            bytes32 b =
                proofFlags[i] ? (leafPos < leavesLen ? leaves[leafPos++] : hashes[hashPos++]) : proof[proofPos++];
            hashes[i] = _hashPair(a, b, prefix);
        }

        if (totalHashes > 0) {
            if (proofPos != proof.length) {
                revert MerkleProofInvalidMultiproof();
            }
            unchecked {
                return hashes[totalHashes - 1];
            }
        } else if (leavesLen > 0) {
            return leaves[0];
        } else {
            return proof[0];
        }
    }

    function _hashPair(bytes32 a, bytes32 b, bytes1 prefix) private pure returns (bytes32 outputHash) {
        assembly ("memory-safe") {
            let scratch := mload(0x40)

            mstore(scratch, prefix)

            switch lt(a, b)
            case 1 {
                mstore(add(scratch, 0x01), a)
                mstore(add(scratch, 0x21), b)
            }
            case 0 {
                mstore(add(scratch, 0x01), b)
                mstore(add(scratch, 0x21), a)
            }

            outputHash := keccak256(scratch, 65)
        }
    }

    error MerkleProofInvalidMultiproof();
}
