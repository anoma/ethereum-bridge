const { ethers } = require("hardhat");

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const randomPowers = (length=20, min=1, max=100) => {
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
        const _message = (ethers.utils.arrayify(message))
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
    return generateArbitraryHash(["uint256", "string", "address[]", "uint256[]", "uint256"], [1, namespace, validatorAddreseses, powers, nonce])
}

exports.randomPowers = randomPowers;
exports.computeThreshold = computeThreshold;
exports.getSignersAddresses = getSignersAddresses;
exports.getSigners = getSigners;
exports.normalizePowers = normalizePowers;
exports.normalizeThreshold = normalizeThreshold;
exports.generateValidatorSetArgs = generateValidatorSetArgs;
exports.generateValidatorSetHash = generateValidatorSetHash;
exports.generateSignatures = generateSignatures;
exports.generateArbitraryHash = generateArbitraryHash;