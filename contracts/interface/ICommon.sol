//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

interface ICommon {

    struct ValidatorSetArgs {
        address[] validators;
        uint[] powers;
        uint nonce;
    }

    struct Signature {
        bytes32 r;
        bytes32 s;
        uint8 v;
    }

}
