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
import "@openzeppelin/contracts/utils/math/Math.sol";

contract TestBridge is Test, ICommon, FoundryRandom {
    IProxy proxy;
    IVault vault;
    Token token;
    Bridge bridge;

    uint96 MAX_UINT96 = type(uint96).max;
    uint8 MAX_UINT8 = type(uint8).max;
    uint32 MAX_UINT16 = type(uint16).max;
    uint96 VOTING_POWER_THRESHOLD = 52_818_775_009_509_558_395_695_966_890;

    bytes32[] bridgeValidatorSet;
    bytes32[] governanceValidatorSet;

    address[] tokenOwners = new address[](3);

    function setUp() public {
        bytes32[] memory _bridgeValidatorSet = _createValidatorSet(120, MAX_UINT96);
        bytes32[] memory _governanceValidatorSet = _createValidatorSet(120, MAX_UINT96);

        proxy = new Proxy();
        bridge =
        new Bridge(1, _bridgeValidatorSet, _bridgeValidatorSet, _governanceValidatorSet, _governanceValidatorSet, proxy);
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

        assertEq(
            bridge.currentBridgeValidatorSetHash(), _computeValidatorSetHash(1, "bridge", cValidatorSet, 2 ** 256 - 1)
        );
        assertEq(
            bridge.currentGovernanceValidatorSetHash(),
            _computeValidatorSetHash(1, "governance", cValidatorSet, 2 ** 256 - 1)
        );

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

        bytes32 message =
            keccak256(abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1));

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 1);

        vm.expectRevert("Invalid validatorSetHash.");
        bridge.updateValidatorSet(validatorSetArgs, nextBridgeValidatorSet, nextGovernanceValidatorSet, signatures);

        Signature[] memory wrongNumberOfSignatures = new Signature[](bridgeValidatorSet.length - 1);

        vm.expectRevert("Malformed input.");
        bridge.updateValidatorSet(
            validatorSetArgs, nextBridgeValidatorSet, nextGovernanceValidatorSet, wrongNumberOfSignatures
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

        bytes32 message =
            keccak256(abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1));

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 0);

        vm.expectRevert("Unauthorized.");
        bridge.updateValidatorSet(validatorSetArgs, nextBridgeValidatorSet, nextGovernanceValidatorSet, signatures);

        assertEq(bridge.validatorSetNonce(), 0);
    }

    function test_updateValidatorSetValid(uint8 total) public {
        vm.assume(total > 60);
        vm.assume(total < 256);

        bytes32 bridgeCheckSetHash = bridge.nextBridgeValidatorSetHash();
        bytes32 governaneCheckSetHash = bridge.nextGovernanceValidatorSetHash();

        bytes32[] memory cValidatorSet = _createValidatorSet(total, MAX_UINT96);
        bytes32[] memory nValidatorSet = _createValidatorSet(total, MAX_UINT96);

        bytes32 nextBridgeValidatorSet = _computeValidatorSetHash(1, "bridge", cValidatorSet, 1);
        bytes32 nextGovernanceValidatorSet = _computeValidatorSetHash(1, "governance", nValidatorSet, 1);

        bytes32 message =
            keccak256(abi.encode(1, "updateValidatorSet", nextBridgeValidatorSet, nextGovernanceValidatorSet, 1));

        Signature[] memory signatures = new Signature[](bridgeValidatorSet.length);
        for (uint256 i = 0; i < bridgeValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 0);

        bridge.updateValidatorSet(validatorSetArgs, nextBridgeValidatorSet, nextGovernanceValidatorSet, signatures);

        assertEq(bridge.currentBridgeValidatorSetHash(), bridgeCheckSetHash);
        assertEq(bridge.currentGovernanceValidatorSetHash(), governaneCheckSetHash);
        assertEq(bridge.validatorSetNonce(), 1);
    }

    function test_withdrawValid() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);

        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        bridge.withdraw(validatorSetArgs, transfers, signatures, 1);

        assertEq(token.balanceOf(address(vault)), 0);
    }

    function test_withdrawInvalidPreconditions() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);

        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length - 1);
        for (uint256 i = 0; i < governanceValidatorSet.length - 1; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        vm.expectRevert("Invalid nonce.");
        bridge.withdraw(validatorSetArgs, transfers, signatures, 3);

        vm.expectRevert("Malformed input.");
        bridge.withdraw(validatorSetArgs, transfers, signatures, 1);
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_withdrawInvalidValidatorSet() public {
        uint256 amount = token.balanceOf(address(vault));
        address to = vm.addr(100);

        Erc20Transfer[] memory transfers = new Erc20Transfer[](1);
        transfers[0] = Erc20Transfer(bytes32(0), amount, address(token), to);

        bytes32 message = keccak256(abi.encode(1, "withdraw", governanceValidatorSet, transfers, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }

        ValidatorSetArgs memory invalidValidatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 1);

        vm.expectRevert("Invalid validatorSetHash.");
        bridge.withdraw(invalidValidatorSetArgs, transfers, signatures, 1);

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        vm.expectRevert("Unauthorized.");
        bridge.withdraw(validatorSetArgs, transfers, signatures, 1);
        assertEq(token.balanceOf(address(vault)), amount);
    }

    function test_upgrade() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(abi.encode(1, "upgrade", governanceValidatorSet, to, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        bridge.upgrade(validatorSetArgs, signatures, to, 1);

        assertEq(proxy.getContract("bridge"), to);
    }

    function test_upgradeInvalidPreconditions() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(abi.encode(1, "upgrade", governanceValidatorSet, to, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length - 1);
        for (uint256 i = 0; i < governanceValidatorSet.length - 1; i++) {
            signatures[i] = _signMessage(i, message);
        }

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        vm.expectRevert("Invalid nonce.");
        bridge.upgrade(validatorSetArgs, signatures, to, 3);

        vm.expectRevert("Malformed input.");
        bridge.upgrade(validatorSetArgs, signatures, to, 1);
        assertEq(proxy.getContract("bridge"), address(bridge));
    }

    function test_upgradeInvalidValidatorSet() public {
        address to = vm.addr(100);

        bytes32 message = keccak256(abi.encode(1, "upgrade", governanceValidatorSet, to, 1));

        Signature[] memory signatures = new Signature[](governanceValidatorSet.length);
        for (uint256 i = 0; i < governanceValidatorSet.length; i++) {
            signatures[i] = _signMessage(i, message);
            signatures[i].r = signatures[i].s;
        }

        ValidatorSetArgs memory invalidValidatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 1);

        vm.expectRevert("Invalid validatorSetHash.");
        bridge.upgrade(invalidValidatorSetArgs, signatures, to, 1);

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(governanceValidatorSet, 2 ** 256 - 1);

        vm.expectRevert("Unauthorized.");
        bridge.upgrade(validatorSetArgs, signatures, to, 1);
        assertEq(proxy.getContract("bridge"), address(bridge));
    }

    function test_transferToChain(uint256 amount) public {
        vm.assume(amount < 5 ether);
        vm.assume(amount > 0 ether);

        for (uint256 i = 0; i < tokenOwners.length; i++) {
            address from = tokenOwners[i];
            address tokenAddress = address(token);

            uint256 vaultAmount = token.balanceOf(address(vault));

            assertEq(token.balanceOf(from), 11 ether);

            ChainTransfer[] memory transfers = new ChainTransfer[](2);
            transfers[0] = ChainTransfer(amount, tokenAddress, "anamadaaddress");
            transfers[1] = ChainTransfer((11 ether) - amount, tokenAddress, "anothernamadaaddress");

            vm.prank(from);
            bridge.transferToChain(transfers, 10);

            assertEq(token.balanceOf(from), 0);
            assertEq(token.balanceOf(address(vault)), vaultAmount + 11 ether);
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

    function test_transferToErcValid(uint8 total, uint8 toProve) public {
        vm.assume(total > 10);
        vm.assume(total < 50);
        vm.assume(toProve <= total);
        vm.assume(toProve >= 1);

        uint256 vaultPreBalance = token.balanceOf(address(vault));

        (Erc20Transfer[] memory transfers, Erc20Transfer[] memory transfersToProve, uint256 toProveSum) =
            _createTransfers(total, toProve);
        (bytes32[] memory sortedTransferHashes,) = _computeSortedTransferHashes(transfers);
        (bytes32[] memory hashedTransfersToProve, uint256[] memory indexes) =
            _computeSortedTransferHashes(transfersToProve);

        Erc20Transfer[] memory transfersToProveSorted = _sortTransfersWithIndexes(transfers, indexes);

        bytes32 bridgePoolRoot = _computeRoot(sortedTransferHashes);

        (bytes32[] memory proofs, bool[] memory flags) =
            _computeTransfersProof(sortedTransferHashes, hashedTransfersToProve);

        bytes32 message = _computeTransferToErcMessage(bridgePoolRoot, 0);

        Signature[] memory signatures = _computeSignatures(bridgeValidatorSet.length, message);

        ValidatorSetArgs memory validatorSetArgs = _makeValidatorSetArgs(bridgeValidatorSet, 2 ** 256 - 1);

        RelayProof memory relayProof =
            RelayProof(transfersToProveSorted, bridgePoolRoot, proofs, flags, 0, "anamadaaddress");

        bridge.transferToErc(validatorSetArgs, signatures, relayProof);

        assertEq(vaultPreBalance - token.balanceOf(address(vault)), toProveSum);
        assertEq(bridge.transferToErc20Nonce(), 1);

        for (uint256 i = 0; i < transfersToProveSorted.length; i++) {
            assertEq(transfersToProveSorted[i].amount, token.balanceOf(transfersToProveSorted[i].to));
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

    function test_checkComputeRoot() public {
        bytes32 a = bytes32(0x54ab92b1648fc1f4299e531c745504e678ffa751f2e3a073e2f1d3bf0dd41652);
        bytes32 b = bytes32(0x5bf8f5bfb0a5e73bba2e350a9e712287e4e3b40ce260ac106a8280fd6c18beac);
        bytes32 c = bytes32(0xc862bf83972bfaa4715054114c4dd7c424d98158fce8d7b25491a2a4b256ddb8);

        bytes32 one = _hashPair(a, b, bytes1(0));
        bytes32 two = _hashPair(c, bytes32(0), bytes1(0));
        bytes32 three = _hashPair(one, two, ~bytes1(0));

        bytes32[] memory transfersHashes = new bytes32[](3);
        transfersHashes[0] = a;
        transfersHashes[1] = b;
        transfersHashes[2] = c;

        bytes32 testRoot = _computeRoot(transfersHashes);

        assertEq(testRoot, three);
    }

    // same as bridge._getVotingPower(bytes32)
    // its internal so we can't call it from here
    function _getVotingPowerFromEncodedValidator(bytes32 validator) internal pure returns (uint96) {
        bytes12 x;
        assembly {
            x := shl(160, validator)
        }
        return uint96(x);
    }

    // same as bridge._getAddress(bytes32)
    // its internal so we can't call it from here
    function _getAddressFromEncodedValidator(bytes32 validator) internal pure returns (address) {
        return address(bytes20(validator));
    }

    function _createValidatorSet(uint256 total, uint96 maxVotingPower) internal returns (bytes32[] memory) {
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
            assertEq(
                _getVotingPowerFromEncodedValidator(validatorSet[i]),
                normalizedVotingPowers[i],
                "Mismatched encoded voting power."
            );
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
    )
        internal
        pure
        returns (ValidatorSetArgs memory)
    {
        return ValidatorSetArgs(validatorSet, nonce);
    }

    function _computeValidatorSetHash(
        uint8 version,
        string memory namespace,
        bytes32[] memory validatorSet,
        uint256 nonce
    )
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(version, namespace, validatorSet, nonce));
    }

    function _normalizeVotingPower(
        uint96[] memory votingPowers,
        uint96 maxVotingPower,
        uint96 totalVotingPower
    )
        internal
        pure
        returns (uint96[] memory)
    {
        uint96[] memory normalizedVotingPowers = new uint96[](votingPowers.length);
        uint256 debug = 0;

        for (uint256 i = 0; i < votingPowers.length; i++) {
            uint96 normalizedVotingPower = (maxVotingPower / totalVotingPower) * votingPowers[i];
            debug += normalizedVotingPower;
            normalizedVotingPowers[i] = normalizedVotingPower;
        }

        return normalizedVotingPowers;
    }

    function _computeTransferToErcMessage(
        bytes32 poolRoot,
        uint256 nonce
    )
        internal
        pure
        returns (bytes32 signableHash)
    {
        assembly ("memory-safe") {
            let scratch := mload(0x40)

            mstore(scratch, poolRoot)
            mstore(add(scratch, 0x20), nonce)

            signableHash := keccak256(scratch, 64)
        }
    }

    function _computeTransferHash(Erc20Transfer memory transfer) internal pure returns (bytes32) {
        return keccak256(abi.encode(1, "transfer", transfer.from, transfer.to, transfer.amount, transfer.dataDigest));
    }

    function _sortTransfersWithIndexes(
        Erc20Transfer[] memory transfers,
        uint256[] memory indexes
    )
        internal
        pure
        returns (Erc20Transfer[] memory)
    {
        Erc20Transfer[] memory sortedTransfers = new Erc20Transfer[](indexes.length);
        for (uint256 i = 0; i < indexes.length; i++) {
            sortedTransfers[i] = Erc20Transfer(
                transfers[indexes[i]].dataDigest,
                transfers[indexes[i]].amount,
                transfers[indexes[i]].from,
                transfers[indexes[i]].to
            );
        }
        return sortedTransfers;
    }

    function _computeSignatures(uint256 totalSignatures, bytes32 message) internal pure returns (Signature[] memory) {
        Signature[] memory signatures = new Signature[](totalSignatures);
        for (uint256 i = 0; i < totalSignatures; i++) {
            signatures[i] = _signMessage(i, message);
        }
        return signatures;
    }

    function _createTransfers(
        uint256 total,
        uint256 toProve
    )
        internal
        returns (Erc20Transfer[] memory, Erc20Transfer[] memory, uint256 amount)
    {
        Erc20Transfer[] memory transfers = new Erc20Transfer[](total);
        Erc20Transfer[] memory transferToProve = new Erc20Transfer[](toProve);

        uint256 toProveAmountSum = 0;
        for (uint256 i = 0; i < transfers.length; i++) {
            uint256 transferAmount = randomNumber(1000);
            Erc20Transfer memory transfer =
                Erc20Transfer(randomBytes32(), transferAmount, address(token), vm.addr(i + 10_000));
            if (i < toProve) {
                transferToProve[i] = transfer;
                toProveAmountSum += transferAmount;
            }
            transfers[i] = transfer;
        }
        return (transfers, transferToProve, toProveAmountSum);
    }

    function _computeSortedTransferHashes(Erc20Transfer[] memory transfers)
        internal
        pure
        returns (bytes32[] memory, uint256[] memory)
    {
        bytes32[] memory hashes = new bytes32[](transfers.length);
        for (uint256 i = 0; i < transfers.length; i++) {
            hashes[i] = _computeTransferHash(transfers[i]);
        }
        (bytes32[] memory sortedHashedTransfers, uint256[] memory indexes) = _sort(hashes);

        return (sortedHashedTransfers, indexes);
    }

    function _sort(bytes32[] memory array) internal pure returns (bytes32[] memory, uint256[] memory) {
        uint256[] memory indexes = new uint256[](array.length);
        for (uint256 k = 0; k < indexes.length; k++) {
            indexes[k] = k;
        }

        uint256 i = 1;

        while (i < array.length) {
            uint256 j = i;
            while (j > 0 && array[j - 1] > array[j]) {
                bytes32 tmp = array[j];
                array[j] = array[j - 1];
                array[j - 1] = tmp;

                uint256 tmpIdx = indexes[j];
                indexes[j] = indexes[j - 1];
                indexes[j - 1] = tmpIdx;

                j -= 1;
            }
            i = i + 1;
        }
        return (array, indexes);
    }

    function _computeRoot(bytes32[] memory hashedLeaves) internal pure returns (bytes32) {
        bytes1 prefix = bytes1(0);

        while (hashedLeaves.length > 1) {
            bytes32[] memory nextHashes = new bytes32[](Math.ceilDiv(hashedLeaves.length, 2));

            uint256 i = 0;
            uint256 j = 0;

            while (i < hashedLeaves.length) {
                bytes32 left = hashedLeaves[i];
                bytes32 right = bytes32(0);

                if (i + 1 < hashedLeaves.length) {
                    right = hashedLeaves[i + 1];
                }

                nextHashes[j] = _hashPair(left, right, prefix);
                i += 2;
                j += 1;
            }
            prefix = ~bytes1(0);
            hashedLeaves = nextHashes;
        }
        if (hashedLeaves.length > 0) {
            return hashedLeaves[0];
        } else {
            return bytes32(0);
        }
    }

    // same as bridge._hashPair(bytes32 a, bytes32 b, bytes1 prefix)
    // its private so we can't call it from here
    function _hashPair(bytes32 a, bytes32 b, bytes1 prefix) private pure returns (bytes32 outputHash) {
        assembly ("memory-safe") {
            let scratch := mload(0x40)

            mstore(scratch, prefix)

            switch lt(a, b)
            case 1 {
                mstore(add(scratch, 0x01), a)
                mstore(add(scratch, 0x21), b)
            }
            case 0 {
                mstore(add(scratch, 0x01), b)
                mstore(add(scratch, 0x21), a)
            }

            outputHash := keccak256(scratch, 65)
        }
    }

    struct Node {
        bool onPath;
        bytes32 nodeHash;
    }

    function _computeTransfersProof(
        bytes32[] memory hashedLeaves,
        bytes32[] memory hashedTransfers
    )
        internal
        pure
        returns (bytes32[] memory, bool[] memory)
    {
        Node[] memory nodes = new Node[](hashedLeaves.length);
        for (uint256 i = 0; i < hashedLeaves.length; i++) {
            bool found = false;
            for (uint256 j = 0; j < hashedTransfers.length; j++) {
                if (hashedTransfers[j] == hashedLeaves[i]) {
                    found = true;
                    break;
                }
            }
            if (found) {
                nodes[i] = Node(true, hashedLeaves[i]);
            } else {
                nodes[i] = Node(false, hashedLeaves[i]);
            }
        }

        bytes32[] memory proofHashes = new bytes32[](hashedLeaves.length * 2 + 1);
        bool[] memory flags = new bool[](hashedLeaves.length * 2 + 1);

        uint256 flagPos = 0;
        uint256 proofHashesPos = 0;

        bytes1 prefix = bytes1(0);

        while (nodes.length > 1) {
            Node[] memory nextNodes = new Node[](Math.ceilDiv(nodes.length, 2));
            uint256 i = 0;
            uint256 nextNodesPos = 0;

            while (i < nodes.length) {
                Node memory left = nodes[i];
                Node memory right = Node(false, bytes32(0));

                if (i + 1 < nodes.length) {
                    right = nodes[i + 1];
                }

                bytes32 hashPair = _hashPair(left.nodeHash, right.nodeHash, prefix);

                if (left.onPath && right.onPath) {
                    flags[flagPos++] = true;
                    nextNodes[nextNodesPos++] = Node(true, hashPair);
                } else if (left.onPath && !right.onPath) {
                    flags[flagPos++] = false;
                    proofHashes[proofHashesPos++] = right.nodeHash;
                    nextNodes[nextNodesPos++] = Node(true, hashPair);
                } else if (!left.onPath && right.onPath) {
                    flags[flagPos++] = false;
                    proofHashes[proofHashesPos++] = left.nodeHash;
                    nextNodes[nextNodesPos++] = Node(true, hashPair);
                } else {
                    nextNodes[nextNodesPos++] = Node(false, hashPair);
                }

                i += 2;
            }
            prefix = ~bytes1(0);
            nodes = nextNodes;
        }

        if (flagPos == 0 && proofHashesPos == 0 && hashedTransfers.length == 0) {
            bytes32 root = _computeRoot(hashedLeaves);
            proofHashes[0] = root;
            proofHashesPos = 1;
        }

        bytes32[] memory proofHashesShrunken = new bytes32[](proofHashesPos);
        bool[] memory flagsShrunken = new bool[](flagPos);

        for (uint256 i = 0; i < proofHashesPos; i++) {
            proofHashesShrunken[i] = proofHashes[i];
        }

        for (uint256 i = 0; i < flagPos; i++) {
            flagsShrunken[i] = flags[i];
        }

        return (proofHashesShrunken, flagsShrunken);
    }

    function _logBytes32Array(bytes32[] memory array) internal view {
        for (uint256 i = 0; i < array.length; i++) {
            console.logBytes32(array[i]);
        }
    }

    function _logBoolArray(bool[] memory array) internal view {
        for (uint256 i = 0; i < array.length; i++) {
            console.logBool(array[i]);
        }
    }
}
