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

    const { brideValidatorNextSetPath } = await prompt.get([{
        name: 'brideValidatorNextSetPath',
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

    if (!isValidJsonFile(brideValidatorSetPath) || !isValidJsonFile(governanceValidatorSetPath)) {
        return;
    }

    if (!isValidValidatorSet(brideValidatorSetPath) || !isValidValidatorSet(governanceValidatorSetPath)) {
        return
    }

    const { tokenSupply } = await prompt.get([{
        name: 'tokenSupply',
        required: true,
        description: "Max token ERC20 token supply",
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
        description: "Whitelisted token address, comma separated",
        type: 'string',
        default: ''
    }])

    const { tokenCapsPrompt } = await prompt.get([{
        name: 'tokenCapsPrompt',
        required: false,
        description: "Whitelisted token caps, comma separated",
        type: 'string',
        default: ''
    }])

    const tokenWhitelist = tokenWhitelistPrompt.length == 0 ? [] : tokenWhitelistPrompt.split(',').map(token => token.trim())
    const tokenCaps = tokenCapsPrompt.length == 0 ? [] : tokenCapsPrompt.split(',').map(cap => parseInt(cap))

    // bridge constructors parameters
    const bridgeValidatorSetContent = fs.readFileSync(brideValidatorSetPath)
    const bridgeValidatorSet = JSON.parse(bridgeValidatorSetContent)

    const bridgeValidators = Object.keys(bridgeValidatorSet)
    const bridgeVotingPowers = Object.values(bridgeValidatorSet)
    const bridgeVotingPowerThreshold = computeThreshold(bridgeVotingPowers)

    // next bridge contructor parameters
    const nextBridgeValidatorSetContent = fs.readFileSync(brideValidatorNextSetPath)
    const nextBridgeValidatorSet = JSON.parse(bridgeValidatorSetContent)

    const nextBridgeValidators = Object.keys(bridgeValidatorSet)
    const nextBridgeVotingPowers = Object.values(bridgeValidatorSet)
    const nextBridgeVotingPowerThreshold = computeThreshold(bridgeVotingPowers)

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

    const Hub = await ethers.getContractFactory("Hub");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");
    const Token = await ethers.getContractFactory("Token");

    const hub = await Hub.deploy();
    await hub.deployed();

    const bridge = await Bridge.deploy(1, bridgeValidators, bridgeVotingPowers, nextBridgeValidators, nextBridgeVotingPowers, tokenWhitelist, tokenCaps, bridgeVotingPowerThreshold, hub.address);
    await bridge.deployed();

    const governance = await Governance.deploy(1, governanceValidators, governanceVotingPowers, governanceVotingPowerThreshold, hub.address);
    await governance.deployed()

    await hub.addContract("governance", governance.address);
    await hub.addContract("bridge", bridge.address);

    await hub.completeContractInit();

    const token = await Token.deploy("Wrapper Namada", "WNAM", tokenSupply, bridge.address);
    await token.deployed();

    console.log("")
    console.log(`Hub address: ${hub.address}`)
    console.log(`Governance address: ${governance.address}`)
    console.log(`Bridge address: ${bridge.address}`)
    console.log(`Token address: ${token.address}`)
    console.log("")

    await writeState(hub.address, governance.address, bridge.address, token.address, hre.network.name, hre.network.config.chainId)

    await etherscan(hub.address, [], hre.network.name);
    await etherscan(governance.address, [1, governanceValidators, governanceVotingPowers, governanceVotingPowerThreshold, hub.address], hre.network.name);
    await etherscan(bridge.address, [1, bridgeValidators, bridgeVotingPowers, bridgeVotingPowerThreshold, hub.address], hre.network.name);
    await etherscan(token.address, ["Wrapper Namada", "WNAM", tokenSupply, bridge.address], hre.network.name);

    console.log("Running checks...")
    const governanceAddressHub = await hub.getContract("governance")
    const bridgeAddressHub = await hub.getContract("bridge")

    assert(governanceAddressHub == governance.address)
    assert(bridgeAddressHub == bridge.address)
    console.log("Looking good!")
}

const writeState = async (hubAddress, governanceAddress, bridgeAddress, tokenAddress, networkName, networkChainId) => {
    const filePath = `scripts/state-${networkName}-${networkChainId}.json`
    const stateExist = fs.existsSync(filePath)

    const stateContent = JSON.stringify({
        'hub': hubAddress,
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