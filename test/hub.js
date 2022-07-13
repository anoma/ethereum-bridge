const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Hub", function () {
  it("Initialize contract testing", async function () {
    const [_owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const Hub = await ethers.getContractFactory("Hub");
    const hub = await Hub.deploy();
    await hub.deployed();

    expect(await hub.getContract("governance")).to.equal(ethers.constants.AddressZero);

    // invalid add contract not owner
    const addContractRejectNotOwner = hub.connect(addr1).addContract("governance", addr1.address);
    await expect(addContractRejectNotOwner).to.be.revertedWith("Caller is not owner.");

    // invalid upgrade contract not owner
    const upgradeContractRejectNotOwner = hub.connect(addr1).upgradeContract("governance", addr1.address);
    await expect(upgradeContractRejectNotOwner).to.be.revertedWith("Caller is not owner.");

    // valid add contract
    await hub.addContract("governance", addr1.address);
    expect(await hub.getContract("governance")).to.equal(addr1.address);
    expect(await hub.getContract("governance")).not.equal(addr2.address);

    // invalid lock contract wrong owner
    const lockContractNotOwner = hub.connect(addr1).completeContractInit();
    await expect(lockContractNotOwner).to.be.reverted;

    // // valid lock contract
    await hub.completeContractInit();
    expect(await hub.getContract("governance")).to.equal(addr1.address);

    // check that owner is not able to add/upgrade storage
    const invalidAddContract = hub.addContract("governance", addr2.address);
    await expect(invalidAddContract).to.be.revertedWith("Invalid caller address.");
    const invalidUpgradeCOntract = hub.upgradeContract("governance", addr2.address);
    await expect(invalidUpgradeCOntract).to.be.revertedWith("Invalid caller address.");

    // check that governance address is able to add/upgrade
    await hub.connect(addr1).addContract("bridge", addr2.address);
    await hub.connect(addr1).upgradeContract("bridge", addr3.address);

    // update governance address
    await hub.connect(addr1).upgradeContract("governance", addr4.address);
  });

  it("Upgrade testing", async function () {
    const [_owner, addr1] = await ethers.getSigners();

    const Hub = await ethers.getContractFactory("Hub");
    const hub = await Hub.deploy();
    await hub.deployed();

    expect(await hub.getContract("governance")).to.equal(ethers.constants.AddressZero);

    // invalid upgrade not exist
    const upgradeInvalidNotExist = hub.upgradeContract("governance", addr1.address);
    await expect(upgradeInvalidNotExist).to.be.revertedWith("Invalid contract address.")

    // valid add contract
    await hub.addContract("governance", addr1.address);

    // invalid upgrade zero address
    const upgradeInvalidZeroAddress = hub.upgradeContract("governance", ethers.constants.AddressZero);
    await expect(upgradeInvalidZeroAddress).to.be.revertedWith("Invalid address.")

    // invalid upgrade same address
    const upgradeInvalidSameAddress = hub.upgradeContract("governance", addr1.address);
    await expect(upgradeInvalidSameAddress).to.be.revertedWith("Address must be different")
  })

  it("Add testing", async function () {
    const [_owner, addr1, addr2] = await ethers.getSigners();

    const Hub = await ethers.getContractFactory("Hub");
    const hub = await Hub.deploy();
    await hub.deployed();

    expect(await hub.getContract("governance")).to.equal(ethers.constants.AddressZero);

    // valid add contract
    await hub.addContract("governance", addr1.address);

    // invalid add contract already exist
    const addContractInvalidAlreadyExist = hub.addContract("governance", addr2.address);
    await expect(addContractInvalidAlreadyExist).to.be.revertedWith("Contract name already exist.")

    // invalid add contract duplicate address
    const addContractInvalidDuplicateAddress = hub.addContract("test", addr1.address);
    await expect(addContractInvalidDuplicateAddress).to.be.revertedWith("Invalid duplicate address.")

    // invalid add contract zero address
    const addContractInvalidZeroAddress = hub.addContract("test", ethers.constants.AddressZero);
    await expect(addContractInvalidZeroAddress).to.be.revertedWith("Invalid contract address.")
  })
});
