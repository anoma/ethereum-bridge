//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.21;

import "src/Proxy.sol";
import "src/Vault.sol";
import "src/Token.sol";
import "src/Bridge.sol";
import "src/interfaces/ICommon.sol";
import "forge-std/Test.sol";
import "forge-std/console.sol";
import { FoundryRandom } from "foundry-random/FoundryRandom.sol";

contract TestBridge is Test, ICommon, FoundryRandom {
    IProxy proxy;
    IVault vault;
    Token token;
    Bridge bridge;

    uint96 MAX_UINT96 = type(uint96).max;
    uint8 MAX_UINT8 = type(uint8).max;
    uint32 MAX_UINT16 = type(uint16).max;
    uint96 VOTING_POWER_THRESHOLD = 52818775009509558395695966890;

    bytes32[] bridgeValidatorSet;
    bytes32[] governanceValidatorSet;

    address[] tokenOwners = new address[](3);

    function setUp() public {
        bytes32[] memory _bridgeValidatorSet = _createValidatorSet(10, MAX_UINT96);
        bytes32[] memory _governanceValidatorSet = _createValidatorSet(10, MAX_UINT96);

        proxy = new Proxy();
        bridge = new Bridge(1, _bridgeValidatorSet, _bridgeValidatorSet, _governanceValidatorSet, _governanceValidatorSet, proxy);
        vault = new Vault(proxy);

        address vaultAddress = address(vault);
        address bridgeAddress = address(bridge);

        proxy.addContract("bridge", address(bridge));
        proxy.addContract("vault", vaultAddress);
        proxy.completeContractInit();

        token = new Token(vaultAddress, "Namada", "NAM");

        tokenOwners[0] = vm.addr(500);
        tokenOwners[1] = vm.addr(501);
        tokenOwners[2] = vm.addr(502);

        vm.prank(vaultAddress);
        token.transfer(tokenOwners[0], 11 ether);
        vm.prank(vaultAddress);
        token.transfer(tokenOwners[1], 11 ether);
        vm.prank(vaultAddress);
        token.transfer(tokenOwners[2], 11 ether);

        vm.startPrank(tokenOwners[0]);
        token.approve(tokenOwners[0], 20 ether);
        token.approve(bridgeAddress, 20 ether);
        vm.stopPrank();
        vm.startPrank(tokenOwners[1]);
        token.approve(tokenOwners[1], 20 ether);
        token.approve(bridgeAddress, 20 ether);
        vm.stopPrank();
        vm.startPrank(tokenOwners[2]);
        token.approve(tokenOwners[2], 20 ether);
        token.approve(bridgeAddress, 20 ether);
        vm.stopPrank();


        bridgeValidatorSet = _bridgeValidatorSet;
        governanceValidatorSet = _governanceValidatorSet;
    }

    function test_initBridgeContract(uint16 total) public {
        vm.assume(total > 1);
        vm.assume(total < 256);

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT96);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT96);

        bridge = new Bridge(1, cValidatorSet, nValidatorSet, cValidatorSet, nValidatorSet, proxy);

        assertEq(bridge.currentBridgeValidatorSetHash(), _computeValidatorSetHash(1, "bridge", cValidatorSet, 2 ** 256 - 1));
        assertEq(bridge.currentGovernanceValidatorSetHash(), _computeValidatorSetHash(1, "governance", cValidatorSet, 2 ** 256 - 1));

        assertEq(bridge.nextBridgeValidatorSetHash(), _computeValidatorSetHash(1, "bridge", nValidatorSet, 0));
        assertEq(bridge.nextGovernanceValidatorSetHash(), _computeValidatorSetHash(1, "governance", nValidatorSet, 0));
    }

    function test_initBridgeContractInvalidVotingPower(uint16 total) public {
        vm.assume(total > 1);
        vm.assume(total < 256);

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT16);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT16);

        vm.expectRevert("Invalid voting power threshold.");
        new Bridge(
            1,
            cValidatorSet,
            nValidatorSet,
            cValidatorSet,
            nValidatorSet,
            proxy
        );
    }

    function test_updateValidatorSetInvalidPreconditions(uint16 total) public {
        vm.assume(total > 1);
        vm.assume(total < 256);

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT96);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT96);

        bytes32 nextBridgeValidatorSet = _computeValidatorSetHash(1, "bridge", cValidatorSet, 1);
        bytes32 nextGovernanceValidatorSet = _computeValidatorSetHash(1, "governance", nValidatorSet, 1);

        bytes32 message = keccak256(
            abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1)
        );

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 1);        

        vm.expectRevert("Invalid currentValidatorSetHash.");
        bridge.updateValidatorSet(
            validatorSetArgs,
            nextBridgeValidatorSet,
            nextGovernanceValidatorSet,
            signatures
        );

        Signature[] memory wrongNumberOfSignatures = new Signature[](bridgeValidatorSet.length - 1);

        vm.expectRevert("Malformed input.");
        bridge.updateValidatorSet(
            validatorSetArgs,
            nextBridgeValidatorSet,
            nextGovernanceValidatorSet,
            wrongNumberOfSignatures
        );

        assertEq(bridge.validatorSetNonce(), 0);
    }

    function test_updateValidatorSetInvalidSignatures(uint16 total) public {
        vm.assume(total > 1);
        vm.assume(total < 256);

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT96);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT96);

        bytes32 nextBridgeValidatorSet = _computeValidatorSetHash(1, "bridge", cValidatorSet, 1);
        bytes32 nextGovernanceValidatorSet = _computeValidatorSetHash(1, "governance", nValidatorSet, 1);

        bytes32 message = keccak256(
            abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1)
        );

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 0);        

        vm.expectRevert("Unauthorized.");
        bridge.updateValidatorSet(
            validatorSetArgs,
            nextBridgeValidatorSet,
            nextGovernanceValidatorSet,
            signatures
        );

        assertEq(bridge.validatorSetNonce(), 0);
    }

    function test_updateValidatorSet(uint16 total) public {
        vm.assume(total > 1);
        vm.assume(total < 256);

        bytes32 bridgeCheckSetHash = bridge.nextBridgeValidatorSetHash();
        bytes32 governaneCheckSetHash = bridge.nextGovernanceValidatorSetHash();

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT96);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT96);

        bytes32 nextBridgeValidatorSet = _computeValidatorSetHash(1, "bridge", cValidatorSet, 1);
        bytes32 nextGovernanceValidatorSet = _computeValidatorSetHash(1, "governance", nValidatorSet, 1);

        bytes32 message = keccak256(
            abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1)
        );

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 0);        

        bridge.updateValidatorSet(
            validatorSetArgs,
            nextBridgeValidatorSet,
            nextGovernanceValidatorSet,
            signatures
        );

        assertEq(bridge.currentBridgeValidatorSetHash(), bridgeCheckSetHash);
        assertEq(bridge.currentGovernanceValidatorSetHash(), governaneCheckSetHash);
        assertEq(bridge.validatorSetNonce(), 1);
    }

    function test_withdraw() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);
        
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(
            abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        bridge.withdraw(
            validatorSetArgs,
            transfers,
            signatures,
            1
        );

        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_withdrawInvalidPreconditions() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);
        
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(
            abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length - 1);
        for (uint256 i = 0; i < governanceValidatorSet.length - 1; i++) {
            signatures[i] = _signMessage(i, message);
        }
        
        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        vm.expectRevert("Invalid nonce.");
        bridge.withdraw(
            validatorSetArgs,
            transfers,
            signatures,
            3
        );

        vm.expectRevert("Malformed input.");
        bridge.withdraw(
            validatorSetArgs,
            transfers,
            signatures,
            1
        );
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_withdrawInvalidValidatorSet() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);
        
        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(
            abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }
        
        ValidatorSetArgs memory invalidValidatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 1);        

        vm.expectRevert("Invalid currentValidatorSetHash.");
        bridge.withdraw(
            invalidValidatorSetArgs,
            transfers,
            signatures,
            1
        );

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        vm.expectRevert("Unauthorized.");
        bridge.withdraw(
            validatorSetArgs,
            transfers,
            signatures,
            1
        );
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_upgrade() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(
            abi.encode(1, "upgrade", governanceValidatorSet, to, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        bridge.upgrade(
            validatorSetArgs,
            signatures,
            to,
            1
        );

        assertEq(proxy.getContract("bridge"), to);
    }

    function test_upgradeInvalidPreconditions() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(
            abi.encode(1, "upgrade", governanceValidatorSet, to, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length - 1);
        for (uint256 i = 0; i < governanceValidatorSet.length - 1; i++) {
            signatures[i] = _signMessage(i, message);
        }
        
        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        vm.expectRevert("Invalid nonce.");
        bridge.upgrade(
            validatorSetArgs,
            signatures,
            to,
            3
        );

        vm.expectRevert("Malformed input.");
        bridge.upgrade(
            validatorSetArgs,
            signatures,
            to,
            1
        );
        assertEq(proxy.getContract("bridge"), address(bridge));
    }

    function test_upgradeInvalidValidatorSet() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(
            abi.encode(1, "upgrade", governanceValidatorSet, to, 1)
        );

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }
        
        ValidatorSetArgs memory invalidValidatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 1);        

        vm.expectRevert("Invalid currentValidatorSetHash.");
        bridge.upgrade(
            invalidValidatorSetArgs,
            signatures,
            to,
            1
        );

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);        

        vm.expectRevert("Unauthorized.");
        bridge.upgrade(
            validatorSetArgs,
            signatures,
            to,
            1
        );
        assertEq(proxy.getContract("bridge"), address(bridge));
    }

    function test_transferToChain(uint256 amount) public {
        vm.assume(amount < 5 ether);
        vm.assume(amount > 0 ether);

        for (uint256 i = 0; i < tokenOwners.length; i++) {
            address from = tokenOwners[i];
            address tokenAddress = address(token);

            assertEq(token.balanceOf(from), 11 ether);

            ChainTransfer[] memory transfers = new ChainTransfer[](2);
            transfers[0] = ChainTransfer(amount, tokenAddress, "anamadaaddress");
            transfers[1] = ChainTransfer((11 ether) - amount, tokenAddress, "anothernamadaaddress");

            vm.prank(from);
            bridge.transferToChain(transfers, 10);

            assertEq(token.balanceOf(from), 0);
            assertEq(bridge.transferToChainNonce(), i + 1);
        }
    }

    function test_transferToChainInvalidNotEnoughBalance(uint256 amount) public {
        vm.assume(amount > 0 ether);
        vm.assume(amount < 11 ether);

        for (uint256 i = 0; i < tokenOwners.length; i++) {
            address from = tokenOwners[i];
            address tokenAddress = address(token);

            assertEq(token.balanceOf(from), 11 ether);

            ChainTransfer[] memory transfers = new ChainTransfer[](2);
            transfers[0] = ChainTransfer(amount, tokenAddress, "anamadaaddress");
            transfers[1] = ChainTransfer(11 ether, tokenAddress, "anothernamadaaddress");

            vm.prank(from);
            vm.expectRevert("ERC20: transfer amount exceeds balance");
            bridge.transferToChain(transfers, 10);

            assertEq(token.balanceOf(from), 11 ether);
            assertEq(bridge.transferToChainNonce(), 0);
        }
    }

    function test_decodeValidatorDataFromBytes32(address addr, uint96 vp) public {
        vm.assume(addr != 0x7109709ECfa91a80626fF3989D68f67F5b1DD12D);

        bytes32 a = bytes20(addr);
        bytes32 b = bytes12(vp);

        bytes32 encodedValidator = (b >> 160) | a;
        
        uint96 decodedVotingPower = _getVotingPowerFromEncodedValidator(encodedValidator);
        address decodedAddress = _getAddressFromEncodedValidator(encodedValidator);
        
        assertEq(decodedVotingPower, vp);
        assertEq(decodedAddress, addr);
    }

    // same as bridge._getVotingPower(bytes32)
    // its internal so we can't call it from here
    function _getVotingPowerFromEncodedValidator(bytes32 validator) internal pure returns(uint96) {
        bytes12 x;
        assembly {
            x := shl(160, validator)
        }
        return uint96(x);
    }

    // same as bridge._getAddress(bytes32)
    // its internal so we can't call it from here
    function _getAddressFromEncodedValidator(bytes32 validator) internal pure returns(address) {
        return address(bytes20(validator));
    }

    function _createValidatorSet(
        uint256 total,
        uint96 maxVotingPower
    ) internal returns (bytes32[] memory) {
        uint96[] memory votingPowers = new uint96[](total);

        uint96 totalVotingPower = 0;

        for (uint256 i = 0; i < total; i++) {
            uint96 votingPower = uint96(randomNumber(1, maxVotingPower / 256));
            totalVotingPower += votingPower;
            votingPowers[i] = votingPower;
        }

        uint96[] memory normalizedVotingPowers = _normalizeVotingPower(votingPowers, maxVotingPower, totalVotingPower);
        uint256 sumNormalizedVotingPower = 0;
        bytes32[] memory validatorSet = new bytes32[](total);

        for (uint256 i = 0; i < total; i++) {     
            validatorSet[i] = _createValidatorFromVotingPower(i, normalizedVotingPowers[i]);
            assertEq(_getVotingPowerFromEncodedValidator(validatorSet[i]), normalizedVotingPowers[i], "Mismatched encoded voting power.");
            assertEq(_getAddressFromEncodedValidator(validatorSet[i]), vm.addr(i + 1), "Mismatched encoded address.");
            sumNormalizedVotingPower += normalizedVotingPowers[i];
        }
        return validatorSet;
    }

    function _createValidatorFromVotingPower(uint256 index, uint96 votingPower) internal pure returns (bytes32) {
        // +1 is needed because index can't be 0
        bytes32 validatorAddress = bytes20(vm.addr(index + 1));
        bytes32 validatorVotingPower = bytes12(votingPower);

        bytes32 encodedValidator = (validatorVotingPower >> 160) | validatorAddress;

        return encodedValidator;
    }

    function _signMessage(uint256 privateKey, bytes32 _message) internal pure returns (Signature memory) {
        bytes32 messageDigest = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", _message));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey + 1, messageDigest);
        return Signature(r, s, v);
    }

    function _makeValidatorSetArgs(
        bytes32[] memory validatorSet,
        uint256 nonce
    ) internal pure returns (ValidatorSetArgs memory) {
        return ValidatorSetArgs(validatorSet, nonce);
    }

    function _computeValidatorSetHash(
        uint8 version,
        string memory namespace,
        bytes32[] memory validatorSet,
        uint256 nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(version, namespace, validatorSet, nonce));
    }

    function _normalizeVotingPower(
        uint96[] memory votingPowers,
        uint96 maxVotingPower,
        uint96 totalVotingPower
    ) internal pure returns(uint96[] memory) {
        uint96[] memory normalizedVotingPowers = new uint96[](votingPowers.length);
        uint256 debug = 0;

        for (uint256 i = 0; i < votingPowers.length; i++) {
            uint96 normalizedVotingPower = (maxVotingPower / totalVotingPower) * votingPowers[i];
            debug += normalizedVotingPower;
            normalizedVotingPowers[i] = normalizedVotingPower;
        }

        return normalizedVotingPowers;
    }
}
