//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.15;

contract Test {

    function getNumberHash(uint data) external pure returns (bytes32) {
        bytes memory abiEncoded = abi.encodePacked(data);
        bytes32 messageDigest = keccak256(abiEncoded);
        
        return messageDigest;
    }

    function getListHash(uint[] calldata data) external pure returns (bytes32) {
        bytes memory abiEncoded = abi.encodePacked(data);
        bytes32 messageDigest = keccak256(abiEncoded);
        
        return messageDigest;
    }
}
