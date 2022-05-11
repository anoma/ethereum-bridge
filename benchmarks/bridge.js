const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash } = require("./../test/utils/utilities")

const updateValidatorSetBenchmark = async function (index) {
    const normalizedThreshold = normalizeThreshold();
    const powers = randomPowers(index);
    const bridgeSigners = getSigners(index);
    const bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
    const bridgeNormalizedPowers = normalizePowers(powers);
    const powerThreshold = computeThreshold(normalizedThreshold);

    const governanceSigners = getSigners(index);
    const governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
    const governanceNormalizedPowers = normalizePowers(powers);

    const Hub = await ethers.getContractFactory("Hub");
    const Governance = await ethers.getContractFactory("Governance");
    const Bridge = await ethers.getContractFactory("Bridge");

    const hub = await Hub.deploy();
    const hubAddress = hub.address;

    const governance = await Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold, hubAddress);
    await governance.deployed();

    const bridge = await Bridge.deploy(1, bridgeValidatorsAddresses, bridgeNormalizedPowers, powerThreshold, hubAddress);
    await bridge.deployed();

    await hub.addContract("governance", governance.address);
    await hub.addContract("bridge", bridge.address);

    await hub.completeContractInit();

    await network.provider.send("evm_mine")

    const newPowers = randomPowers(index);
    const newSigners = getSigners(index);
    const newValidatorsAddresses = getSignersAddresses(newSigners);
    const newNormalizedPowers = normalizePowers(newPowers);

    const currentBridgeValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)

    const newBridgeValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
    const newGovernanceValidatorSetHash = generateValidatorSetHash(governanceValidatorsAddresses, governanceNormalizedPowers, 1, "governance")

    const messageHash = generateArbitraryHash(
        ["uint256", "string", "bytes32", "bytes32", "uint256"],
        [1, "updateValidatorsSet", newBridgeValidatorSetHash, newGovernanceValidatorSetHash, 1]
    )

    const signatures = await generateSignatures(bridgeSigners, messageHash);

    try {
        const tx = await governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signatures)

        const receipt = await tx.wait()
        const txGas = Number(receipt.gasUsed);

        return [index, txGas]
    } catch (e) {
        throw `Error execution updateValidatorsSet: ${e}`;
    }
}

exports.updateValidatorSetBenchmark = updateValidatorSetBenchmark;