//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

interface ICommon {
    struct ValidatorSetArgs {
        bytes32[] validatorSet;
        uint256 nonce;
    }

    struct Signature {
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

    struct ChainTransfer {
        uint256 amount;
        address from;
        string to;
    }

    struct Erc20Transfer {
        bytes32 dataDigest;
        uint256 amount;
        address from;
        address to;
    }

    struct RelayProof {
        Erc20Transfer[] transfers;
        bytes32 poolRoot;
        bytes32[] proof;
        bool[] proofFlags;
        uint256 batchNonce;
        string relayerAddress;
    }
}
