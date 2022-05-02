const { expect } = require("chai");
const { ethers } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash } = require("./utils/utilities")

describe("Bridge", function () {
    let Hub;
    let Bridge;
    let hub;
    let bridge;
    let signers;
    let validatorsAddresses;
    let normalizedPowers;
    let powerThreshold;

    beforeEach(async function () {
        const totalValidators = 10;
        const normalizedThreshold = normalizeThreshold();
        const powers = randomPowers(totalValidators);
        signers = getSigners(totalValidators);
        validatorsAddresses = getSignersAddresses(signers);
        normalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(normalizedThreshold);

        Hub = await ethers.getContractFactory("Hub");
        Bridge = await ethers.getContractFactory("Bridge");

        hub = await Hub.deploy();
        const hubAddress = hub.address;
 
        bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, powerThreshold, hubAddress);
        await bridge.deployed();
    });

    it("Initialize contract testing", async function () {
        // invalid threshold power 
        const bridgeInvalidPowerThreshold = Bridge.deploy(1, validatorsAddresses, normalizedPowers, powerThreshold * 2, hub.address);
        await expect(bridgeInvalidPowerThreshold).to.be.revertedWith("Invalid voting power threshold.")

        // invalid threshold power 2 
        const bridgeInvalidPowerThresholdTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers.map(p => Math.floor(p/2)), powerThreshold, hub.address);
        await expect(bridgeInvalidPowerThresholdTwo).to.be.revertedWith("Invalid voting power threshold.")

        // mismatch array length 
        const bridgeInvalidArrayLength = Bridge.deploy(1, validatorsAddresses, [1], powerThreshold, hub.address);
        await expect(bridgeInvalidArrayLength).to.be.revertedWith("Mismatch array length.");
    });

    it("Update validate set testing", async function () {
        const newTotalValidators = 12;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        const newPowerThreshold = computeThreshold(newNormalizedPowers);

        // due to floating point operation/rounding, threshold is not stable
        expect(newPowerThreshold).to.be.greaterThan(powerThreshold - 3);
        expect(newPowerThreshold).to.be.lessThan(powerThreshold + 3);

        // valid update vaidator set
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signatures = await generateSignatures(signers, newValidatorSetHash);

        await bridge.updateValidatorSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid lower nonce
        const newValidatorSetArgsLowerNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 0)
        const newValidatorSetHashLowerNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signaturesLowerNonce = await generateSignatures(newSigners, newValidatorSetHashLowerNonce);

        const bridgeInvalidLowerNonce = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsLowerNonce, signaturesLowerNonce)
        await expect(bridgeInvalidLowerNonce).to.be.revertedWith("Invalid validatorSetNonce");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid too big nonce 
        const newValidatorSetArgsTooBigNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 10000)
        const newValidatorSetHashTooBigNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 10000, "bridge")
        const signaturesTooBigNonce = await generateSignatures(newSigners, newValidatorSetHashTooBigNonce);

        const bridgeInvalidTooBigNonce = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsTooBigNonce, signaturesTooBigNonce)
        await expect(bridgeInvalidTooBigNonce).to.be.revertedWith("Invalid validatorSetNonce");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid validator set structure
        const newValidatorSetArgsBadStructure = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadStructure = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        const signaturesBadStructure = await generateSignatures(newSigners, newValidatorSetHashBadStructure);

        const bridgeInvalidBadStructure = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadStructure, signaturesBadStructure.splice(1))
        await expect(bridgeInvalidBadStructure).to.be.revertedWith("Mismatch array length.");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid validator set hash
        const newCurrentValidatorSet = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2);
        const newValidatorSetArgsBadSValidatorSetHash = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 3)
        const newValidatorSetHashBadSValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 3, "bridge")
        const signaturesBadSValidatorSetHash = await generateSignatures(newSigners, newValidatorSetHashBadSValidatorSetHash);

        const bridgeInvalidBadSValidatorSetHash = bridge.updateValidatorSet(newCurrentValidatorSet, newValidatorSetArgsBadSValidatorSetHash, signaturesBadSValidatorSetHash)
        await expect(bridgeInvalidBadSValidatorSetHash).to.be.revertedWith("Invalid validatorSetHash.");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid not enough voting power
        const badVotingPower = newNormalizedPowers.map(power => Math.round(power / 10000))
        const newValidatorSetArgsLowVotingPower = generateValidatorSetArgs(newValidatorsAddresses, badVotingPower, 2)
        const newValidatorSetHashLowVotingPower = generateValidatorSetHash(newValidatorsAddresses, badVotingPower, 2, "bridge")
        const signaturesLowVotingPower = await generateSignatures(newSigners, newValidatorSetHashLowVotingPower);

        const bridgeInvalidLowVotingPower = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsLowVotingPower, signaturesLowVotingPower)
        await expect(bridgeInvalidLowVotingPower).to.be.revertedWith("Not enough voting power.");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid signature 1
        const newValidatorSetArgsBadSignature = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadSignature = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        let signaturesBadSignature = await generateSignatures(newSigners, newValidatorSetHashBadSignature);
        signaturesBadSignature[5].r = signaturesBadSignature[0].r
        signaturesBadSignature[5].s = signaturesBadSignature[0].s
        signaturesBadSignature[5].v = signaturesBadSignature[0].v

        const bridgeInvalidBadSignature = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadSignature, signaturesBadSignature)
        await expect(bridgeInvalidBadSignature).to.be.revertedWith("Invalid validator set signature.");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // invalid signature 2
        const newValidatorSetArgsBadSignature2 = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadSignature2 = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        let signaturesBadSignature2 = await generateSignatures(newSigners, newValidatorSetHashBadSignature2);
        const badCheckpoint = generateValidatorSetHash([newValidatorsAddresses[0]], [newNormalizedPowers[0]], 2, "bridge")
        const badSignature = await generateSignatures([newSigners[0]], badCheckpoint)
        signaturesBadSignature2[5] = badSignature.pop()

        const bridgeInvalidBadSignature2 = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadSignature2, signaturesBadSignature2)
        await expect(bridgeInvalidBadSignature2).to.be.revertedWith("Invalid validator set signature.");
        expect(await bridge.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(1);

        // valid update validator set
        const updateValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const updateValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        const updateSignatures = await generateSignatures(newSigners, updateValidatorSetHash);

        await bridge.updateValidatorSet(newValidatorSetArgs, updateValidatorSetArgs, updateSignatures)
        expect(await bridge.lastValidatorSetHash()).to.be.equal(updateValidatorSetHash);
        expect(await bridge.lastValidatorSetNonce()).to.be.equal(2);
    });

    it("Authorize testing", async function () {
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const messageHash = generateArbitraryHash(["uint256", "string"], [1, "test"])
        let signatures = await generateSignatures(signers, messageHash);

        const result = await bridge.authorize(currentValidatorSetArgs, signatures, messageHash)
        expect(result).to.be.equal(true)
    });
})