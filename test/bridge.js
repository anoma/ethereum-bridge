const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateArbitraryHash } = require("./utils/utilities")
const { MerkleTree } = require('merkletreejs');
const { WMerkleTree, LeafSignature } = require('ethers-merkletree');
const gen = require('random-seed');
const keccak256 = require('keccak256');

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
    let random;
    const maxTokenSupply = 15000;
    const walletTokenAmount = 6000;

    beforeEach(async function () {
        random = gen.create("seed");

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
        const bridgeInvalidPowerThresholdTwo = Bridge.deploy(1, validatorsAddresses, normalizedPowers, validatorsAddresses, normalizedPowers.map(p => Math.floor(p / 2)), [], [], powerThreshold, proxy.address);
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

    it.only("transferToERC20 testing", async function () {
        const [_, test] = await ethers.getSigners()
        const batchNonce = 1;

        const intialVaultBalance = await token.balanceOf(vault.address);
        expect(intialVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))

        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)

        const transfers = [...Array(20).keys()].map(index => {
            return {
                'from': token.address,
                'to': ethers.Wallet.fromMnemonic(
                    ethers.utils.entropyToMnemonic(
                        Buffer.from([...Array(16).keys()].map(_ => index).join(''), 'utf-8')
                    )
                ).address,
                'amount': random.intBetween(0, 100),
                'feeFrom': 'aNamadaAddress',
                'fee': random.intBetween(0, 100)
            }
        })

        console.log(transfers.map(t => {
            return {
                'version': 1,
                'namespace': "transfer",
                'from': t.from,
                'to': t.to,
                'amount': t.amount,
                'feeFrom': t.feeFrom,
                'fee': t.fee,
                'nonce': 1
            }
        }))

        for (const transfer of transfers) {
            const initialAddressBalance = await token.balanceOf(transfer.to)
            expect(initialAddressBalance).to.be.equal(ethers.BigNumber.from(0))
        }

        const transferHashes = transfers.map(transfer => {
            return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "string", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.feeFrom, transfer.fee, batchNonce])
        }).map(keccak256)

        const transferHashesSorted = [...transferHashes].sort(Buffer.compare)

        // build merkle tree, generate proofs
        const merkleTree = new MerkleTree(transferHashesSorted, keccak256, { hashLeaves: false, sort: true });
        const root = merkleTree.getRoot();

        // console.log(merkleTree.toString())
        const rootHex = merkleTree.getHexRoot();
        console.log(rootHex)

        const proofLeaves = transfers.slice(0, 2).map(transfer => {
            return ethers.utils.solidityPack(["uint8", "string", "address", "address","uint256", "string", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.feeFrom, transfer.fee, batchNonce])
        }).map(keccak256).sort(Buffer.compare)
        const proof = merkleTree.getMultiProof(proofLeaves);
        const proofFlags = merkleTree.getProofFlags(proofLeaves, proof);

        const validTransfers = proofLeaves.map(proof => {
            return transferHashes.map(hashTransfer => hashTransfer.toString('hex')).findIndex(hexTransfer => hexTransfer == proof.toString('hex'))
        }).map(index => transfers[index])

        // console.log(merkleTree.getHexLeaves())
        // console.log(proofLeaves)
        // console.log(proof)
        // console.log(proofFlags)
        // console.log(root)
        // console.log(validTransfers)

        const signatures = await generateSignatures(signers, root);

        // valid transfer
        await bridge.transferToERC(
            currentValidatorSetArgs,
            signatures,
            validTransfers,
            root,
            proof,
            proofFlags,
            batchNonce
        )

        // check wallets balances
        let totalTransfered = 0
        for (const transfer of validTransfers) {
            const transferWalletBalance = await token.balanceOf(transfer.to);
            expect(transferWalletBalance).to.be.equal(ethers.BigNumber.from(transfer.amount))
            totalTransfered += transfer.amount
        }

        const postVaultBalance = await token.balanceOf(vault.address);
        expect(postVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply - totalTransfered))

        // // same root, invalid transfer to due nonce
        // const proofLeavesTwo = [transfers[0], transfers[15], transfers[29]].map(transfer => {
        //     return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.fee, batchNonce])
        // }).map(keccak256).sort(Buffer.compare)
        // const proofTwo = merkleTree.getMultiProof(proofLeaves);
        // const proofFlagsTwo = merkleTree.getProofFlags(proofLeaves, proof);

        // const transferOneIndexTwo = transferHashes.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeaves[0].toString('hex'))
        // const transferFifthTeenIndexTwo = transferHashes.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeaves[1].toString('hex'))
        // const transferThirtyIndexTwo = transferHashes.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeaves[2].toString('hex'))
        // const validTransfersTwo = [transferOneIndexTwo, transferFifthTeenIndexTwo, transferThirtyIndexTwo].map(index => transfers[index])

        // const invalidNonceTransfer = bridge.transferToERC(
        //     currentValidatorSetArgs,
        //     signatures,
        //     validTransfersTwo,
        //     root,
        //     proofTwo,
        //     proofFlagsTwo,
        //     batchNonce
        // )
        // await expect(invalidNonceTransfer).to.be.revertedWith("Invalid batchNonce.")

        // // invalid root signature
        // const invalidSignature = await generateSignatures(signers, keccak256("randomInvalidRoot"));

        // const invalidRootSignature = bridge.transferToERC(
        //     currentValidatorSetArgs,
        //     invalidSignature,
        //     validTransfers,
        //     root,
        //     proofTwo,
        //     proofFlagsTwo,
        //     batchNonce + 1
        // )
        // await expect(invalidRootSignature).to.be.revertedWith("Invalid validator set signature.")

        // // send invalid transfer (due to batch nonce)
        // const nonPresentTransfer = bridge.transferToERC(
        //     currentValidatorSetArgs,
        //     signatures,
        //     validTransfers,
        //     root,
        //     proof,
        //     proofFlags,
        //     batchNonce + 1
        // )
        // await expect(nonPresentTransfer).to.be.revertedWith("Invalid transfers proof.")

        // const transfersThree = [...Array(30).keys()].map(_ => {
        //     return {
        //         'from': token.address,
        //         'to': ethers.Wallet.createRandom().address,
        //         'amount': randomInteger(maxTokenSupply + 100, maxTokenSupply + 10000),
        //         'fee': randomInteger(1, 10)
        //     }
        // })

        // const transferHashesThree = transfersThree.map(transfer => {
        //     return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.fee, batchNonce + 1])
        // }).map(keccak256)

        // const transferHashesSortedThree = [...transferHashesThree].sort(Buffer.compare)

        // // build merkle tree, generate proofs
        // const merkleTreeThree = new MerkleTree(transferHashesSortedThree, keccak256, { hashLeaves: false, sortPairs: true });
        // const rootThree = merkleTreeThree.getRoot();

        // const proofLeavesThree = [transfersThree[0], transfersThree[15], transfersThree[29]].map(transfer => {
        //     return ethers.utils.solidityPack(["uint8", "string", "address", "address", "uint256", "uint256", "uint256"], [1, 'transfer', transfer.from, transfer.to, transfer.amount, transfer.fee, batchNonce + 1])
        // }).map(keccak256).sort(Buffer.compare)
        // const proofThree = merkleTreeThree.getMultiProof(proofLeavesThree);
        // const proofFlagsThree = merkleTreeThree.getProofFlags(proofLeavesThree, proofThree);

        // const transferOneIndexThree = transferHashesThree.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeavesThree[0].toString('hex'))
        // const transferFifthTeenIndexThree = transferHashesThree.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeavesThree[1].toString('hex'))
        // const transferThirtyIndexThree = transferHashesThree.map(transfer => transfer.toString('hex')).findIndex(transfer => transfer == proofLeavesThree[2].toString('hex'))
        // const validTransfersThree = [transferOneIndexThree, transferFifthTeenIndexThree, transferThirtyIndexThree].map(index => transfersThree[index])

        // // valid transfers, but amounts too big
        // const signaturesThree = await generateSignatures(signers, rootThree);

        // await bridge.transferToERC(
        //     currentValidatorSetArgs,
        //     signaturesThree,
        //     validTransfersThree,
        //     rootThree,
        //     proofThree,
        //     proofFlagsThree,
        //     batchNonce + 1
        // )

        // for (const transfer of transfersThree) {
        //     const initialAddressBalance = await token.balanceOf(transfer.to)
        //     expect(initialAddressBalance).to.be.equal(ethers.BigNumber.from(0))
        // }

        // const postVaultBalanceThree = await token.balanceOf(vault.address);
        // expect(postVaultBalanceThree).to.be.equal(ethers.BigNumber.from(maxTokenSupply - totalTransfered))

        // // invalid validator set 
        // const invalidValidatorSet = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        // invalidValidatorSet.powers[0] = 0

        // const invalidValidatorSetTransfer = bridge.transferToERC(
        //     invalidValidatorSet,
        //     invalidSignature,
        //     validTransfers,
        //     root,
        //     proofTwo,
        //     proofFlagsTwo,
        //     batchNonce + 2
        // )

        // await expect(invalidValidatorSetTransfer).to.be.revertedWith("Invalid currentValidatorSetHash.")

        // // invalid validator set 2 
        // const invalidValidatorSetTwo = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        // invalidValidatorSetTwo.powers.pop()

        // const invalidValidatorSetTransferTwo = bridge.transferToERC(
        //     invalidValidatorSetTwo,
        //     invalidSignature,
        //     validTransfers,
        //     root,
        //     proofTwo,
        //     proofFlagsTwo,
        //     batchNonce + 2
        // )

        // await expect(invalidValidatorSetTransferTwo).to.be.revertedWith("Mismatch array length.")
    });

    it("transferToNamada testing", async function () {
        const [newWallet, randomAddress] = await ethers.getSigners()
        const numberOfConfirmations = 100;

        const preBridgeBalance = await token.balanceOf(vault.address);
        expect(preBridgeBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply))

        const preNewWalletTokenBalance = await token.balanceOf(newWallet.address)
        expect(preNewWalletTokenBalance).to.be.equal(ethers.BigNumber.from(walletTokenAmount))

        await token.connect(newWallet).approve(bridge.address, 6000)

        await bridge.connect(newWallet).transferToNamada(
            transfers,
            numberOfConfirmations
        );

        const updatedNewWalletbalance = await token.balanceOf(newWallet.address);
        expect(updatedNewWalletbalance).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900))

        const updatedVaultBalance = await token.balanceOf(vault.address);
        expect(updatedVaultBalance).to.be.equal(ethers.BigNumber.from(maxTokenSupply + 5900))

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

        // invalid due to to high token amount transfer
        // will not revert but no token transfer happen
        await bridge.connect(newWallet).transferToNamada(
            [token.address],
            tos,
            [1000000],
            numberOfConfirmations
        );

        const nonWhitelistedTokenBalanceTwo = await notWhitelistedToken.balanceOf(newWallet.address);
        expect(nonWhitelistedTokenBalanceTwo).to.be.equal(ethers.BigNumber.from(walletTokenAmount))

        await bridge.connect(newWallet).transferToNamada(
            [{
                'from': token.address,
                'to': 'anamadaAddress',
                'amount': 14900 - 5900 + 1
            }],
            numberOfConfirmations
        );

        const updatedNewWalletbalanceAfterInvalidTokenCap = await token.balanceOf(newWallet.address);
        expect(updatedNewWalletbalanceAfterInvalidTokenCap).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900))

        // transfer invalid batch
        const trasferInvalidBatch = bridge.connect(newWallet).transferToNamada(
            fromAddresses,
            tos,
            [],
            numberOfConfirmations
        );
        await expect(trasferInvalidBatch).to.be.revertedWith("Invalid batch.");

        const whitelistLeftAmountTwo = await bridge.getWhitelistAmountFor(token.address);
        expect(whitelistLeftAmountTwo).to.be.equal(ethers.BigNumber.from(14900 - 5900))
        
        // invalid  due to non enough funds
        await bridge.connect(newWallet).transferToNamada(
            [{
                'from': token.address,
                'to': 'anamadaAddress',
                'amount': 101
            }],
            numberOfConfirmations
        );

        const balanceAfterInsuficientAmountTransaction = await token.balanceOf(newWallet.address);
        expect(balanceAfterInsuficientAmountTransaction).to.be.equal(ethers.BigNumber.from(walletTokenAmount - 5900))

        const updatedVaultBalanceTwo = await token.balanceOf(vault.address);
        expect(updatedVaultBalanceTwo).to.be.equal(ethers.BigNumber.from(maxTokenSupply + 5900))

        const randomAddressPreBalance = await token.balanceOf(randomAddress.address);

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