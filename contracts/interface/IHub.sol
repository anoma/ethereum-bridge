//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

interface IHub {

    function upgradeContract(string memory _name, address _address) external;
    function addContract(string memory _name, address _address) external;
    function getContract(string memory _name) external view returns(address);

}
