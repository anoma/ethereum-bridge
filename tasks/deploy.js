const prompt = require('prompt');
const fs = require('fs')
const assert = require('assert');

async function main(hre, configJsonPath) {
    console.log(`Running on network ${hre.network.name} with chain-id ${hre.network.config.chainId}`)
    if (!!!configJsonPath) {
        console.log("Deploying Ethereum bridge smart contracts interactively")
        const config = await buildConfigInteractively()
        const stateContent = await deploy(config)
        await writeState(stateContent)
    } else {
        console.log(`Will deploy automatically using configuration from ${configJsonPath}`);
        const configBuf = fs.readFileSync(configJsonPath)
        const config = JSON.parse(configBuf)
        const stateContent = await deploy(config)
        console.log(stateContent)
    }
}
module.exports = {
    main: main,
}

/**
 * Builds a Config object interactively, prompting the deployer to provide the required information on the command line.
 */
async function buildConfigInteractively() {
    const { correctNetwork } = await prompt.get([{
        name: 'correctNetwork',
        required: true,
        description: "Is the network correct?",
        type: 'boolean'
    }])

    if (!correctNetwork) {
        throw new Error('Network is not correct');
    }

    const { bridgeValidatorSetPath } = await prompt.get([{
        name: 'bridgeValidatorSetPath',
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

    const { nextGovernanceValidatorSetPath } = await prompt.get([{
        name: 'nextGovernanceValidatorSetPath',
        required: true,
        description: "Full path to next governance validator set json file",
        type: 'string'
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
        throw new Error('Signer is not correct');
    }

    return {
        bridgeValidatorSetPath,
        nextBridgeValidatorSetPath,
        governanceValidatorSetPath,
        nextGovernanceValidatorSetPath,
    }
}

/**
 * Validate a validator set, and return contract paramters.
 *
 * @param {Object} config  Configuration for deploying an Ethereum bridge.
 *
 * @returns {Object}  An object containing contract constructor parameters.
 *
 */
function validateValidatorSet(currentValidatorSetPath, nextValidatorSetPath) {
    const validJson = isValidJsonFile(currentValidatorSetPath)
        && isValidJsonFile(nextValidatorSetPath);
    if (!validJson) {
        throw new Error('Validator set is not a valid json file');
    }

    const validValidatorSet = isValidValidatorSet(currentValidatorSetPath)
        && isValidValidatorSet(nextValidatorSetPath);
    if (!validValidatorSet) {
        throw new Error('Validator set json file is not correct');
    }

    // current validator set constructor parameters
    const currentValidatorSetContent = fs.readFileSync(currentValidatorSetPath)
    const currentValidatorSet = JSON.parse(currentValidatorSetContent)

    const currentValidators = Object.keys(currentValidatorSet)
    const currentVotingPowers = Object.values(currentValidatorSet)
    const currentVotingPowerThreshold = computeThreshold(currentVotingPowers)

    // next validator set contructor parameters
    const nextValidatorSetContent = fs.readFileSync(nextValidatorSetPath)
    const nextValidatorSet = JSON.parse(nextValidatorSetContent)

    const nextValidators = Object.keys(nextValidatorSet)
    const nextVotingPowers = Object.values(nextValidatorSet)
    const nextVotingPowerThreshold = computeThreshold(nextVotingPowers)

    // validate voting powers
    assert(nextVotingPowerThreshold > currentVotingPowerThreshold - 10)
    assert(nextVotingPowerThreshold < currentVotingPowerThreshold + 10)

    return {
        currentValidators,
        currentVotingPowers,
        currentVotingPowerThreshold,
        nextValidators,
        nextVotingPowers,
        nextVotingPowerThreshold,
    };
}

/**
 * Returns a set of constructor params from the given config.
 *
 * @param {Object} config  Configuration for deploying an Ethereum bridge.
 *
 * @returns {Object}  An object containing parameters for the bridge and governance.
 *
 */
function getContractParameters(config) {
    // error if config isn't passed
    if (!config) {
        throw new Error('No deployment config was passed')
    }
    const {
        bridgeValidatorSetPath,
        nextBridgeValidatorSetPath,
        governanceValidatorSetPath,
        nextGovernanceValidatorSetPath,
    } = config;

    return {
        bridge: validateValidatorSet(
            bridgeValidatorSetPath,
            nextBridgeValidatorSetPath,
        ),
        governance: validateValidatorSet(
            governanceValidatorSetPath,
            nextGovernanceValidatorSetPath,
        ),
    };
}

/**
 * Deploys according to the passed config.
 *
 * @param {Object} config  Configuration for deploying an Ethereum bridge.
 *
 * @returns {Object}  An object describing the deployed contracts.
 *
 * **/
async function deploy(config) {
    const parameters = getContractParameters(config);

    const Proxy = await ethers.getContractFactory("Proxy");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");
    const Vault = await ethers.getContractFactory("Vault");
    const Token = await ethers.getContractFactory("Token");

    const proxyInitArgs = [];
    const proxy = await Proxy.deploy(...proxyInitArgs);
    await proxy.deployed();

    const vaultInitArgs = [proxy.address];
    const vault = await Vault.deploy(...vaultInitArgs);
    await vault.deployed();

    const wnamTokenInitArgs = [vault.address, "Wrapper Namada", "WNAM"];
    const wnamToken = await Token.deploy(...wnamTokenInitArgs);
    await wnamToken.deployed();

    const bridgeInitArgs = [
        1,
        parameters.bridge.currentValidators,
        parameters.bridge.currentVotingPowers,
        parameters.bridge.nextValidators,
        parameters.bridge.nextVotingPowers,
        parameters.bridge.currentVotingPowerThreshold,
        proxy.address,
    ];
    const bridge = await Bridge.deploy(...bridgeInitArgs);
    await bridge.deployed();

    const governanceInitArgs = [
        1,
        parameters.governance.currentValidators,
        parameters.governance.currentVotingPowers,
        parameters.governance.nextValidators,
        parameters.governance.nextVotingPowers,
        parameters.governance.currentVotingPowerThreshold,
        proxy.address,
    ];
    const governance = await Governance.deploy(...governanceInitArgs);
    await governance.deployed()

    await proxy.addContract("governance", governance.address);
    await proxy.addContract("bridge", bridge.address);
    await proxy.addContract("vault", vault.address);

    await proxy.completeContractInit();

    console.log("")
    console.log(`Proxy address: ${proxy.address}`)
    console.log(`Governance address: ${governance.address}`)
    console.log(`Bridge address: ${bridge.address}`)
    console.log(`wNAM token address: ${wnamToken.address}`)
    console.log("")

    await etherscan(proxy.address, proxyInitArgs, hre.network.name);
    await etherscan(governance.address, governanceInitArgs, hre.network.name);
    await etherscan(bridge.address, bridgeInitArgs, hre.network.name);
    await etherscan(wnamToken.address, wnamTokenInitArgs, hre.network.name);

    console.log("Running checks...")
    const governanceAddressProxy = await proxy.getContract("governance")
    const bridgeAddressProxy = await proxy.getContract("bridge")

    assert(governanceAddressProxy == governance.address)
    assert(bridgeAddressProxy == bridge.address)
    console.log("Looking good!")

    return constructStateContent(
        proxy.address,
        governance.address,
        bridge.address,
        wnamToken.address,
        hre.network.name,
        hre.network.config.chainId,
    );
}

function constructStateContent(proxyAddress, governanceAddress, bridgeAddress, wnamAddress, networkName, networkChainId) {
    return {
        'proxy': proxyAddress,
        'governance': governanceAddress,
        'bridge': bridgeAddress,
        'wnam': wnamAddress,
        'network': {
            'name': networkName,
            'chainId': networkChainId
        }
    }
}

async function writeState(stateContent) {
    const filePath = `scripts/state-${stateContent.network.name}-${stateContent.network.chainId}.json`
    const stateExist = fs.existsSync(filePath)

    if (stateExist) {
        const { overwrite } = await prompt.get([{
            name: 'overwrite',
            required: true,
            description: `State file ${filePath} already exist, wanna overwrite it?`,
            type: 'boolean'
        }])

        if (overwrite) {
            fs.writeFileSync(filePath, JSON.stringify(stateContent))
        }
    } else {
        fs.writeFileSync(filePath, JSON.stringify(stateContent))
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
