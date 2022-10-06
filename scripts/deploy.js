const prompt = require('prompt');
const { ethers } = require("hardhat");
const hre = require("hardhat");
const fs = require('fs')
const assert = require('assert');

async function main() {
    console.log(`Running on network ${hre.network.name} with chain-id ${hre.network.config.chainId}`)
    const { correctNetwork } = await prompt.get([{
        name: 'correctNetwork',
        required: true,
        description: "Is the network correct?",
        type: 'boolean'
    }])

    if (!correctNetwork) {
        return;
    }

    const { brideValidatorSetPath } = await prompt.get([{
        name: 'brideValidatorSetPath',
        required: true,
        description: "Full path to bridge validator set json file",
        type: 'string'
    }])

    const { nextBridgeValidatorSetPath } = await prompt.get([{
        name: 'nextBridgeValidatorSetPath',
        required: true,
        description: "Full path to next bridge validator set json file",
        type: 'string'
    }])

    const { governanceValidatorSetPath } = await prompt.get([{
        name: 'governanceValidatorSetPath',
        required: true,
        description: "Full path to governance validator set json file",
        type: 'string'
    }])

    if (!isValidJsonFile(brideValidatorSetPath) || !isValidJsonFile(nextBridgeValidatorSetPath) || !isValidJsonFile(governanceValidatorSetPath)) {
        return;
    }

    if (!isValidValidatorSet(brideValidatorSetPath) || !isValidValidatorSet(nextBridgeValidatorSetPath) | !isValidValidatorSet(governanceValidatorSetPath)) {
        return
    }

    const { wnamTokenSupply } = await prompt.get([{
        name: 'wnamTokenSupply',
        required: true,
        description: "Total wrapped NAM ERC20 token supply",
        type: 'number'
    }])

    const [deployer] = await ethers.getSigners();
    const deployerBalance = await deployer.getBalance();

    console.log(`Using ${deployer.address} as deploy address with ${deployerBalance} balance.`)
    const { correctSigner } = await prompt.get([{
        name: 'correctSigner',
        required: true,
        description: "Is the signer address correct?",
        type: 'boolean'
    }])

    if (!correctSigner) {
        return;
    }

    const { tokenWhitelistPrompt } = await prompt.get([{
        name: 'tokenWhitelistPrompt',
        required: false,
        description: "Whitelisted token addresses, comma separated (not including wNAM)",
        type: 'string',
        default: ''
    }])

    const { tokenCapsPrompt } = await prompt.get([{
        name: 'tokenCapsPrompt',
        required: false,
        description: "Whitelisted token caps, comma separated (not including wNAM)",
        type: 'string',
        default: ''
    }])

    // bridge constructors parameters
    const bridgeValidatorSetContent = fs.readFileSync(brideValidatorSetPath)
    const bridgeValidatorSet = JSON.parse(bridgeValidatorSetContent)

    const bridgeValidators = Object.keys(bridgeValidatorSet)
    const bridgeVotingPowers = Object.values(bridgeValidatorSet)
    const bridgeVotingPowerThreshold = computeThreshold(bridgeVotingPowers)

    // next bridge contructor parameters
    const nextBridgeValidatorSetContent = fs.readFileSync(nextBridgeValidatorSetPath)
    const nextBridgeValidatorSet = JSON.parse(nextBridgeValidatorSetContent)

    const nextBridgeValidators = Object.keys(nextBridgeValidatorSet)
    const nextBridgeVotingPowers = Object.values(nextBridgeValidatorSet)
    const nextBridgeVotingPowerThreshold = computeThreshold(nextBridgeVotingPowers)

    assert(nextBridgeVotingPowerThreshold > bridgeVotingPowerThreshold - 10)
    assert(nextBridgeVotingPowerThreshold < bridgeVotingPowerThreshold + 10)

    // governance constroctor parameters
    const governanceValidatorSetContent = fs.readFileSync(governanceValidatorSetPath)
    const governanceValidatorSet = JSON.parse(governanceValidatorSetContent)

    const governanceValidators = Object.keys(governanceValidatorSet)
    const governanceVotingPowers = Object.values(governanceValidatorSet)
    const governanceVotingPowerThreshold = computeThreshold(governanceVotingPowers)

    assert(governanceVotingPowerThreshold > bridgeVotingPowerThreshold - 10)
    assert(governanceVotingPowerThreshold < bridgeVotingPowerThreshold + 10)

    const Proxy = await ethers.getContractFactory("Proxy");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");
    const Vault = await ethers.getContractFactory("Vault");
    const Token = await ethers.getContractFactory("Token");

    const proxy = await Proxy.deploy();
    await proxy.deployed();

    const vault = await Vault.deploy(proxy.address);
    await vault.deployed();

    const wnamToken = await Token.deploy("Wrapper Namada", "WNAM", [wnamTokenSupply], [vault.address]);
    await wnamToken.deployed();

    const tokenWhitelist = tokenWhitelistPrompt.length == 0 ? [wnamToken.address] : tokenWhitelistPrompt.split(',').map(token => token.trim()).concat(wnamToken.address)
    const tokenCaps = tokenCapsPrompt.length == 0 ? [wnamTokenSupply] : tokenCapsPrompt.split(',').map(cap => parseInt(cap)).concat(wnamTokenSupply)

    const bridge = await Bridge.deploy(1, bridgeValidators, bridgeVotingPowers, nextBridgeValidators, nextBridgeVotingPowers, tokenWhitelist, tokenCaps, bridgeVotingPowerThreshold, proxy.address);
    await bridge.deployed();

    const governance = await Governance.deploy(1, governanceValidators, governanceVotingPowers, governanceVotingPowerThreshold, proxy.address);
    await governance.deployed()

    await proxy.addContract("governance", governance.address);
    await proxy.addContract("bridge", bridge.address);
    await proxy.addContract("vault", vault.address);

    await proxy.completeContractInit();

    console.log("")
    console.log(`Proxy address: ${proxy.address}`)
    console.log(`Governance address: ${governance.address}`)
    console.log(`Bridge address: ${bridge.address}`)
    console.log(`Token address: ${wnamToken.address}`)
    console.log("")

    await writeState(proxy.address, governance.address, bridge.address, wnamToken.address, hre.network.name, hre.network.config.chainId)

    await etherscan(proxy.address, [], hre.network.name);
    await etherscan(governance.address, [1, governanceValidators, governanceVotingPowers, governanceVotingPowerThreshold, proxy.address], hre.network.name);
    await etherscan(bridge.address, [1, bridgeValidators, bridgeVotingPowers, bridgeVotingPowerThreshold, proxy.address], hre.network.name);
    await etherscan(wnamToken.address, ["Wrapper Namada", "WNAM", wnamTokenSupply, bridge.address], hre.network.name);

    console.log("Running checks...")
    const governanceAddressProxy = await proxy.getContract("governance")
    const bridgeAddressProxy = await proxy.getContract("bridge")

    assert(governanceAddressProxy == governance.address)
    assert(bridgeAddressProxy == bridge.address)
    console.log("Looking good!")
}

