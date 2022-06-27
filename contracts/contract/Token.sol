//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.15;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address bridgeAddress
    ) ERC20(name, symbol) {
        _mint(bridgeAddress, initialSupply);
    }
}
