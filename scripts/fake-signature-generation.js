const prompt = require('prompt');
const { ethers } = require("hardhat");
const fs = require('fs');


async function main() {
    const { validatorSetPath } = await prompt.get([{
        name: 'validatorSetPath',
        required: true,
        description: "Full path to the private validator set path",
        type: 'string'
    }])

    const { contractVersion } = await prompt.get([{
        name: 'contractVersion',
        required: true,
        description: "Smart contract version",
        type: 'number'
    }])

    const { newContractAddress } = await prompt.get([{
        name: 'newContractAddress',
        required: true,
        description: "New smart contract address",
        type: 'string'
    }])

    const validatorSetContent = fs.readFileSync(validatorSetPath)
    const validatorSet = JSON.parse(validatorSetContent)

    const signers = Object.values(validatorSet).map(data => {
        return ethers.Wallet.fromMnemonic(data.phrase, data.path, data.locale)
    })

    const messageHash = generateArbitraryHash(
        ["uint256", "string", "string", "address"],
        [contractVersion, "upgradeBridgeContract", "bridge", newContractAddress]
    )

    const signatures = await generateSignatures(signers, messageHash)
    
    signatureJson = {}
    signatures.map((signature, index) => {
        signatureJson[signers[index].address] = signature
    })

    fs.writeFileSync('scripts/signatures.json', JSON.stringify(signatureJson))
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

const generateArbitraryHash = (fields, data) => {
    let abiEncoded = ethers.utils.solidityPack(fields, data);
    return ethers.utils.keccak256(abiEncoded);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });