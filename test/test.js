const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Test", function () {
  it("Test testing", async function () {
    const [_owner] = await ethers.getSigners();

    const Test = await ethers.getContractFactory("Test");
    const test = await Test.deploy();
    await test.deployed();

    const theNumber = 128;
    const resNumber = await test.getNumberHash(theNumber);
    console.log(`Number ${theNumber} is hashed to: ${resNumber}\n`)

    const theList = [0, 128, 256, 10000000011]
    const resList = await test.getListHash(theList);
    console.log(`List [${theList}] is hashed to: ${resList}`)

    const resTest = await test.getTestHash();
    console.log(`The test is hashed to: ${resTest}`)
  });
})