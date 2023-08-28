//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.21;

import "src/Proxy.sol";
import "src/Vault.sol";
import "src/Token.sol";
import "src/Bridge.sol";
import "src/interfaces/ICommon.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";


contract TestBridge is Test, ICommon {
    Proxy proxy;
    Vault vault;
    Token token;
    Bridge bridge;

    address bridgeAddress = vm.addr(1);

    function setUp() public {

        bytes32[] memory cValidatorSet = _createValidatorSet(10);
        bytes32[] memory nValidatorSet = _createValidatorSet(10);

        proxy = new Proxy();
        bridge = new Bridge(1, cValidatorSet, nValidatorSet, cValidatorSet, nValidatorSet, uint256(30), proxy);
        vault = new Vault(proxy);
        
        proxy.addContract("bridge", address(bridge));
        proxy.addContract("vault", address(vault));
        proxy.completeContractInit();

        token = new Token(address(vault), "namada", "NAM");
    }

    function _createValidatorSet(uint256 total) internal returns(bytes32[] memory) {
        bytes32[] memory validatorSet = new bytes32[](total);
        for (uint i = 0; i < total; i++) {
            validatorSet[i] = _createValidator(total - i);
        }
        return validatorSet;
    }

    function _createValidator(uint256 index) internal pure returns(bytes32) {
        bytes32 validatorAddress = bytes20(vm.addr(index));
        bytes32 validatorVotingPower = bytes12(uint96(index));
        return (validatorVotingPower >> 160) | validatorAddress; 
    }

    function test_prova() public {
        assertEq(address(0), address(0));
    }

    // function test_getVotingPowerFromBytes32() public {
    //     bytes32 a = bytes20(vm.addr(2));
    //     bytes32 b = bytes12(uint96(111111));

    //     console.logBytes32(a);
    //     console.logBytes32(b);

    //     bytes32 y = (b>> 160) | a; 

    //     console.logBytes32(y);

    //     uint96 vp = bridge._getVotingPower(y);
    //     console.log(vp);
    //     assertEq(uint96(111111), vp);
    // }

    // function test_getAddressFromBytes32() public {
    //     bytes32 a = bytes20(vm.addr(2));
    //     bytes32 b = bytes12(uint96(111111));

    //     console.logBytes32(a);
    //     console.logBytes32(b);

    //     bytes32 y = (b>> 160) | a; 

    //     console.logBytes32(y);

    //     address vp = bridge._getAddress(y);
    //     console.log(vp);
    //     assertEq(vm.addr(2), vp);
    // }
}