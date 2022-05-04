const { expect } = require("chai");
const { ethers } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash } = require("./utils/utilities")

describe("Governance", function () {
    let Hub;
    let Governance;
    let Bridge;
    let hub;
    let governance;
    let bridge;
    let bridgeSigners;
    let bridgeValidatorsAddresses;
    let bridgeNormalizedPowers;
    let governanceSigners;
    let governanceValidatorsAddresses;
    let governanceNormalizedPowers;
    let powerThreshold;

    beforeEach(async function () {
        const totalValidators = 10;
        const normalizedThreshold = normalizeThreshold();
        const powers = randomPowers(totalValidators);
        bridgeSigners = getSigners(totalValidators);
        bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
        bridgeNormalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(normalizedThreshold);

        governanceSigners = getSigners(totalValidators);
        governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
        governanceNormalizedPowers = normalizePowers(powers);

        expect(powerThreshold).to.be.greaterThan(computeThreshold(normalizedThreshold) - 3);
        expect(powerThreshold).to.be.lessThan(computeThreshold(normalizedThreshold) + 3);

        Hub = await ethers.getContractFactory("Hub");
        Governance = await ethers.getContractFactory("Governance");
        Bridge = await ethers.getContractFactory("Bridge");

        hub = await Hub.deploy();
        const hubAddress = hub.address;

        governance = await Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold, hubAddress);
        await governance.deployed();

        bridge = await Bridge.deploy(1, bridgeValidatorsAddresses, bridgeNormalizedPowers, powerThreshold, hubAddress);
        await bridge.deployed();

        await hub.addContract("governance", governance.address);
        await hub.addContract("bridge", bridge.address);

        await hub.completeContractInit();
    });

    it("Initialize contract testing", async function () {
        // invalid threshold power 
        const governanceInvalidPowerThreshold = Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold * 2, hub.address);
        await expect(governanceInvalidPowerThreshold).to.be.revertedWith("Invalid voting power threshold.")

        // invalid threshold power 2 
        const governanceInvalidPowerThresholdTwo = Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers.map(p => Math.floor(p / 2)), powerThreshold, hub.address);
        await expect(governanceInvalidPowerThresholdTwo).to.be.revertedWith("Invalid voting power threshold.")

        // mismatch array length 
        const governanceInvalidArrayLength = Governance.deploy(1, governanceValidatorsAddresses, [1], powerThreshold, hub.address);
        await expect(governanceInvalidArrayLength).to.be.revertedWith("Mismatch array length.");
    });

    it("Update validator set testing", async function () {
        const newTotalValidators = 12;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        const newPowerThreshold = computeThreshold(newNormalizedPowers);

        // due to floating point operation/rounding, threshold is not stable
        expect(newPowerThreshold).to.be.greaterThan(powerThreshold - 3);
        expect(newPowerThreshold).to.be.lessThan(powerThreshold + 3);

        // valid update governance set
        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "governance")
        const signatures = await generateSignatures(bridgeSigners, newValidatorSetHash);

        await governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
        expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await governance.lastValidatorSetNonce()).to.be.equal(1);

        // invalid update governance set bad nonce (too little)
        const newValidatorSetArgsBadNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHashBadNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "governance")
        const signaturesBadNonce = await generateSignatures(bridgeSigners, newValidatorSetHashBadNonce);

        const governanceInvalidBadNonce = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadNonce, signaturesBadNonce)
        await expect(governanceInvalidBadNonce).to.be.revertedWith("Invalid nonce.")
        expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
        expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

        // invalid update governance set bad nonce (too big)
        const newValidatorSetArgsBadNonceTwo = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 10003)
        const newValidatorSetHashBadNonceTwo = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 10003, "governance")
        const signaturesBadNonceTwo = await generateSignatures(bridgeSigners, newValidatorSetHashBadNonceTwo);

        const governanceInvalidBadNonceTwo = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadNonceTwo, signaturesBadNonceTwo)
        await expect(governanceInvalidBadNonceTwo).to.be.revertedWith("Invalid nonce.")
        expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
        expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

        // invalid update governance unauthorized 
        const newValidatorSetArgsBadAuth = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 5)
        const newValidatorSetHashBadAuth = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 5, "governance")
        const signaturesBadAuth = await generateSignatures(bridgeSigners, newValidatorSetHashBadAuth);

        signaturesBadAuth[2].r = signaturesBadAuth[0].r
        signaturesBadAuth[2].s = signaturesBadAuth[0].s
        signaturesBadAuth[2].v = signaturesBadAuth[0].v


        const governanceInvalidBadAuth = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadAuth, signaturesBadAuth)
        await expect(governanceInvalidBadAuth).to.be.revertedWith("Invalid validator set signature.")
        expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
        expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

        // valid update governance set
        const currentValidatorSetArgsValid = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const newValidatorSetArgsValid = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashValid = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "governance")
        const signaturesValid = await generateSignatures(bridgeSigners, newValidatorSetHashValid);

        await governance.updateGovernanceSet(currentValidatorSetArgsValid, newValidatorSetArgsValid, signaturesValid)
        expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHashValid);
        expect(await governance.lastValidatorSetNonce()).to.be.equal(2);
    });

    it("Upgrade contract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "governance"

        let abiEncoded = ethers.utils.solidityPack(
            ["uint256", "string", "string", "address", ],
            [1, "upgradeContract", contractName, newContractAddress]
        );
        const messageHash = ethers.utils.keccak256(abiEncoded);
        
        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);
        await governance.upgradeContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await hub.getContract(contractName);
        expect(newAddress).to.be.equal(newContractAddress);
    });

    it("Add contract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "new"

        const  messageHash = generateArbitraryHash(
            ["uint256", "string", "string", "address"],
            [1, "addContract", contractName, newContractAddress]
        );
        
        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);
        await governance.addContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await hub.getContract("new");
        expect(newAddress).to.be.equal(newContractAddress);
    });
})