// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/console.sol";
import "forge-std/Script.sol";
import "create/CREATE3Factory.sol";
import "../src/Bridge.sol";
import "../src/Proxy.sol";
import "../src/Vault.sol";
import "../src/TestERC20.sol";
import "../src/Token.sol";

struct ValidatorData {
    address addr;
    uint96 votingPower;
}

contract Deploy is Script {

    function run() external {
        vm.startBroadcast();

        bool deploy = vm.envOr("DEPLOY", false);
        address create3Address = vm.envAddress("CREATE_ADDRESS");

        string memory bridgeValidatorSetJson = vm.readFile(vm.envString("BRIDGE_VALSET_JSON"));
        string memory governanceValiatorSetJson = vm.readFile(vm.envString("GOVERNANCE_VALSET_JSON"));

        string memory nativeTokenName = vm.envString("NATIVE_TOKEN_NAME");
        string memory nativeTokenSymbol = vm.envString("NATIVE_TOKEN_SYMBOL");

        bytes memory bridgeData = vm.parseJson(bridgeValidatorSetJson, ".set");
        ValidatorData[] memory bridgeValidator = abi.decode(bridgeData, (ValidatorData[]));

        bytes32[] memory encodedBridgeValidators = _encodeValidators(bridgeValidator);

        bytes memory governanceData = vm.parseJson(governanceValiatorSetJson, ".set");
        ValidatorData[] memory governanceValidator = abi.decode(governanceData, (ValidatorData[]));

        bytes32[] memory encodedGovernanceValidators = _encodeValidators(governanceValidator);

        string memory mnemonic = vm.envString("MNEMONIC");
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        address deployerAddress = vm.addr(deployerPrivateKey);
        vm.rememberKey(deployerPrivateKey);

        CREATE3Factory factory = CREATE3Factory(create3Address);
        console.log("deployer    | %s", deployerAddress);

        if (deploy) {
            Proxy proxy = new Proxy();
            Vault vault = new Vault(proxy);

            address nativeTokenAddress = factory.deploy(
                "nativeTokenAddress-1",
                abi.encodePacked(
                    type(Token).creationCode, 
                    abi.encode(address(vault), nativeTokenName, nativeTokenSymbol)
                )
            );

            address bridgeAddress = factory.deploy(
                "bridge-1",
                abi.encodePacked(
                    type(Bridge).creationCode, 
                    abi.encode(1, encodedBridgeValidators, encodedBridgeValidators, encodedGovernanceValidators, encodedGovernanceValidators, proxy)
                )
            );

            proxy.addContract("vault", address(vault));
            proxy.addContract("bridge", bridgeAddress);
            proxy.completeContractInit();

            console.log("bridge       | %s", bridgeAddress);
            console.log("wnam         | %s", nativeTokenAddress);
            console.log("vault    | %s", address(vault));
            console.log("proxy    | %s", address(proxy));
        } else {
            address bridgeAddress = factory.getDeployed(deployerAddress, "bridge-1");
            address nativeTokenAddress = factory.getDeployed(deployerAddress, "nativeTokenAddress-1");
            address testErc20Address = factory.getDeployed(deployerAddress, "testerc20-1");

            console.log("bridge       | %s", bridgeAddress);
            console.log("wnam         | %s", nativeTokenAddress);
            console.log("testerc20    | %s", testErc20Address);
        }

        if (block.chainid == 31_337 || block.chainid == 11155111) {
            if (deploy) {
                TestERC20 testErc20 = new TestERC20();
                testErc20.mint(msg.sender, 10_000);
                console.log("testerc20    | %s", address(testErc20));
            } else {    
                address testErc20Address = factory.getDeployed(deployerAddress, "testerc20-1");
                console.log("testerc20    | %s", testErc20Address);
            }
        }

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
