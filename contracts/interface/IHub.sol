//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.14;

interface IHub {
    function upgradeContract(string memory name, address addr) external;

    function addContract(string memory name, address addr) external;

    function getContract(string memory name) external view returns (address);
}
