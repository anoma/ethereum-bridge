const { ethers, network } = require("hardhat");
const QuickChart = require('quickchart-js');

const { randomPowers, computeThreshold, getSignersAddresses, getSigners, normalizePowers, normalizeThreshold, generateValidatorSetArgs, generateSignatures, generateValidatorSetHash } = require("./../test/utils/utilities")

const MIN_VALIDATOR = 30
const MAX_VALIDATOR = 125


const benchmarkLadder = async function(from, to, chartName) {
    const gasUsed = []
    const y = []

    for (let step = from; step < to; step++) {
        // init contracts
        const maxTokenSupply = 1000000;
        const totalValidators = step;
        const [_, governanceAddress] = await ethers.getSigners();
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

        const token = await Token.deploy("Token", "TKN", maxTokenSupply, bridge.address);
        await token.deployed();

        await hub.addContract("governance", governanceAddress.address);
        await hub.completeContractInit();
        
        await network.provider.send("evm_mine")

        // benchmark function
        const newTotalValidators = step;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);

        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signatures = await generateSignatures(signers, newValidatorSetHash);

        try {
            const tx = await bridge.updateValidatorSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
            const receipt = await tx.wait()

            gasUsed.push(Number(receipt.gasUsed))
            y.push(step)
        } catch {
            console.log("ERROR")
            console.log("total validators:", step)
        }
    }
    const chart = new QuickChart();
    
    chart
    .setConfig({
        type: 'line',
        data: { 
            labels: y, 
            datasets: [
                { label: 'GasUsed', data: gasUsed }
            ] 
        },
    })
    .setWidth(800)
    .setHeight(400)
    .setBackgroundColor('white');

    chart.toFile(chartName);
}

const benchmarkMaxValidator = async function(from, to, chartName) {
    const gasUsed = []
    const y = []

    for (let step = from; step < to; step++) {
        // init contracts
        const maxTokenSupply = 1000000;
        const totalValidators = 125;
        const [_, governanceAddress] = await ethers.getSigners();
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

        const token = await Token.deploy("Token", "TKN", maxTokenSupply, bridge.address);
        await token.deployed();

        await hub.addContract("governance", governanceAddress.address);
        await hub.completeContractInit();
        
        await network.provider.send("evm_mine")

        // benchmark function
        const newTotalValidators = 125;
        const newPowers = randomPowers(newTotalValidators);
        const newSigners = getSigners(newTotalValidators);
        const newValidatorsAddresses = getSignersAddresses(newSigners);
        const newNormalizedPowers = normalizePowers(newPowers);

        const currentValidatorSetArgs = generateValidatorSetArgs(validatorsAddresses, normalizedPowers, 0)
        const newValidatorSetArgs = generateValidatorSetArgs(newValidatorsAddresses, newNormalizedPowers, 1)
        const newValidatorSetHash = generateValidatorSetHash(newValidatorsAddresses, newNormalizedPowers, 1, "bridge")
        const signatures = await generateSignatures(signers, newValidatorSetHash);

        try {
            const tx = await bridge.updateValidatorSet(currentValidatorSetArgs, newValidatorSetArgs, signatures)
            const receipt = await tx.wait()

            gasUsed.push(Number(receipt.gasUsed))
            y.push(step)
        } catch {
            console.log("ERROR")
            console.log("total validators:", step)
        }
    }
    const chart = new QuickChart();
    
    chart
    .setConfig({
        type: 'line',
        data: { 
            labels: y, 
            datasets: [
                { label: 'GasUsed', data: gasUsed }
            ] 
        },
    })
    .setWidth(800)
    .setHeight(400)
    .setBackgroundColor('white');

    chart.toFile(chartName);
}

// benchmarkLadder(MIN_VALIDATOR, MAX_VALIDATOR, "updateValidatorSetLader.png")
benchmarkMaxValidator(1, 10, "benchmarkMaxValidator.png")