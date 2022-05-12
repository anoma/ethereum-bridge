const prompt = require('prompt');
const { ethers } = require("hardhat");
const fs = require('fs')

async function main() {
    const network = await ethers.getDefaultProvider().getNetwork();

    console.log(`Running on network ${network.name} with chain-id ${network.chainId}`)
    const { correctNetwork } = await prompt.get([{
        name: 'correctNetwork',
        required: true,
        description: "Is the network correct?",
        type: 'boolean'
    }])

    const { validatorSetPath } = await prompt.get([{
        name: 'validatorSetPath',
        required: true,
        description: "Full path to validator set json file",
        type: 'string'
    }])

    if (!isValidJsonFile(validatorSetPath, network)) {
        return;
    }

    if (!isValidValidatorSet(validatorSetPath)) {
        return
    }

    if (!correctNetwork) {
        return;
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

    const validatorSetContent = fs.readFileSync(validatorSetPath)
    const validatorSet = JSON.parse(validatorSetContent)

    const validators = Object.keys(validatorSet)
    const votingPowers = Object.values(validatorSet)
    const votingPowerThreshold = computeThreshold(votingPowers)

    const Hub = await ethers.getContractFactory("Hub");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");

    const hub = await Hub.deploy();
    await hub.deployed();

    const bridge = await Bridge.deploy(1, validators, votingPowers, votingPowerThreshold, hub.address);
    await bridge.deployed();

    const governance = await Governance.deploy(1, validators, votingPowers, votingPowerThreshold, hub.address);
    await governance.deployed()

    await hub.addContract("governance", governance.address);
    await hub.addContract("bridge", bridge.address);

    await hub.completeContractInit();

    console.log(`Hub address: ${hub.address}`)
    console.log(`Governance address: ${governance.address}`)
    console.log(`Bridge address: ${bridge.address}`)

    await writeState(hub.address, governance.address, bridge.address, network)
}

const writeState = async (hubAddress, governanceAddress, bridgeAddress, network) => {
    const filePath = `scripts/${network.name}-${network.chainId}.json`
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

    return totalValidators > 0 && totalValidators < 126 && Object.values(jsonContent).reduce((acc, val) => acc + val, 0) - 1 == Math.pow(2, 32)
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