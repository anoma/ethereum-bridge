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

    function getTestHash() external pure returns (bytes32) {
        address[] memory addresses = new address[](0);
        uint256[] memory voting_power = new uint[](0);
        uint256 epoch = 0;
        bytes memory abiEncoded = abi.encode("bridge", addresses, voting_power, epoch);
        bytes32 messageDigest = keccak256(abiEncoded);
        
        return messageDigest;
    }
}
