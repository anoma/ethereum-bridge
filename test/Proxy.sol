//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "src/Proxy.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";

contract TestProxy is Test {
    Proxy proxy;
    address owner = vm.addr(1);

    function setUp() public {
        vm.prank(owner);
        proxy = new Proxy();
    }

    function test_OwnerCanCallBeforeContractInit() public {
        vm.startPrank(owner);
        address addr = vm.addr(2);
        proxy.addContract("new_contract", addr);
        address saved = proxy.getContract("new_contract");
        assertEq(addr, saved);
        vm.stopPrank();
    }

    function test_NonOwnerCantCallContractBeforeInit() public {
        vm.expectRevert("Caller is not owner.");
        address addr = vm.addr(3);
        proxy.addContract("new_contract", addr);
    }

    function test_emptyContractNameIsZeroAddress() public {
        vm.startPrank(owner);
        address saved = proxy.getContract("new_contract");
        assertEq(saved, address(0));
        vm.stopPrank();
    }

    function test_ownerNotAllowedAfterInit() public {
        vm.startPrank(owner);
        proxy.addContract("bridge", vm.addr(2));
        proxy.completeContractInit();
        vm.expectRevert("Invalid caller address.");
        proxy.addContract("new_contract_2", vm.addr(3));
        vm.stopPrank();
    }

    function test_zeroAddressNotAllowed() public {
        vm.startPrank(owner);
        vm.expectRevert("Invalid contract address.");
        proxy.addContract("bridge", address(0));
        vm.stopPrank();
    }

    function test_duplicateContractIsNotAllowed() public {
        vm.startPrank(owner);
        proxy.addContract("bridge", vm.addr(2));
        vm.expectRevert("Contract name already exist.");
        proxy.addContract("bridge", vm.addr(2));
        vm.expectRevert("Invalid duplicate address.");
        proxy.addContract("bridge_same_address", vm.addr(2));
        vm.stopPrank();
    }

    function test_upgradeContractOnlyIfProxyIsInit() public {
        vm.startPrank(owner);
        address bridgeAddress = vm.addr(2);
        proxy.addContract("bridge", bridgeAddress);
        address saved = proxy.getContract("bridge");
        assertEq(bridgeAddress, saved);
        address newBridgeAddress = vm.addr(2);
        vm.expectRevert("Proxy must be initialized.");
        proxy.upgradeContract("bridge", newBridgeAddress);
        saved = proxy.getContract("bridge");
        assertEq(newBridgeAddress, saved);
        vm.stopPrank();
    }

    function test_initProxyConditions() public {
        vm.expectRevert("Must be called by owner.");
        proxy.completeContractInit();
        vm.startPrank(owner);
        vm.expectRevert("Bridge contract must exist.");
        proxy.completeContractInit();
        address bridgeAddress = vm.addr(2);
        proxy.addContract("bridge", bridgeAddress);
        address saved = proxy.getContract("bridge");
        assertEq(bridgeAddress, saved);
        proxy.completeContractInit();
        vm.stopPrank();
    }

    function test_upgradeContract() public {
        vm.startPrank(owner);
        address bridgeAddress = vm.addr(2);
        proxy.addContract("bridge", bridgeAddress);
        address saved = proxy.getContract("bridge");
        assertEq(bridgeAddress, saved);
        proxy.completeContractInit();
        vm.stopPrank();
        vm.startPrank(bridgeAddress);
        vm.expectRevert("Address must be different.");
        proxy.upgradeContract("bridge", bridgeAddress);
        vm.expectRevert("Invalid address.");
        proxy.upgradeContract("bridge", address(0));
        vm.expectRevert("Invalid contract.");
        proxy.upgradeContract("not_exist", vm.addr(3));
        address newBridgeAddress = vm.addr(3);
        proxy.upgradeContract("bridge", newBridgeAddress);
        saved = proxy.getContract("bridge");
        assertEq(newBridgeAddress, saved);
        vm.stopPrank();
    }
}
