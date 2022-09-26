const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { getContractAddress } = require('@ethersproject/address')
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateArbitraryHash, generateBatchTransferHash } = require("./utils/utilities")

describe("Vault", function () {
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

    it("Invalid caller testing", async function () {
        const [_, caller] = await ethers.getSigners()
        const invalidCaller = vault.connect(caller).batchTransferToERC20([])

        await expect(invalidCaller).to.be.revertedWith("Invalid caller.");
    })

})