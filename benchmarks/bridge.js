const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateBatchTransferHash } = require("../test/utils/utilities")

const trasferToERC20 = async function (index) {
    const [_, governanceAddress, anotherAddress] = await ethers.getSigners();
    const totalValidators = 125;
    const normalizedThreshold = normalizeThreshold();
    const powers = randomPowers(totalValidators);

    const signers = getSigners(totalValidators);
    const validatorsAddresses = getSignersAddresses(signers);
    const normalizedPowers = normalizePowers(powers);
    const powerThreshold = computeThreshold(normalizedThreshold);

    const Proxy = await ethers.getContractFactory("Proxy");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Token = await ethers.getContractFactory("Token");
    const Vault = await ethers.getContractFactory("Vault");

    const proxy = await Proxy.deploy();
    await proxy.deployed();

    const vault = await Vault.deploy(proxy.address)
    await vault.deployed()

    const token = await Token.deploy("Token", "TKN", [1000000000], [vault.address]);
    await token.deployed();

    const bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers, [token.address], [1000000000], powerThreshold, proxy.address);
    await bridge.deployed();

    await proxy.addContract("governance", governanceAddress.address);
    await proxy.addContract("vault", vault.address);
    await proxy.addContract("bridge", bridge.address);
    await proxy.completeContractInit();

    await network.provider.send("evm_mine")

    const toAddresses = [...Array(index).keys()].map(_ => ethers.Wallet.createRandom().address)
    const fromAddresses = [...Array(index).keys()].map(_ => token.address)
    const amounts = [...Array(index).keys()].map(_ => 10)
    const validatorSetHash = await bridge.currentValidatorSetHash();
    const batchNonce = 1;

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

    try {
        const tx = await bridge.connect(anotherAddress).transferToERC(
            currentValidatorSetArgs,
            signatures,
            fromAddresses,
            toAddresses,
            amounts,
            batchNonce
        );

        const receipt = await tx.wait()
        const txGas = Number(receipt.gasUsed);

        return [index, txGas]
    } catch (e) {
        throw `Error execution transferToERC: ${e}`;
    }
}

exports.trasferToERC20 = trasferToERC20;