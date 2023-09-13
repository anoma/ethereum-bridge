//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// This token can be easily made and used for testing transfers over the Ethereum bridge
contract TestERC20 is ERC20, Ownable {
    constructor() ERC20("TestERC20", "TE20") { }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}
