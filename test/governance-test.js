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
    const TOTAL_VALIDATORS = 20;

    beforeEach(async function () {
        const totalValidators = TOTAL_VALIDATORS;
        const maxTotalVotingPower = normalizeThreshold();
        const powers = randomPowers(totalValidators);
        bridgeSigners = getSigners(totalValidators);
        bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
        bridgeNormalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(maxTotalVotingPower);

        governanceSigners = getSigners(totalValidators);
        governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
        governanceNormalizedPowers = normalizePowers(powers);

        expect(powerThreshold).to.be.greaterThan(computeThreshold(maxTotalVotingPower) - 3);
        expect(powerThreshold).to.be.lessThan(computeThreshold(maxTotalVotingPower) + 3);

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

    it("updateValidatorSet testing", async function () {
        const newTotalValidators = TOTAL_VALIDATORS;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        const newPowerThreshold = computeThreshold(newNormalizedPowers);

        const governanceValidatorSetArgs = generateValidatorSetArgs(governanceValidatorsAddresses, governanceNormalizedPowers, 1)

        // due to floating point operation/rounding, threshold is not stable
        expect(newPowerThreshold).to.be.greaterThanOrEqual(powerThreshold - 3);
        expect(newPowerThreshold).to.be.lessThanOrEqual(powerThreshold + 3);

        // valid update governance set
        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const newBridgeValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)

        const [bridgeValidatorSetHash, governanceValidatorSetHash, newValidatorSetHash] = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, governanceValidatorsAddresses, governanceNormalizedPowers, 1)
        const signatures = await generateSignatures(bridgeSigners, newValidatorSetHash);

        await governance.updateValidatorSet(currentValidatorSetArgs, newBridgeValidatorSetArgs, governanceValidatorSetArgs, signatures)
        expect(await governance.validatorSetHash()).to.be.equal(governanceValidatorSetHash);
        expect(await bridge.getValidatorSetHash()).to.be.equal(bridgeValidatorSetHash);
        expect(await governance.validatorSetNonce()).to.be.equal(1);

    //     // invalid update governance set bad nonce (too little)
    //     const newValidatorSetArgsBadNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
    //     const newValidatorSetHashBadNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "governance")
    //     const signaturesBadNonce = await generateSignatures(bridgeSigners, newValidatorSetHashBadNonce);

    //     const governanceInvalidBadNonce = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadNonce, signaturesBadNonce)
    //     await expect(governanceInvalidBadNonce).to.be.revertedWith("Invalid nonce.")
    //     expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
    //     expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

    //     // invalid update governance set bad nonce (too big)
    //     const newValidatorSetArgsBadNonceTwo = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 10003)
    //     const newValidatorSetHashBadNonceTwo = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 10003, "governance")
    //     const signaturesBadNonceTwo = await generateSignatures(bridgeSigners, newValidatorSetHashBadNonceTwo);

    //     const governanceInvalidBadNonceTwo = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadNonceTwo, signaturesBadNonceTwo)
    //     await expect(governanceInvalidBadNonceTwo).to.be.revertedWith("Invalid nonce.")
    //     expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
    //     expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

    //     // invalid update governance unauthorized 
    //     const newValidatorSetArgsBadAuth = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 5)
    //     const newValidatorSetHashBadAuth = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 5, "governance")
    //     const signaturesBadAuth = await generateSignatures(bridgeSigners, newValidatorSetHashBadAuth);

    //     signaturesBadAuth[2].r = signaturesBadAuth[0].r
    //     signaturesBadAuth[2].s = signaturesBadAuth[0].s
    //     signaturesBadAuth[2].v = signaturesBadAuth[0].v


    //     const governanceInvalidBadAuth = governance.updateGovernanceSet(currentValidatorSetArgs, newValidatorSetArgsBadAuth, signaturesBadAuth)
    //     await expect(governanceInvalidBadAuth).to.be.revertedWith("Invalid validator set signature.")
    //     expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHash)
    //     expect(await governance.lastValidatorSetNonce()).to.be.equal(1)

    //     // valid update governance set
    //     const currentValidatorSetArgsValid = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
    //     const newValidatorSetArgsValid = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
    //     const newValidatorSetHashValid = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "governance")
    //     const signaturesValid = await generateSignatures(bridgeSigners, newValidatorSetHashValid);

    //     await governance.updateGovernanceSet(currentValidatorSetArgsValid, newValidatorSetArgsValid, signaturesValid)
    //     expect(await governance.lastValidatorSetHash()).to.be.equal(newValidatorSetHashValid);
    //     expect(await governance.lastValidatorSetNonce()).to.be.equal(2);
    });

    it("upgradeContract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "governance"

        const messageHash = generateArbitraryHash(
            ["uint256", "string", "string", "address", ],
            [1, "upgradeContract", contractName, newContractAddress]
        )
        
        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);
        await governance.upgradeContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await hub.getContract(contractName);
        expect(newAddress).to.be.equal(newContractAddress);

        // upgrade contract invalid zero address
        const upgradeInvalidZeroAddress = governance.upgradeContract(currentValidatorSetArgs, signatures, contractName, ethers.constants.AddressZero)
        await expect(upgradeInvalidZeroAddress).to.be.revertedWith("Invalid address.")

        // upgrade contract invalid bridge
        const upgradeInvalidContractName = governance.upgradeContract(currentValidatorSetArgs, signatures, "bridge", newContractAddress)
        await expect(upgradeInvalidContractName).to.be.revertedWith("Invalid contract name.")

        // upgrade contract invalid hash
        const messageHashInvalid = generateArbitraryHash(
            ["uint256", "string", "string", "address", ],
            [1, "test", contractName, newContractAddress]
        )
        const signaturesInvalidHash = await generateSignatures(bridgeSigners, messageHashInvalid);
        const upgradeInvalidHash = governance.upgradeContract(currentValidatorSetArgs, signaturesInvalidHash, contractName, newContractAddress)
        await expect(upgradeInvalidHash).to.be.revertedWith("Unauthorized.")

        // upgrade contract invalid signatures
        const signaturesInvalidSignatures = await generateSignatures(bridgeSigners, messageHash);
        signaturesInvalidSignatures[2].r = signaturesInvalidSignatures[0].r
        const upgradeInvalidSignatures = governance.upgradeContract(currentValidatorSetArgs, signaturesInvalidSignatures, contractName, newContractAddress)
        await expect(upgradeInvalidSignatures).to.be.revertedWith("Unauthorized.")

        const newAddressCheck = await hub.getContract(contractName);
        expect(newAddressCheck).to.be.equal(newContractAddress);
    });

    it("addContract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "new"

        const messageHash = generateArbitraryHash(
            ["uint256", "string", "string", "address"],
            [1, "addContract", contractName, newContractAddress]
        );

        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);

        // invalid add contract zero address
        const addContractInvalidZeroAddress = governance.addContract(currentValidatorSetArgs, signatures, contractName, ethers.constants.AddressZero)
        await expect(addContractInvalidZeroAddress).to.be.revertedWith("Invalid address.")

        // invalid add contract invalid message ahsh
        const messageHashInvalidMessageHash = generateArbitraryHash(
            ["uint256", "string", "string", "address"],
            [1, "test", contractName, newContractAddress]
        );
        const signaturesInvalidMessageHash = await generateSignatures(bridgeSigners, messageHashInvalidMessageHash);
        const addContractInvalidInvalidMessageHash = governance.addContract(currentValidatorSetArgs, signaturesInvalidMessageHash, contractName, newContractAddress)
        await expect(addContractInvalidInvalidMessageHash).to.be.revertedWith("Unauthorized.")

        // invalid add contract invalid signatures
        let signaturesInvalidSignatures = await generateSignatures(bridgeSigners, messageHash);
        signaturesInvalidSignatures[2].r = signaturesInvalidSignatures[0].r
        signaturesInvalidSignatures[2].s = signaturesInvalidSignatures[0].s
        signaturesInvalidSignatures[2].v = signaturesInvalidSignatures[0].v
        const addContractInvalidInvalidSignatures = governance.addContract(currentValidatorSetArgs, signaturesInvalidSignatures, contractName, newContractAddress)
        await expect(addContractInvalidInvalidSignatures).to.be.revertedWith("Unauthorized.")

        const newAddressInvalid = await hub.getContract(contractName);
        expect(newAddressInvalid).to.be.equal(ethers.constants.AddressZero);

        // valid 
        await governance.addContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await hub.getContract(contractName);
        expect(newAddress).to.be.equal(newContractAddress);
    });

    // it("upgradeBridge testing", async function () {
        
    // })
})