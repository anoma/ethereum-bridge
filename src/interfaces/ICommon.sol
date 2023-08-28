//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

interface ICommon {
    struct ValidatorSetArgs {
        bytes32 validatorSet;
        uint256 nonce;
    }

    struct Signature {
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    struct ChainTransfer {
        address from;
        uint256 amount;
        string to;
    }

    enum Erc20TransferKind {
        ERC20,
        NUT
    }

    struct Erc20Transfer {
        address from;
        address to;
        uint256 amount;
    }

    struct Erc20TransferInfo {
        Erc20TransferKind kind;
        string feeFrom;
        uint256 fee;
        string sender;
    }

    struct RelayProof {
        ValidatorSetArgs validatorSetArgs;
        Signature[] signatures;
        Erc20Transfer[] transfers;
        Erc20TransferInfo[] transfersInfo;
        bytes32 poolRoot;
        bytes32[] proof;
        bool[] proofFlags;
        uint256 batchNonce;
        string relayerAddress;
    }
}