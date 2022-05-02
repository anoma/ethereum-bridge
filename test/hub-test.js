const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Hub", function () {
  it("Initialize contract testing", async function () {
    const [_owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const Hub = await ethers.getContractFactory("Hub");
    const hub = await Hub.deploy();
    await hub.deployed();

    expect(await hub.getContract("governance")).to.equal("0x0000000000000000000000000000000000000000");

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
    await expect(lockContractNotOwner).to.be.revertedWith("Must be called by owner.");

    // valid lock contract
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
});
