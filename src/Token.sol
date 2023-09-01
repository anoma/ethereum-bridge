//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Token is ERC20 {
    uint256 private constant MAX_UINT = 2 ** 256 - 1;

    constructor(address _vaultAddress, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        _mint(_vaultAddress, MAX_UINT);
    }
}
