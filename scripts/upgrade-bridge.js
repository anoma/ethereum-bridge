const prompt = require('prompt');
const { ethers } = require("hardhat");
const hre = require("hardhat")
const fs = require('fs');
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

    const { currentBrideValidatorSetPath } = await prompt.get([{
        name: 'currentBrideValidatorSetPath',
        required: true,
        description: "Full path to current bridge validator set json file",
        type: 'string'
    }])

    const { nextBrideValidatorSetPath } = await prompt.get([{
        name: 'newBrideValidatorSetPath',
        required: true,
        description: "Full path to the next bridge validator set json file",
        type: 'string'
    }])

    const { bridgeValidatorPrivateSetPath } = await prompt.get([{
        name: 'bridgeValidatorPrivateSetPath',
        required: true,
        description: "Full path to the private validator set path",
        type: 'string'
    }])

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

    if (!isValidJsonFile(currentBrideValidatorSetPath) || !isValidJsonFile(newBrideValidatorSetPath)) {
        return;
    }

    if (!isValidValidatorSet(currentBrideValidatorSetPath) || !isValidValidatorSet(newBrideValidatorSetPath)) {
        return
    }

    const { governanceAddress } = await prompt.get([{
        name: 'governanceAddress',
        required: true,
        description: "Governance contract address",
        type: 'string'
    }])

    const { proxyAddress } = await prompt.get([{
        name: 'proxyAddress',
        required: true,
        description: "Proxy contract address",
        type: 'string'
    }])

    let { tokens } = await prompt.get([{
        name: 'tokens',
        required: false,
        description: "Token addresses, comma separated",
        type: 'string'
    }])
    tokens = tokens.length == 0 ? [] : tokens.split(",").map(token => token.trim())

    const { contractVersion } = await prompt.get([{
        name: 'contractVersion',
        required: true,
        description: "Smart contract version",
        type: 'number'
    }])

    // private bridge validator data
    const bridgeValdiatorPrivateDataContent = fs.readFileSync(bridgeValidatorPrivateSetPath)
    const bridgeValdiatorPrivateData = JSON.parse(bridgeValdiatorPrivateDataContent)

    const bridgeSigners = Object.values(bridgeValdiatorPrivateData).map(data => {
        return ethers.Wallet.fromMnemonic(data.phrase, data.path)
    })

    // bridge constructors parameters
    const bridgeValidatorSetContent = fs.readFileSync(currentBrideValidatorSetPath)
    const bridgeValidatorSet = JSON.parse(bridgeValidatorSetContent)

    const bridgeValidators = Object.keys(bridgeValidatorSet)
    const bridgeVotingPowers = Object.values(bridgeValidatorSet)

    // new bridge constructors parameters
    const newBridgeValidatorSetContent = fs.readFileSync(nextBrideValidatorSetPath)
    const newBridgeValidatorSet = JSON.parse(newBridgeValidatorSetContent)

    const newBridgeValidators = Object.keys(newBridgeValidatorSet)
    const newBridgeVotingPowers = Object.values(newBridgeValidatorSet)
    const newBridgeVotingPowerThreshold = computeThreshold(newBridgeVotingPowers)

    const Bridge = await ethers.getContractFactory("Bridge");
    const Governance = await ethers.getContractFactory("Governance");
    const Proxy = await ethers.getContractFactory("Proxy");

    const bridge = await Bridge.deploy(contractVersion, newBridgeValidators, newBridgeVotingPowers, newBridgeValidators, newBridgeVotingPowers, tokenWhitelist, tokenCaps, newBridgeVotingPowerThreshold, proxyAddress);
    await bridge.deployed();

    const governance = await Governance.attach(governanceAddress)

    // validatorSetArg
    const nonce = await governance.validatorSetNonce()
    const bridgeValidatorSetArg = generateValidatorSetArgs(bridgeValidators, bridgeVotingPowers, nonce - 1)

    const messageHash = generateArbitraryHash(
        ["uint256", "string", "string", "address"],
        [1, "upgradeBridgeContract", "bridge", bridge.address]
    )
    const signatures = await generateSignatures(bridgeSigners, messageHash)

    await governance.upgradeBridgeContract(bridgeValidatorSetArg, signatures, tokens, bridge.address)

    console.log("")
    console.log(`New Bridge address: ${bridge.address}`)
    console.log("")

    await updateState(bridge.address, hre.network.name, hre.network.config.chainId)
    
    // wait for block to be mined...
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log("Running checks...")
    const proxy = await Proxy.attach(proxyAddress)
    const governanceAddressProxy = await proxy.getContract("governance")
    const bridgeAddressProxy = await proxy.getContract("bridge")

    assert(governanceAddressProxy == governanceAddress)
    assert(bridgeAddressProxy == bridge.address)
    console.log("Looking good!")
}

const updateState = async (bridgeAddress, networkName, networkChainId) => {
    const filePath = `scripts/state-${networkName}-${networkChainId}.json`
    const stateExist = fs.existsSync(filePath)

    if (!stateExist) {
        return
    }

    const stateContent = fs.readFileSync(filePath)
    const stateJson = JSON.parse(stateContent)

    stateJson['bridge'] = bridgeAddress

    fs.writeFileSync(filePath, JSON.stringify(stateJson))
}

const generateSignatures = async (signers, message) => {
    const signatures = await Promise.all(signers.map(async signer => {
        const _message = ethers.utils.arrayify(message)
        const signature = await signer.signMessage(_message)
        const splitSig = ethers.utils.splitSignature(signature);
        return { r: splitSig.r, s: splitSig.s, v: splitSig.v }
    }))
    return signatures
}

const generateArbitraryHash = (fields, data) => {
    let abiEncoded = encoder()(fields, data);
    return ethers.utils.keccak256(abiEncoded);
}

const generateValidatorSetArgs = (validatorAddreseses, powers, nonce) => {
    return {
        validators: validatorAddreseses,
        powers: powers,
        nonce: nonce
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

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });