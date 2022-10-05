const { ethers } = require("hardhat");
const { MerkleTree } = require('merkletreejs');



function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const randomPowers = (length = 20, min = 1, max = 100) => {
    return Array(length).fill().map(() => randomInteger(min, max))
}

const computeThreshold = (powers) => {
    const sum = Array.isArray(powers) ? powers.reduce((a, b) => a + b, 0) : powers;
    const two_third = (2 * sum) / 3;
    return Math.round(two_third);
}

const getSignersAddresses = (signers) => {
    return signers.map(signer => signer.address);
}

const getSigners = (total) => {
    const signers = [];
    for (let i = 0; i < total; i++) {
        signers.push(ethers.Wallet.createRandom())
    }
    return signers
}

const normalizePowers = (powers, max = Math.pow(2, 32)) => {
    const sum = powers.reduce((a, b) => a + b, 0);
    const normalizedPowersOverSum = powers.map(power => power / sum);

    return normalizedPowersOverSum.map(power => Math.round(power * max)).sort().reverse();
}

const normalizeThreshold = (max = Math.pow(2, 32)) => {
    return max;
}

const generateValidatorSetArgs = (validatorAddreseses, powers, nonce) => {
    return {
        validators: validatorAddreseses,
        powers: powers,
        nonce: nonce
    }
}

const generateSignatures = async (signers, message) => {
    const signatures = await Promise.all(signers.map(async signer => {
        const _message = ethers.utils.arrayify(message)
        const signature = await signer.signMessage(_message)
        const splitSig = ethers.utils.splitSignature(signature);
        return { r: splitSig.r, s: splitSig.s, v: splitSig.v }
    }))
    return signatures
}

const generateArbitraryHash = (field, data) => {
    let abiEncoded = ethers.utils.solidityPack(field, data);
    return ethers.utils.keccak256(abiEncoded);
}

const generateValidatorSetHash = (validatorAddreseses, powers, nonce, namespace) => {
    return generateArbitraryHash(["uint8", "string", "address[]", "uint256[]", "uint256"], [1, namespace, validatorAddreseses, powers, nonce])
}

const generateBatchTransferHash = (froms, tos, amounts, nonce, validatorSetHash, namespace) => {
    return generateArbitraryHash(["uint8", "string", "address[]", "address[]", "uint256[]", "uint256", "bytes32"], [1, namespace, froms, tos, amounts, nonce, validatorSetHash])
}

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ourMultiProof(tree, leaves) {
    const sortedLeaves = leaves.sort(Buffer.compare)

    const proofHashes = []
    const flags = []

    let hashes = tree.leaves.map((leaf) => {
        if (sortedLeaves.some(l => leaf.compare(l) == 0)) {
            return { leaf: leaf, type: 'onPath' }
        } else {
            return { leaf: leaf, type: 'siblings' }
        }
    })

    while (hashes.length > 1) {
        const nextHashes = []
        const leftLeaves = hashes.filter((_, index) => {
            return (index % 2) === 0
        })
        const rightLeaves = hashes.filter((_, index) => {
            return (index % 2) === 1
        })

        for (let index = 0; index < leftLeaves.length; index++) {
            const leftLeaf = leftLeaves[index]

            const rightLeaf = rightLeaves.length === index ? { leaf: tree.hashFn("0"), type: 'siblings' } : rightLeaves[index]

            const combineType = `${leftLeaf.type}-${rightLeaf.type}`

            switch (combineType) {
                case 'onPath-onPath':
                    flags.push(true)
                    nextHashes.push({
                        leaf: tree.hashFn(Buffer.concat([leftLeaf.leaf, rightLeaf.leaf].sort(Buffer.compare))),
                        type: 'onPath'
                    })
                    break
                case 'onPath-siblings':
                    flags.push(false)
                    proofHashes.push(rightLeaf.leaf)
                    nextHashes.push({
                        leaf: tree.hashFn(Buffer.concat([leftLeaf.leaf, rightLeaf.leaf].sort(Buffer.compare))),
                        type: 'onPath'
                    })
                    break
                case 'siblings-onPath':
                    flags.push(false)
                    proofHashes.push(leftLeaf.leaf)
                    nextHashes.push({
                        leaf: tree.hashFn(Buffer.concat([leftLeaf.leaf, rightLeaf.leaf].sort(Buffer.compare))),
                        type: 'onPath'
                    })
                    break
                case 'siblings-siblings':
                    nextHashes.push({
                        leaf: tree.hashFn(Buffer.concat([leftLeaf.leaf, rightLeaf.leaf].sort(Buffer.compare))),
                        type: 'siblings'
                    })
                    break
                default:
                    console.log('default')
                    break
            }
        }
        hashes = nextHashes
    }

    if (flags.length === 0 && proofHashes.length === 0 && leaves.length === 0) {
        proofHashes.push(hashes[0])
    }

    if (hashes.length == 0) {
        return [0, [], []]
    }

    return [hashes[0].leaf, proofHashes, flags]
}

exports.randomPowers = randomPowers;
exports.computeThreshold = computeThreshold;
exports.getSignersAddresses = getSignersAddresses;
exports.getSigners = getSigners;
exports.normalizePowers = normalizePowers;
exports.normalizeThreshold = normalizeThreshold;
exports.generateValidatorSetArgs = generateValidatorSetArgs;
exports.generateValidatorSetHash = generateValidatorSetHash;
exports.generateBatchTransferHash = generateBatchTransferHash;
exports.generateSignatures = generateSignatures;
exports.generateArbitraryHash = generateArbitraryHash;
exports.ourMultiProof = ourMultiProof;
exports.randomInteger = randomInteger;