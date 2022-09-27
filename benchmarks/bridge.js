const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures } = require("../test/utils/utilities")
const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');

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

    const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)

    const transfers = [...Array(index * 3).keys()].map(_ => {
        return {
            'from': token.address,
            'to': ethers.Wallet.createRandom().address,
            'amount': 10,
            'fee': 2
        }
    })

    const transferHashes = transfers.map(transfer => {
        return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.fee, 1])
    }).map(keccak256)

    const transferHashesSorted = [...transferHashes].sort(Buffer.compare)

    // build merkle tree, generate proofs
    const merkleTree = new MerkleTree(transferHashesSorted, keccak256, { hashLeaves: false, sort: true });
    const root = merkleTree.getRoot();

    const proofLeaves = transfers.slice(0, index).map(transfer => {
        return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.fee, 1])
    }).map(keccak256).sort(Buffer.compare)
    const proof = merkleTree.getMultiProof(proofLeaves);
    const proofFlags = merkleTree.getProofFlags(proofLeaves, proof);

    const validTransfers = proofLeaves.map(proof => {
        return transferHashes.map(hashTransfer => hashTransfer.toString('hex')).findIndex(hexTransfer => hexTransfer == proof.toString('hex'))
    }).map(index => transfers[index])

    const signatures = await generateSignatures(signers, root);

    try {
        const tx = await bridge.connect(anotherAddress).transferToERC(
            currentValidatorSetArgs,
            signatures,
            validTransfers,
            root,
            proof,
            proofFlags,
            1
        );

        const receipt = await tx.wait()
        const txGas = Number(receipt.gasUsed);

        return [index, txGas]
    } catch (e) {
        throw `Error execution transferToERC: ${e}`;
    }
}

exports.trasferToERC20 = trasferToERC20;