const writeState = async (proxyAddress, governanceAddress, bridgeAddress, tokenAddress, networkName, networkChainId) => {
    const filePath = `scripts/state-${networkName}-${networkChainId}.json`
    const stateExist = fs.existsSync(filePath)

    const stateContent = JSON.stringify({
        'proxy': proxyAddress,
        'governance': governanceAddress,
        'bridge': bridgeAddress,
        'token': tokenAddress,
        'network': {
            'name': networkName,
            'chainId': networkChainId
        }
    })

    if (stateExist) {
        const { overwrite } = await prompt.get([{
            name: 'overwrite',
            required: true,
            description: `State file ${filePath} already exist, wanna overwrite it?`,
            type: 'boolean'
        }])

        if (overwrite) {
            fs.writeFileSync(filePath, stateContent)
        }
    } else {
        fs.writeFileSync(filePath, stateContent)
    }
}

const computeThreshold = (powers) => {
    const sum = Array.isArray(powers) ? powers.reduce((a, b) => a + b, 0) : powers;
    const two_third = (2 * sum) / 3;
    return Math.round(two_third);
}

function isValidValidatorSet(path) {
    const content = fs.readFileSync(path)
    const jsonContent = JSON.parse(content)
    const totalValidators = Object.keys(jsonContent).length
    const votingPowerSum = Object.values(jsonContent).reduce((acc, val) => acc + val, 0)
    const maxVotingPower = Math.pow(2, 32)

    return totalValidators > 0 && totalValidators < 126 && votingPowerSum <= maxVotingPower && votingPowerSum >= maxVotingPower - 10
}

function isValidJsonFile(path) {
    if (!fs.existsSync(path)) {
        return false
    }

    const content = fs.readFileSync(path)
    try {
        const jsonContent = JSON.parse(content)
        return Object.keys(jsonContent).length > 0;
    } catch (e) {
        return false
    }
}

async function etherscan(address, constructorArgs, networkName) {
    if (networkName == 'localhost') {
        return
    }

    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: constructorArgs
        });
    } catch (e) {
        console.log(e)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });