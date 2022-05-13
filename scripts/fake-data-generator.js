const { ethers } = require("hardhat");
const fs = require('fs');


async function main() {
    const totalValidators = 125
    const signers = []

    for (let i = 0; i < totalValidators; i++) {
        signers.push(ethers.Wallet.createRandom())
    }
    
    const powers = Array(totalValidators).fill().map(() => randomInteger(1, 100))
    const normalizedPowers = normalizePowers(powers)

    const validatorSet = {}
    const mnemonicSet = {}

    signers.map((signer, index) => {
        validatorSet[signer.address] = normalizedPowers[index]
        mnemonicSet[signer.address] = signer.mnemonic
    })

    fs.writeFileSync('scripts/fake-bridge-validator-set.json', JSON.stringify(validatorSet))
    fs.writeFileSync('scripts/fake-bridge-pk-set.json', JSON.stringify(mnemonicSet))
    fs.writeFileSync('scripts/fake-governance-validator-set.json', JSON.stringify(validatorSet))
    fs.writeFileSync('scripts/fake-governance-pk-set.json', JSON.stringify(mnemonicSet))
}


const normalizePowers = (powers, max = Math.pow(2, 32)) => {
    const sum = powers.reduce((a, b) => a + b, 0);
    const normalizedPowersOverSum = powers.map(power => power / sum);
    
    return normalizedPowersOverSum.map(power => Math.round(power * max)).sort().reverse();
}

function randomInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });