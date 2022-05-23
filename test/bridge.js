const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { getContractAddress } = require('@ethersproject/address')
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateArbitraryHash, generateBatchTransferHash } = require("./utils/utilities")

describe("Bridge", function () {
    let Hub;
    let Bridge;
    let Token;
    let hub;
    let bridge;
    let token;
    let notWhitelistedToken;
    let signers;
    let validatorsAddresses;
    let normalizedPowers;
    let powerThreshold;
    let governanceAddr;
    const maxTokenSupply = 15000;

    beforeEach(async function () {
        const [owner] = await ethers.getSigners()
        const [_, governanceAddress] = await ethers.getSigners();
        const totalValidators = 125;
        const normalizedThreshold = normalizeThreshold();
        const powers = randomPowers(totalValidators);

        governanceAddr = governanceAddress
        signers = getSigners(totalValidators);
        validatorsAddresses = getSignersAddresses(signers);
        normalizedPowers = normalizePowers(powers);
        powerThreshold = computeThreshold(normalizedThreshold);

        Hub = await ethers.getContractFactory("Hub");
        Bridge = await ethers.getContractFactory("Bridge");
        Token = await ethers.getContractFactory("Token");

        hub = await Hub.deploy();
        const hubAddress = hub.address;

        const transactionCount = await owner.getTransactionCount()
        const futureTokenAddress = getContractAddress({
            from: owner.address,
            nonce: transactionCount + 1
        })
 
        bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [futureTokenAddress], [14900], powerThreshold, hubAddress);
        await bridge.deployed();

        token = await Token.deploy("Token", "TKN", maxTokenSupply, bridge.address);
        await token.deployed();

        notWhitelistedToken = await Token.deploy("Token2", "TKN2", maxTokenSupply, bridge.address);
        await notWhitelistedToken.deployed();

        await hub.addContract("governance", governanceAddr.address);
        await hub.addContract("bridge", bridge.address);
        await hub.completeContractInit();

        await network.provider.send("evm_mine")
    });

    it("Initialize contract testing", async function () {
        // invalid threshold power 
        const bridgeInvalidPowerThreshold = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [], [], powerThreshold * 2, hub.address);
        await expect(bridgeInvalidPowerThreshold).to.be.revertedWith("Invalid voting power threshold.")

        // invalid threshold power 2
        const bridgeInvalidPowerThresholdTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers.map(p => Math.floor(p/2)), [], [], powerThreshold, hub.address);
        await expect(bridgeInvalidPowerThresholdTwo).to.be.revertedWith("Invalid voting power threshold.")

        // invalid token cap length
        const bridgeInvalidTokenCapLength = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [], [10], powerThreshold, hub.address);
        await expect(bridgeInvalidTokenCapLength).to.be.revertedWith("Invalid token whitelist.")

        // mismatch array length 
        const bridgeInvalidArrayLength = Bridge.deploy(1, validatorsAddresses, [1], validatorsAddresses, [1], [], [], powerThreshold, hub.address);
        await expect(bridgeInvalidArrayLength).to.be.revertedWith("Mismatch array length.");

        // mismatch array length  2
        const bridgeInvalidArrayLengthTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, [1], [], [], powerThreshold, hub.address);
        await expect(bridgeInvalidArrayLengthTwo).to.be.revertedWith("Mismatch array length.");
    });

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

        // // invalid array length
        const resultInvalidMismatchLength = bridge.authorize(currentValidatorSetArgs, [signatures[0]], messageHash)
        await expect(resultInvalidMismatchLength).to.be.reverted;

        // invalid validator set hash
        const currentValidatorSetArgsInvalid = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 1)
        const resultInvalidValidatoSetHash = bridge.authorize(currentValidatorSetArgsInvalid, signatures, messageHash)
        // await  expect(resultInvalidValidatoSetHash).to.be.revertedWith("Invalid validatorSetHash.")
        await expect(resultInvalidValidatoSetHash).to.be.reverted;
    });

    it("transferToERC20 testing", async function () {
        const toAddresses = [ethers.Wallet.createRandom().address]
        const fromAddresses = [token.address]
        const amounts = [200]
        const validatorSetHash = await bridge.currentValidatorSetHash();
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
        await expect(bridgeTransferInvalidValidatorSetHash).to.be.revertedWith("Invalid currentValidatorSetHash.")

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
        const toAddresses = [newWallet.address, newWallet.address]
        const fromAddresses = [token.address, notWhitelistedToken.address]
        const amounts = [5000, 5000]
        const validatorSetHash = await bridge.currentValidatorSetHash();
        const batchNonce = 2;
        const transferAmount = 500;
        const tos = ["anamadaAddress"]

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

        await token.approve(bridge.address, 10000)
        await notWhitelistedToken.approve(bridge.address, 10000)

        await bridge.connect(newWallet).transferToNamada(
            [token.address],
            [4900],
            tos
        );
        
        // invalid due to non-whitelisted token
        const trasferInvalidNonWhitelistedToken = bridge.connect(newWallet).transferToNamada(
            [notWhitelistedToken.address],
            [transferAmount],
            tos
        );
        await expect(trasferInvalidNonWhitelistedToken).to.be.revertedWith("Token is not whitelisted.")

        const transferInvalidTokenCap = bridge.connect(newWallet).transferToNamada(
            [token.address],
            [1],
            tos
        );

        await expect(transferInvalidTokenCap).to.be.revertedWith("Token cap reached.")
        const balanceWallet = await token.balanceOf(newWallet.address);
        expect(balance - 4900).to.be.equal(balanceWallet)

        // transfer invalid batch
        const trasferInvalidBatch =  bridge.connect(newWallet).transferToNamada(
            fromAddresses,
            [],
            tos
        );
        await expect(trasferInvalidBatch).to.be.revertedWith("Invalid batch.");

        // transfer invalid insufficient amount
        const trasferInvalidInsufficientAmount =  bridge.connect(newWallet).transferToNamada(
            [token.address],
            [1000000],
            tos
        );
        await expect(trasferInvalidInsufficientAmount).to.be.revertedWith("ERC20: insufficient allowance");
    });

    it("withdraw testing", async function () {
        // withdraw invalid caller
        const withdrawInvalid = bridge.withdraw([token.address], ethers.Wallet.createRandom().address)
        await expect(withdrawInvalid).to.be.revertedWith("Invalid caller.")

        // withdraw valid
        await bridge.connect(governanceAddr).withdraw([token.address], ethers.Wallet.createRandom().address)
        const balanceTokenOneAfter = await token.balanceOf(token.address);
        expect(balanceTokenOneAfter).to.be.equal(0)  
    })
})