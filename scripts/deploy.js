const prompt = require('prompt');
const { ethers } = require("hardhat");
const fs = require('fs')
const assert = require('assert');

async function main() {
    const network = await ethers.getDefaultProvider().getNetwork();

    console.log(`Running on network ${network.name} with chain-id ${network.chainId}`)
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

    const { governanceValidatorSetPath } = await prompt.get([{
        name: 'governanceValidatorSetPath',
        required: true,
        description: "Full path to governance validator set json file",
        type: 'string'
    }])

    if (!isValidJsonFile(brideValidatorSetPath, network) || !isValidJsonFile(governanceValidatorSetPath, network)) {
        return;
    }

    if (!isValidValidatorSet(brideValidatorSetPath) || !isValidValidatorSet(governanceValidatorSetPath)) {
        return
    }

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

    // bridge constructors parameters
    const bridgeValidatorSetContent = fs.readFileSync(brideValidatorSetPath)
    const bridgeValidatorSet = JSON.parse(bridgeValidatorSetContent)

    const bridgeValidators = Object.keys(bridgeValidatorSet)
    const bridgeVotingPowers = Object.values(bridgeValidatorSet)
    const bridgeVotingPowerThreshold = computeThreshold(bridgeVotingPowers)

    // governance constroctor parameters
    const governanceValidatorSetContent = fs.readFileSync(governanceValidatorSetPath)
    const governanceValidatorSet = JSON.parse(governanceValidatorSetContent)

    const governanceValidators = Object.keys(governanceValidatorSet)
    const governanceVotingPowers = Object.values(governanceValidatorSet)
    const governanceVotingPowerThreshold = computeThreshold(governanceVotingPowers)


    const Hub = await ethers.getContractFactory("Hub");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");

    const hub = await Hub.deploy();
    await hub.deployed();

    const bridge = await Bridge.deploy(1, bridgeValidators, bridgeVotingPowers, bridgeVotingPowerThreshold, hub.address);
    await bridge.deployed();

    const governance = await Governance.deploy(1, governanceValidators, governanceVotingPowers, governanceVotingPowerThreshold, hub.address);
    await governance.deployed()

    await hub.addContract("governance", governance.address);
    await hub.addContract("bridge", bridge.address);

    await hub.completeContractInit();

    console.log("")
    console.log(`Hub address: ${hub.address}`)
    console.log(`Governance address: ${governance.address}`)
    console.log(`Bridge address: ${bridge.address}`)
    console.log("")

    await writeState(hub.address, governance.address, bridge.address, network)

    console.log("Running checks...")
    const governanceAddressHub = await hub.getContract("governance")
    const bridgeAddressHub = await hub.getContract("bridge")

    assert(governanceAddressHub == governance.address)
    assert(bridgeAddressHub == bridge.address)
    console.log("Looking good!")
}

const writeState = async (hubAddress, governanceAddress, bridgeAddress, network) => {
    const filePath = `scripts/state-${network.name}-${network.chainId}.json`
    const stateExist = fs.existsSync(filePath)

    const stateContent = JSON.stringify({
        'hub': hubAddress,
        'governance': governanceAddress,
        'bridge': bridgeAddress,
        'network': {
            'name': network.name,
            'chainId': network.chainId
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

function isValidJsonFile(path, network) {
    if (!fs.existsSync(path)) {
        return false
    }

    if (network.chainId != 1 && path.includes('fake-')) {
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

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });