const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateBatchTransferHash } = require("../test/utils/utilities")

const trasferToERC20 = async function (index) {
    const [_, governanceAddress] = await ethers.getSigners();
    const totalValidators = 125;
    const normalizedThreshold = normalizeThreshold();
    const powers = randomPowers(totalValidators);

    const signers = getSigners(totalValidators);
    const validatorsAddresses = getSignersAddresses(signers);
    const normalizedPowers = normalizePowers(powers);
    const powerThreshold = computeThreshold(normalizedThreshold);

    const Hub = await ethers.getContractFactory("Hub");
    const Bridge = await ethers.getContractFactory("Bridge");
    const Token = await ethers.getContractFactory("Token");

    const hub = await Hub.deploy();
    const hubAddress = hub.address;

    const bridge = await Bridge.deploy(1, validatorsAddresses, normalizedPowers, powerThreshold, hubAddress);
    await bridge.deployed();

    const token = await Token.deploy("Token", "TKN", 1000000000, bridge.address);
    await token.deployed();

    await hub.addContract("governance", governanceAddress.address);
    await hub.completeContractInit();

    await network.provider.send("evm_mine")

    const toAddresses = [...Array(index).keys()].map(_ => ethers.Wallet.createRandom().address)
    const fromAddresses = [...Array(index).keys()].map(_ => token.address)
    const amounts = [...Array(index).keys()].map(_ => 1337)
    const validatorSetHash = await bridge.validatorSetHash();
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
        const tx = await bridge.transferToERC(
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