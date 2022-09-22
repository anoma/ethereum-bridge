const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash } = require("../test/utils/utilities")

const updateValidatorSetBenchmarkLadder = async function (index) {
    const normalizedThreshold = normalizeThreshold();
    const powers = randomPowers(index);
    const bridgeSigners = getSigners(index);
    const bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
    const bridgeNormalizedPowers = normalizePowers(powers);
    const powerThreshold = computeThreshold(normalizedThreshold);

    const governanceSigners = getSigners(index);
    const governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
    const governanceNormalizedPowers = normalizePowers(powers);

    const Proxy = await ethers.getContractFactory("Proxy");
    const Governance = await ethers.getContractFactory("Governance");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Vault = await ethers.getContractFactory("Vault");

    const proxy = await Proxy.deploy();

    const vault = await Vault.deploy(proxy.address);
    await vault.deployed();

    const governance = await Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold, proxy.address);
    await governance.deployed();

    const bridge = await Bridge.deploy(1, bridgeValidatorsAddresses, bridgeNormalizedPowers, bridgeValidatorsAddresses, bridgeNormalizedPowers, [], [], powerThreshold, proxy.address);
    await bridge.deployed();

    await proxy.addContract("governance", governance.address);
    await proxy.addContract("bridge", bridge.address);
    await proxy.addContract("vault", vault.address);
    await proxy.completeContractInit();

    await network.provider.send("evm_mine")

    const newPowers = randomPowers(index);
    const newSigners = getSigners(index);
    const newValidatorsAddresses = getSignersAddresses(newSigners);
    const newNormalizedPowers = normalizePowers(newPowers);

    const currentBridgeValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)

    const newBridgeValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
    const newGovernanceValidatorSetHash = generateValidatorSetHash(governanceValidatorsAddresses, governanceNormalizedPowers, 1, "governance")

    const messageHash = generateArbitraryHash(
        ["uint8", "string", "bytes32", "bytes32", "uint256"],
        [1, "updateValidatorsSet", newBridgeValidatorSetHash, newGovernanceValidatorSetHash, 2]
    )

    const signatures = await generateSignatures(bridgeSigners, messageHash);

    try {
        const tx = await governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signatures, 2)

        const receipt = await tx.wait()
        const txGas = Number(receipt.gasUsed);
        return [index, txGas]
    } catch (e) {
        throw `Error execution updateValidatorsSet: ${e}`;
    }
}

const updateValidatorSetBenchmarkFixed = async function (index) {
    const totalValidators = 125
    const normalizedThreshold = normalizeThreshold();
    const powers = randomPowers(totalValidators);
    const bridgeSigners = getSigners(totalValidators);
    const bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
    const bridgeNormalizedPowers = normalizePowers(powers);
    const powerThreshold = computeThreshold(normalizedThreshold);

    const governanceSigners = getSigners(totalValidators);
    const governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
    const governanceNormalizedPowers = normalizePowers(powers);

    const Proxy = await ethers.getContractFactory("Proxy");
    const Governance = await ethers.getContractFactory("Governance");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Vault = await ethers.getContractFactory("Vault");

    const proxy = await Proxy.deploy();
    await proxy.deployed()

    const vault = await Vault.deploy(proxy.address);
    await vault.deployed();

    const governance = await Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold, proxy.address);
    await governance.deployed();

    const bridge = await Bridge.deploy(1, bridgeValidatorsAddresses, bridgeNormalizedPowers,bridgeValidatorsAddresses, bridgeNormalizedPowers, [], [], powerThreshold, proxy.address);
    await bridge.deployed();

    await proxy.addContract("governance", governance.address);
    await proxy.addContract("bridge", bridge.address);
    await proxy.addContract("vault", vault.address)
    await proxy.completeContractInit();

    await network.provider.send("evm_mine")

    const newPowers = randomPowers(totalValidators);
    const newSigners = getSigners(totalValidators);
    const newValidatorsAddresses = getSignersAddresses(newSigners);
    const newNormalizedPowers = normalizePowers(newPowers);

    const currentBridgeValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)

    const newBridgeValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
    const newGovernanceValidatorSetHash = generateValidatorSetHash(governanceValidatorsAddresses, governanceNormalizedPowers, 1, "governance")

    const messageHash = generateArbitraryHash(
        ["uint8", "string", "bytes32", "bytes32", "uint256"],
        [1, "updateValidatorsSet", newBridgeValidatorSetHash, newGovernanceValidatorSetHash, 2]
    )

    const signatures = await generateSignatures(bridgeSigners, messageHash);

    try {
        const tx = await governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signatures, 2)

        const receipt = await tx.wait()
        const txGas = Number(receipt.gasUsed);
        return [index, txGas]
    } catch (e) {
        throw `Error execution updateValidatorsSet: ${e}`;
    }
}

exports.updateValidatorSetBenchmark = updateValidatorSetBenchmarkLadder;
exports.updateValidatorSetBenchmarkFixed = updateValidatorSetBenchmarkFixed;