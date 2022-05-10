const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash, generateArbitraryHash, generateBatchTransferHash } = require("./utils/utilities")

describe("Bridge", function () {
    let Hub;
    let Bridge;
    let Token;
    let hub;
    let bridge;
    let token;
    let signers;
    let validatorsAddresses;
    let normalizedPowers;
    let powerThreshold;
    const maxTokenSupply = 1000000000;

    beforeEach(async function () {
        const [_, governanceAddress] = await ethers.getSigners();
        const totalValidators = 121;
        const normalizedThreshold = normalizeThreshold();
        const powers = randomPowers(totalValidators);
        signers = getSigners(totalValidators);
        validatorsAddresses = getSignersAddresses(signers);
        normalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(normalizedThreshold);

        Hub = await ethers.getContractFactory("Hub");
        Bridge = await ethers.getContractFactory("Bridge");
        Token = await ethers.getContractFactory("Token");

        hub = await Hub.deploy();
        const hubAddress = hub.address;
 
        bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, powerThreshold, hubAddress);
        await bridge.deployed();

        token = await Token.deploy("Token", "TKN", maxTokenSupply, bridge.address);
        await token.deployed();

        await hub.addContract("governance", governanceAddress.address);
        await hub.completeContractInit();

        await network.provider.send("evm_mine")
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
        const newTotalValidators = 60;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        const newPowerThreshold = computeThreshold(newNormalizedPowers);

        // due to floating point operation/rounding, threshold is not stable
        expect(newPowerThreshold).to.be.greaterThan(powerThreshold - 10);
        expect(newPowerThreshold).to.be.lessThan(powerThreshold + 10);

        // valid update vaidator set
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signatures = await generateSignatures(signers, newValidatorSetHash);

        await bridge.updateValidatorSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);
        
        await network.provider.send("evm_mine")

        // invalid lower nonce
        const newValidatorSetArgsLowerNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 0)
        const newValidatorSetHashLowerNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signaturesLowerNonce = await generateSignatures(newSigners, newValidatorSetHashLowerNonce);

        const bridgeInvalidLowerNonce = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsLowerNonce, signaturesLowerNonce)
        await expect(bridgeInvalidLowerNonce).to.be.revertedWith("Invalid validatorSetNonce");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid too big nonce 
        const newValidatorSetArgsTooBigNonce = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 10003)
        const newValidatorSetHashTooBigNonce = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 10003, "bridge")
        const signaturesTooBigNonce = await generateSignatures(newSigners, newValidatorSetHashTooBigNonce);

        const bridgeInvalidTooBigNonce = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsTooBigNonce, signaturesTooBigNonce)
        await expect(bridgeInvalidTooBigNonce).to.be.revertedWith("Invalid validatorSetNonce");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid validator set structure
        const newValidatorSetArgsBadStructure = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadStructure = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        const signaturesBadStructure = await generateSignatures(newSigners, newValidatorSetHashBadStructure);

        const bridgeInvalidBadStructure = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadStructure, signaturesBadStructure.splice(1))
        await expect(bridgeInvalidBadStructure).to.be.revertedWith("Mismatch array length.");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid validator set hash
        const newCurrentValidatorSet = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2);
        const newValidatorSetArgsBadSValidatorSetHash = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 3)
        const newValidatorSetHashBadSValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 3, "bridge")
        const signaturesBadSValidatorSetHash = await generateSignatures(newSigners, newValidatorSetHashBadSValidatorSetHash);

        const bridgeInvalidBadSValidatorSetHash = bridge.updateValidatorSet(newCurrentValidatorSet, newValidatorSetArgsBadSValidatorSetHash, signaturesBadSValidatorSetHash)
        await expect(bridgeInvalidBadSValidatorSetHash).to.be.revertedWith("Invalid validatorSetHash.");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid not enough voting power
        const badVotingPower = newNormalizedPowers.map(power => Math.round(power / 10000))
        const newValidatorSetArgsLowVotingPower = generateValidatorSetArgs(newValidatorsAddresses, badVotingPower, 2)
        const newValidatorSetHashLowVotingPower = generateValidatorSetHash(newValidatorsAddresses, badVotingPower, 2, "bridge")
        const signaturesLowVotingPower = await generateSignatures(newSigners, newValidatorSetHashLowVotingPower);

        const bridgeInvalidLowVotingPower = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsLowVotingPower, signaturesLowVotingPower)
        await expect(bridgeInvalidLowVotingPower).to.be.revertedWith("Not enough voting power.");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid signature 1
        const newValidatorSetArgsBadSignature = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadSignature = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        let signaturesBadSignature = await generateSignatures(newSigners, newValidatorSetHashBadSignature);
        signaturesBadSignature[5].r = signaturesBadSignature[0].r
        signaturesBadSignature[5].s = signaturesBadSignature[0].s
        signaturesBadSignature[5].v = signaturesBadSignature[0].v

        const bridgeInvalidBadSignature = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadSignature, signaturesBadSignature)
        await expect(bridgeInvalidBadSignature).to.be.revertedWith("Invalid validator set signature.");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // invalid signature 2
        const newValidatorSetArgsBadSignature2 = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashBadSignature2 = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        let signaturesBadSignature2 = await generateSignatures(newSigners, newValidatorSetHashBadSignature2);
        const badCheckpoint = generateValidatorSetHash([newValidatorsAddresses[0]], [newNormalizedPowers[0]], 2, "bridge")
        const badSignature = await generateSignatures([newSigners[0]], badCheckpoint)
        signaturesBadSignature2[5] = badSignature.pop()

        const bridgeInvalidBadSignature2 = bridge.updateValidatorSet(newValidatorSetArgs, newValidatorSetArgsBadSignature2, signaturesBadSignature2)
        await expect(bridgeInvalidBadSignature2).to.be.revertedWith("Invalid validator set signature.");
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        // valid update validator set
        const updateValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const updateValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        const updateSignatures = await generateSignatures(newSigners, updateValidatorSetHash);

        await bridge.updateValidatorSet(newValidatorSetArgs, updateValidatorSetArgs, updateSignatures)
        expect(await bridge.validatorSetHash()).to.be.equal(updateValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(2);
    });

    it.only("Update validate set (max number of validators) testing", async function () {
        const maxTotalValidators = 121;
        const newPowers = randomPowers(maxTotalValidators);
        const newSigners = getSigners(maxTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);
        const newPowerThreshold = computeThreshold(newNormalizedPowers);

        // due to floating point operation/rounding, threshold is not stable
        expect(newPowerThreshold).to.be.greaterThan(powerThreshold - 10);
        expect(newPowerThreshold).to.be.lessThan(powerThreshold + 10);

        // valid update vaidator set
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)

        console.log(currentValidatorSetArgs.validators.length)
        console.log(currentValidatorSetArgs.powers.length)

        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signatures = await generateSignatures(signers, newValidatorSetHash);

        await bridge.updateValidatorSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHash);
        expect(await bridge.validatorSetNonce()).to.be.equal(1);

        await network.provider.send("evm_mine")

        const currentValidatorSetArgsTwo = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetArgsTwo = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 2)
        const newValidatorSetHashTwo = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 2, "bridge")
        const signaturesTwo = await generateSignatures(newSigners, newValidatorSetHashTwo);

        console.log(currentValidatorSetArgsTwo.validators.length)
        console.log(currentValidatorSetArgsTwo.powers.length)

        await bridge.updateValidatorSet(currentValidatorSetArgsTwo, newValidatorSetArgsTwo, signaturesTwo)
        expect(await bridge.validatorSetHash()).to.be.equal(newValidatorSetHashTwo);
        expect(await bridge.validatorSetNonce()).to.be.equal(2);
    })

    it("Authorize testing", async function () {
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const messageHash = generateArbitraryHash(["uint256", "string"], [1, "test"])
        const signatures = await generateSignatures(signers, messageHash);

        const result = await bridge.authorize(currentValidatorSetArgs, signatures, messageHash)
        expect(result).to.be.equal(true)

        // invalid signatures
        const signaturesBadSignature = await generateSignatures(signers, messageHash);
        signaturesBadSignature[2].r = signaturesBadSignature[0].r
        signaturesBadSignature[2].s = signaturesBadSignature[0].s
        signaturesBadSignature[2].v = signaturesBadSignature[0].v

        const resultInvalid = await bridge.authorize(currentValidatorSetArgs, signaturesBadSignature, messageHash)
        expect(resultInvalid).to.be.equal(false)

        // invalid array length
        const resultInvalidMismatchLength = bridge.authorize(currentValidatorSetArgs, [signatures[0]], messageHash)
        await expect(resultInvalidMismatchLength).to.be.revertedWith("Mismatch array length.")

        // invalid validator set hash
        const currentValidatorSetArgsInvalid = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 1)
        const resultInvalidValidatoSetHash = bridge.authorize(currentValidatorSetArgsInvalid, signatures, messageHash)
        await  expect(resultInvalidValidatoSetHash).to.be.revertedWith("Invalid validatorSetHash.")
    });

    it("transferToERC testing", async function () {
        const toAddresses = [ethers.Wallet.createRandom().address]
        const fromAddresses = [token.address]
        const amounts = [10000]
        const validatorSetHash = await bridge.validatorSetHash();
        const batchNonce = 1;

        const preBridgeBalance = await token.balanceOf(bridge.address);
        expect(preBridgeBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))
        
        // valid transfer
        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const messageHash = generateBatchTransferHash(
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce,
            validatorSetHash,
            "transfer"
        );
        const signatures = await generateSignatures(signers, messageHash);

        await bridge.transferToERC(
            currentValidatorSetArgs,
            signatures,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce
        );
        const balance = await token.balanceOf(toAddresses[0]);
        expect(balance).to.be.equal(ethers.BigNumber.from(amounts[0]))

        const balanceBridge = await token.balanceOf(bridge.address);
        expect(balanceBridge).to.be.equal(ethers.BigNumber.from(maxTokenSupply - amounts[0]))

        // invalid transfer bad nonce (too little)
        const badNonceInvalid = 0;
        const messageHashInvalid = generateBatchTransferHash(
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce,
            validatorSetHash,
            "transfer"
        );
        const signaturesInvalid = await generateSignatures(signers, messageHashInvalid);
        const bridgeTransferInvalidBadNonce = bridge.transferToERC(
            currentValidatorSetArgs,
            signaturesInvalid,
            fromAddresses,
            toAddresses,
            amounts,
            badNonceInvalid
        );
        await expect(bridgeTransferInvalidBadNonce).to.be.revertedWith("Invalid nonce.")

        // invalid transfer bad nonce (too big)
        const badNonceInvalidTooBig = 12020;
        const messageHashInvalidTooBig = generateBatchTransferHash(
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce,
            validatorSetHash,
            "transfer"
        );
        const signaturesInvalidTooBig = await generateSignatures(signers, messageHashInvalidTooBig);
        const bridgeTransferInvalidBadNonceTooBig = bridge.transferToERC(
            currentValidatorSetArgs,
            signaturesInvalidTooBig,
            fromAddresses,
            toAddresses,
            amounts,
            badNonceInvalidTooBig
        );
        await expect(bridgeTransferInvalidBadNonceTooBig).to.be.revertedWith("Invalid nonce.")

        // invalid transfer mismatch array lengths
        const bridgeTransferInvalidMismatchLengths = bridge.transferToERC(
            currentValidatorSetArgs,
            [signatures[0]],
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce+1
        );
        await expect(bridgeTransferInvalidMismatchLengths).to.be.revertedWith("Mismatch array length.")

        // invalid transfer bad validator set hash
        const currentValidatorSetArgsInvalidValidatorSetHash = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 1)
        const bridgeTransferInvalidValidatorSetHash = bridge.transferToERC(
            currentValidatorSetArgsInvalidValidatorSetHash,
            signatures,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce+1
        );
        await expect(bridgeTransferInvalidValidatorSetHash).to.be.revertedWith("Invalid validatorSetHash.")

        // invalid transfer bad batch transfer
        const bridgeTransferInvalidBatchTransfer = bridge.transferToERC(
            currentValidatorSetArgs,
            signatures,
            [],
            toAddresses,
            amounts,
            batchNonce+1
        );
        await expect(bridgeTransferInvalidBatchTransfer).to.be.revertedWith("Invalid batch.")

        // invalid transfer bad batch signature
        const signaturesInvalidBatchSignatures = await generateSignatures(signers, messageHash);
        signaturesInvalidBatchSignatures[5].r = signaturesInvalidBatchSignatures[0].r

        const bridgeTransferInvalidBatchSignatures = bridge.transferToERC(
            currentValidatorSetArgs,
            signaturesInvalidBatchSignatures,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce + 1
        );
        await expect(bridgeTransferInvalidBatchSignatures).to.be.revertedWith("Invalid validator set signature.")

        // valid transfer 2
        const messageHashValid = generateBatchTransferHash(
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce + 1,
            validatorSetHash,
            "transfer"
        );
        const signaturesValid = await generateSignatures(signers, messageHashValid);

        await bridge.transferToERC(
            currentValidatorSetArgs,
            signaturesValid,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce + 1
        );
        const balanceValid = await token.balanceOf(toAddresses[0]);
        expect(balanceValid).to.be.equal(ethers.BigNumber.from(amounts[0] + amounts[0]))

        const balanceBridgeValid = await token.balanceOf(bridge.address);
        expect(balanceBridgeValid).to.be.equal(ethers.BigNumber.from(maxTokenSupply - amounts[0] - amounts[0]))
    });

    it("transferToNamada testing", async function () {
        const [newWallet] = await ethers.getSigners()
        const toAddresses = [newWallet.address]
        const fromAddresses = [token.address]
        const amounts = [10000]
        const validatorSetHash = await bridge.validatorSetHash();
        const batchNonce = 2;
        const transferAmount = 900;

        const preBridgeBalance = await token.balanceOf(bridge.address);
        expect(preBridgeBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))

        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const messageHash = generateBatchTransferHash(
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce,
            validatorSetHash,
            "transfer"
        );
        const signatures = await generateSignatures(signers, messageHash);

        await bridge.transferToERC(
            currentValidatorSetArgs,
            signatures,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce
        );
        const balance = await token.balanceOf(newWallet.address);
        expect(balance).to.be.equal(ethers.BigNumber.from(amounts[0]))

        const balanceBridge = await token.balanceOf(bridge.address);
        expect(balanceBridge).to.be.equal(ethers.BigNumber.from(preBridgeBalance - amounts[0]))

        await token.approve(bridge.address, transferAmount)

        await bridge.connect(newWallet).transferToNamada(
            fromAddresses,
            [transferAmount]
        );

        // transfer invalid batch
        const trasferInvalidBatch =  bridge.connect(newWallet).transferToNamada(
            fromAddresses,
            []
        );
        await expect(trasferInvalidBatch).to.be.revertedWith("Invalid batch.");

        // transfer invalid insufficient amount
        const trasferInvalidInsufficientAmount =  bridge.connect(newWallet).transferToNamada(
            fromAddresses,
            [1000]
        );
        await expect(trasferInvalidInsufficientAmount).to.be.revertedWith("ERC20: insufficient allowance");
    });
})