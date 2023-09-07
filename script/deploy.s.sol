// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../src/Bridge.sol";
import "../src/Proxy.sol";
import "../src/Vault.sol";

struct ValidatorData {
    address addr;
    uint96 votingPower;
}

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        string memory bridgeValidatorSetJson = vm.readFile("script/bridge_validator_set.json");
        string memory governanceValiatorSetJson = vm.readFile("script/governance_validator_set.json");

        bytes memory bridgeData = vm.parseJson(bridgeValidatorSetJson, ".set");
        ValidatorData[] memory bridgeValidator = abi.decode(bridgeData, (ValidatorData[]));

        bytes32[] memory encodedBridgeValidators = _encodeValidators(bridgeValidator);

        bytes memory governanceData = vm.parseJson(governanceValiatorSetJson, ".set");
        ValidatorData[] memory governanceValidator = abi.decode(governanceData, (ValidatorData[]));

        bytes32[] memory encodedGovernanceValidators = _encodeValidators(governanceValidator);

        string memory mnemonic = vm.envString("MNEMONIC");
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        vm.rememberKey(deployerPrivateKey);

        Proxy proxy = new Proxy();
        Vault vault = new Vault(proxy);
        Bridge bridge =
        new Bridge(1, encodedBridgeValidators, encodedBridgeValidators, encodedGovernanceValidators, encodedGovernanceValidators, proxy);

        vm.stopBroadcast();
    }

    function _encodeValidators(ValidatorData[] memory validators) internal pure returns (bytes32[] memory) {
        bytes32[] memory encodedValidators = new bytes32[](validators.length);
        for (uint256 i = 0; i < validators.length; i++) {
            bytes32 a = bytes20(validators[i].addr);
            bytes32 b = bytes12(validators[i].votingPower);

            encodedValidators[i] = (b >> 160) | a;
        }
        return encodedValidators;
    }
}