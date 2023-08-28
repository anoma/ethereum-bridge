// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "src/Proxy.sol";
import "src/Vault.sol";
import "src/Token.sol";
import "src/interfaces/ICommon.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

contract TestVault is Test, ICommon {
    Proxy proxy;
    Vault vault;
    Token token;
    address bridgeAddress = vm.addr(1);

    function setUp() public {
        proxy = new Proxy();
        vault = new Vault(proxy);
        
        proxy.addContract("bridge", bridgeAddress);
        proxy.addContract("vault", address(vault));
        proxy.completeContractInit();

        token = new Token(address(vault), "namada", "NAM");
    }

    function test_vaultAddressIsSetCorrectly() public {
        address vaultAddressFromProxy = proxy.getContract("vault");
        address vaultAddress = address(vault);
        assertEq(vaultAddressFromProxy, vaultAddress);
    }

    function test_bridgeCanCallVault() public {
        vm.startPrank(bridgeAddress);
        address to = vm.addr(100);
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        Erc20Transfer memory transfer = Erc20Transfer(address(token), to, 10);
        transfers[0] = transfer;
        vault.batchTransferToErc20(transfers);
        vm.stopPrank();
    }

    function test_bridgeInvalidCaller() public {
        address to = vm.addr(100);
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        Erc20Transfer memory transfer = Erc20Transfer(address(token), to, 10);
        transfers[0] = transfer;
        vm.expectRevert("Invalid caller.");
        vault.batchTransferToErc20(transfers);
    }

    function test_bridgeInvalidToken() public {
        vm.startPrank(bridgeAddress);
        address to = vm.addr(100);
        address invalidToken = vm.addr(28);
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        Erc20Transfer memory transfer = Erc20Transfer(invalidToken, to, 10);
        transfers[0] = transfer;
        vm.expectRevert();
        vault.batchTransferToErc20(transfers);
        vm.stopPrank();
    }

}
