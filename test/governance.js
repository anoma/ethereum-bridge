const { expect } = require("chai");
const { ethers } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash } = require("./utils/utilities")

describe("Governance", function () {
    let Proxy;
    let Governance;
    let Bridge;
    let proxy;
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
        const totalValidators = 125;
        const normalizedThreshold = normalizeThreshold();
        const powers = randomPowers(totalValidators);
        bridgeSigners = getSigners(totalValidators);
        bridgeValidatorsAddresses = getSignersAddresses(bridgeSigners);
        bridgeNormalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(normalizedThreshold);

        governanceSigners = getSigners(totalValidators);
        governanceValidatorsAddresses = getSignersAddresses(governanceSigners);
        governanceNormalizedPowers = normalizePowers(powers);

        expect(powerThreshold).to.be.greaterThan(computeThreshold(normalizedThreshold) - 10);
        expect(powerThreshold).to.be.lessThan(computeThreshold(normalizedThreshold) + 10);

        Proxy = await ethers.getContractFactory("Proxy");
        Governance = await ethers.getContractFactory("Governance");
        Bridge = await ethers.getContractFactory("Bridge");

        proxy = await Proxy.deploy();
        const proxyAddress = proxy.address;

        governance = await Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold, proxyAddress);
        await governance.deployed();

        bridge = await Bridge.deploy(1, bridgeValidatorsAddresses, bridgeNormalizedPowers, bridgeValidatorsAddresses, bridgeNormalizedPowers, [], [], powerThreshold, proxyAddress);
        await bridge.deployed();

        await proxy.addContract("governance", governance.address);
        await proxy.addContract("bridge", bridge.address);

        await proxy.completeContractInit();

        await network.provider.send("evm_mine")
    });

    it("Initialize contract testing", async function () {
        // invalid threshold power 
        const governanceInvalidPowerThreshold = Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers, powerThreshold * 2, proxy.address);
        await expect(governanceInvalidPowerThreshold).to.be.revertedWith("Invalid voting power threshold.")

        // invalid threshold power 2 
        const governanceInvalidPowerThresholdTwo = Governance.deploy(1, governanceValidatorsAddresses, governanceNormalizedPowers.map(p => Math.floor(p / 2)), powerThreshold, proxy.address);
        await expect(governanceInvalidPowerThresholdTwo).to.be.revertedWith("Invalid voting power threshold.")

        // mismatch array length 
        const governanceInvalidArrayLength = Governance.deploy(1, governanceValidatorsAddresses, [1], powerThreshold, proxy.address);
        await expect(governanceInvalidArrayLength).to.be.revertedWith("Mismatch array length.");
    });

    it("updateValidatorsSet", async function () {
        const newTotalValidators = 125;
        
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        
        const newPowerThreshold = computeThreshold(newNormalizedPowers);
        expect(newPowerThreshold).to.be.greaterThan(powerThreshold - 10);
        expect(newPowerThreshold).to.be.lessThan(powerThreshold + 10);
        
        const currentBridgeValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        
        const newBridgeValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        
        const newGovernanceValidatorSetHash = generateValidatorSetHash(governanceValidatorsAddresses, governanceNormalizedPowers, 1, "governance")

        const messageHash = generateArbitraryHash(
            ["uint8", "string", "bytes32", "bytes32", "uint256"],
            [1, "updateValidatorsSet", newBridgeValidatorSetHash, newGovernanceValidatorSetHash, 2]
        )

        const signatures = await generateSignatures(bridgeSigners, messageHash);

        await governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signatures, 2)
        expect(await governance.validatorSetHash()).to.be.equal(newGovernanceValidatorSetHash)
        expect(await governance.validatorSetNonce()).to.be.equal(2)
        expect(await bridge.nextValidatorSetHash()).to.be.equal(newBridgeValidatorSetHash)

        // invalid bad signatures length
        const signaturesInvalid = await generateSignatures(bridgeSigners, messageHash);
        const governanceInvalidBadSignatureLength = governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, [signaturesInvalid[0]], 3)
        await expect(governanceInvalidBadSignatureLength).to.be.revertedWith("Malformed input.")

        // invalid bad validator input
        const currentBridgeValidatorSetArgsInvalid = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        currentBridgeValidatorSetArgsInvalid.validators = [currentBridgeValidatorSetArgsInvalid.validators[0]]
        const governanceInvalidValidatorSet = governance.updateValidatorsSet(currentBridgeValidatorSetArgsInvalid, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, [signaturesInvalid[0]], 3)
        await expect(governanceInvalidValidatorSet).to.be.revertedWith("Malformed input.")

        // invalid signature message
        const messageHashInvalid = generateArbitraryHash(
            ["uint8", "string", "bytes32", "bytes32", "uint256"],
            [2, "updateValidatorsSet", newBridgeValidatorSetHash, newGovernanceValidatorSetHash, 2]
        )
        const signaturesInvalidMessageHash = await generateSignatures(bridgeSigners, messageHashInvalid);
        const governanceInvalidValidatorSignatureMessageHash = governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signaturesInvalidMessageHash, 3)
        await expect(governanceInvalidValidatorSignatureMessageHash).to.be.revertedWith("Unauthorized.")

        // invalid signatures
        const signaturesInvalidBad = await generateSignatures(bridgeSigners, messageHash);
        signaturesInvalidBad[3].s = signaturesInvalidBad[0].s;

        const governanceInvalidValidatorSignatureBad = governance.updateValidatorsSet(currentBridgeValidatorSetArgs, newBridgeValidatorSetHash, newGovernanceValidatorSetHash, signaturesInvalidBad, 3)
        await expect(governanceInvalidValidatorSignatureBad).to.be.revertedWith("Unauthorized.")
    })

    it("upgradeContract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "governance"

        const messageHash = generateArbitraryHash(
            ["uint8", "string", "string", "address",],
            [1, "upgradeContract", contractName, newContractAddress]
        )

        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);
        await governance.upgradeContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await proxy.getContract(contractName);
        expect(newAddress).to.be.equal(newContractAddress);

        // upgrade contract invalid zero address
        const upgradeInvalidZeroAddress = governance.upgradeContract(currentValidatorSetArgs, signatures, contractName, ethers.constants.AddressZero)
        await expect(upgradeInvalidZeroAddress).to.be.revertedWith("Invalid address.")

        // upgrade contract invalid bridge
        const upgradeInvalidContractName = governance.upgradeContract(currentValidatorSetArgs, signatures, "bridge", newContractAddress)
        await expect(upgradeInvalidContractName).to.be.revertedWith("Invalid contract name.")

        // upgrade contract invalid hash
        const messageHashInvalid = generateArbitraryHash(
            ["uint8", "string", "string", "address",],
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

        const newAddressCheck = await proxy.getContract(contractName);
        expect(newAddressCheck).to.be.equal(newContractAddress);
    });

    it("addContract testing", async function () {
        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "new"

        const messageHash = generateArbitraryHash(
            ["uint8", "string", "string", "address"],
            [1, "addContract", contractName, newContractAddress]
        );

        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);

        // invalid add contract zero address
        const addContractInvalidZeroAddress = governance.addContract(currentValidatorSetArgs, signatures, contractName, ethers.constants.AddressZero)
        await expect(addContractInvalidZeroAddress).to.be.revertedWith("Invalid address.")

        // invalid add contract invalid message ahsh
        const messageHashInvalidMessageHash = generateArbitraryHash(
            ["uint8", "string", "string", "address"],
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

        const newAddressInvalid = await proxy.getContract(contractName);
        expect(newAddressInvalid).to.be.equal(ethers.constants.AddressZero);

        // valid 
        await governance.addContract(currentValidatorSetArgs, signatures, contractName, newContractAddress)

        const newAddress = await proxy.getContract(contractName);
        expect(newAddress).to.be.equal(newContractAddress);
    });

    it("upgradeBridge testing", async function () {

        const newContractAddress = ethers.Wallet.createRandom().address
        const contractName = "bridge"

        const messageHash = generateArbitraryHash(
            ["uint8", "string", "string", "address"],
            [1, "upgradeBridgeContract", contractName, newContractAddress]
        )

        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const signatures = await generateSignatures(bridgeSigners, messageHash);

        // invalid bridge upgrade zero address
        const bridgeUpgradeInvalidZeroAddress = governance.upgradeBridgeContract(currentValidatorSetArgs, signatures, ethers.constants.AddressZero)
        await expect(bridgeUpgradeInvalidZeroAddress).to.be.revertedWith("Invalid address.")

        // invalid bridge upgrade bad message hash
        const messageHashInvalid = generateArbitraryHash(
            ["uint8", "string", "string", "address"],
            [1, "upgradeBridgeContractInvalid", contractName, newContractAddress]
        )
        const signaturesInvalidMessageHash = await generateSignatures(bridgeSigners, messageHashInvalid);
        const bridgeUpgradeInvalidMessageHash = governance.upgradeBridgeContract(currentValidatorSetArgs, signaturesInvalidMessageHash, newContractAddress)
        await expect(bridgeUpgradeInvalidMessageHash).to.be.revertedWith("Unauthorized.")

        // invalid bridge upgrade bad signatures
        const signaturesInvalid = await generateSignatures(bridgeSigners, messageHash);
        signaturesInvalid[3].r = signaturesInvalid[0].r
        signaturesInvalid[3].s = signaturesInvalid[0].s
        signaturesInvalid[3].v = signaturesInvalid[0].v
        const bridgeUpgradeInvalidSignatures = governance.upgradeBridgeContract(currentValidatorSetArgs, signaturesInvalid, newContractAddress)
        await expect(bridgeUpgradeInvalidSignatures).to.be.revertedWith("Unauthorized.")

        // valid upgrade bridge
        await governance.upgradeBridgeContract(currentValidatorSetArgs, signatures, newContractAddress)
    })

    it("updateBridgeWhitelist testing", async function () {
        const randomTokenAddress = ethers.Wallet.createRandom().address

        const currentValidatorSetArgs = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        const messageHash = generateArbitraryHash(
            ["uint8", "string", "address[]", "uint256[]", "uint256"],
            [1, "updateBridgeWhitelist", [randomTokenAddress], [10000], 0]
        )
        const signatures = await generateSignatures(bridgeSigners, messageHash)

        // updateBridgeWhitelist valid
        await governance.updateBridgeWhitelist(currentValidatorSetArgs, [randomTokenAddress], [10000], signatures)

        // invalid malformed input
        const currentValidatorSetArgsInvalid = generateValidatorSetArgs(bridgeValidatorsAddresses, bridgeNormalizedPowers, 0)
        currentValidatorSetArgsInvalid.validators = []
        const updateBridgeWhitelistInvalidMalformedInput = governance.updateBridgeWhitelist(currentValidatorSetArgsInvalid, [randomTokenAddress], [10000], signatures)
        await expect(updateBridgeWhitelistInvalidMalformedInput).to.be.revertedWith('Malformed input.')

        // invalid bad signed message
        const messageHashInvalid = generateArbitraryHash(
            ["uint8", "string", "address[]", "uint256[]", "uint256"],
            [1, "updateBridgeWhitelist", [randomTokenAddress], [10000], 4]
        )
        const signaturesInvalid = await generateSignatures(bridgeSigners, messageHashInvalid)
        const updateBridgeWhitelistInvalidSignatureMessage = governance.updateBridgeWhitelist(currentValidatorSetArgs, [randomTokenAddress], [10000], signaturesInvalid)
        await expect(updateBridgeWhitelistInvalidSignatureMessage).to.be.revertedWith('Unauthorized.')
    })
})