const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateArbitraryHash, generateBatchTransferHash } = require("./utils/utilities")

describe("Bridge", function () {
    let Proxy;
    let Bridge;
    let Token;
    let proxy;
    let vault;
    let bridge;
    let token;
    let notWhitelistedToken;
    let signers;
    let validatorsAddresses;
    let normalizedPowers;
    let powerThreshold;
    let governanceAddr;
    const maxTokenSupply = 15000;
    const walletTokenAmount = 6000;

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

        Proxy = await ethers.getContractFactory("Proxy");
        Bridge = await ethers.getContractFactory("Bridge");
        Token = await ethers.getContractFactory("Token");
        Vault = await ethers.getContractFactory("Vault");

        proxy = await Proxy.deploy();

        vault = await Vault.deploy(proxy.address);
        await vault.deployed();

        token = await Token.deploy("Token", "TKN", [maxTokenSupply, walletTokenAmount], [vault.address, owner.address]);
        await token.deployed();

        notWhitelistedToken = await Token.deploy("Token2", "TKN2", [maxTokenSupply, walletTokenAmount], [vault.address, owner.address]);
        await notWhitelistedToken.deployed();

        bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [token.address], [14900], powerThreshold, proxy.address);
        await bridge.deployed();

        await proxy.addContract("governance", governanceAddr.address);
        await proxy.addContract("bridge", bridge.address);
        await proxy.addContract("vault", vault.address);
        await proxy.completeContractInit();

        await network.provider.send("evm_mine")
    });

    it("Initialize contract testing", async function () {
        // invalid threshold power 
        const bridgeInvalidPowerThreshold = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [], [], powerThreshold * 2, proxy.address);
        await expect(bridgeInvalidPowerThreshold).to.be.revertedWith("Invalid voting power threshold.")

        // invalid threshold power 2
        const bridgeInvalidPowerThresholdTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers.map(p => Math.floor(p/2)), [], [], powerThreshold, proxy.address);
        await expect(bridgeInvalidPowerThresholdTwo).to.be.revertedWith("Invalid voting power threshold.")

        // invalid token cap length
        const bridgeInvalidTokenCapLength = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [], [10], powerThreshold, proxy.address);
        await expect(bridgeInvalidTokenCapLength).to.be.revertedWith("Invalid token whitelist.")

        // mismatch array length 
        const bridgeInvalidArrayLength = Bridge.deploy(1, validatorsAddresses, [1], validatorsAddresses, [1], [], [], powerThreshold, proxy.address);
        await expect(bridgeInvalidArrayLength).to.be.revertedWith("Mismatch array length.");

        // mismatch array length  2
        const bridgeInvalidArrayLengthTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, [1], [], [], powerThreshold, proxy.address);
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

        const intialVaultBalance = await token.balanceOf(vault.address);
        expect(intialVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))
        
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

        const postVaultBalance = await token.balanceOf(vault.address);
        expect(postVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply - amounts[0]))

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
        const postWalletBalance = await token.balanceOf(toAddresses[0]);
        expect(postWalletBalance).to.be.equal(ethers.BigNumber.from(amounts[0] * 2))

        const postPostVaultBalance = await token.balanceOf(vault.address);
        expect(postPostVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply - amounts[0] * 2))
    });

    it("transferToNamada testing", async function () {
        const [newWallet, randomAddress] = await ethers.getSigners()
        const numberOfConfirmations = 100;

        const preBridgeBalance = await token.balanceOf(vault.address);
        expect(preBridgeBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))

        const preNewWalletTokenBalance = await token.balanceOf(newWallet.address)
        expect(preNewWalletTokenBalance).to.be.equal(ethers.BigNumber.from(walletTokenAmount))

        const transfers = [...Array(2).keys()].map(_ => {
            return {
                'from': token.address,
                'to': 'anamadaAddress',
                'amount': 2950
            }
        })
        
        // authorize the bridge to move the tokens
        await token.connect(newWallet).approve(bridge.address, 6000)

        await bridge.connect(newWallet).transferToNamada(
            transfers,
            numberOfConfirmations
        );

        const updatedNewWalletbalance = await token.balanceOf(newWallet.address);
        expect(updatedNewWalletbalance).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900))

        const updatedVaultBalance = await token.balanceOf(vault.address);
        expect(updatedVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply + 5900))

        const whitelistLeftAmount = await bridge.getWhitelistAmountFor(token.address);
        expect(whitelistLeftAmount).to.be.equal(ethers.BigNumber.from(14900 - 5900))
        
        // invalid due to non-whitelisted token
        // will not revert but no token transfer happen
        await bridge.connect(newWallet).transferToNamada(
            [{
                'from': notWhitelistedToken.address,
                'to': 'anamadaAddress',
                'amount': 2950
            }],
            numberOfConfirmations
        );

        const nonWhitelistedTokenBalance = await notWhitelistedToken.balanceOf(newWallet.address);
        expect(nonWhitelistedTokenBalance).to.be.equal(ethers.BigNumber.from(walletTokenAmount))
        
        // invalid  due to non enough funds
        await bridge.connect(newWallet).transferToNamada(
            [{
                'from': token.address,
                'to': 'anamadaAddress',
                'amount': 101
            }],
            numberOfConfirmations
        );
        
        const updatedNewWalletbalanceAfterInvalidTokenCap = await token.balanceOf(newWallet.address);
        expect(updatedNewWalletbalanceAfterInvalidTokenCap).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900))

        const updatedVaultBalanceTwo = await token.balanceOf(vault.address);
        expect(updatedVaultBalanceTwo).to.be.equal(ethers.BigNumber.from(maxTokenSupply + 5900))

        const nonWhitelistedTokenPreBalance = await notWhitelistedToken.balanceOf(randomAddress.address);
        
        // partially valid 
        await bridge.connect(newWallet).transferToNamada(
            [{
                'from': token.address,
                'to': 'anamadaAddress',
                'amount': 50
            },{
                'from': notWhitelistedToken.address,
                'to': 'randomAddress',
                'amount': 100
            }],
            numberOfConfirmations
        );

        const updatedNewWalletbalanceAfterValidTrasfer = await token.balanceOf(newWallet.address);
        expect(updatedNewWalletbalanceAfterValidTrasfer).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900 - 50))

        const updatedVaultBalanceAfterTransfer = await token.balanceOf(vault.address);
        expect(updatedVaultBalanceAfterTransfer).to.be.equal(ethers.BigNumber.from(maxTokenSupply + 5900 + 50))

        const nonWhitelistedTokenPostBalance = await notWhitelistedToken.balanceOf(randomAddress.address);
        expect(nonWhitelistedTokenPostBalance).to.be.equal(nonWhitelistedTokenPreBalance)
    });
})