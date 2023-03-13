//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256[] memory initialSupplies,
        address[] memory addresses
    ) ERC20(name, symbol) {
        require(initialSupplies.length == addresses.length, "Invalid parameters.");

        for (uint256 i = 0; i < addresses.length; ++i) {
            _mint(addresses[i], initialSupplies[i]);
        }
    }
}
