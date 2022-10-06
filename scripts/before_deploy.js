//* Deploys a test ERC20 contract and mints some tokens for the deployer *//

const { ethers } = require('hardhat');

const TEST_ERC20_CONTRACT_NAME = 'TestERC20';

async function deployTestErc20() {
  const TestERC20 = await ethers.getContractFactory(TEST_ERC20_CONTRACT_NAME);
  const token = await TestERC20.deploy();
  await token.deployed();
  console.log(`Token deployed: ${token.address}`);
  return token;
}

async function getScriptRunnerAddress() {
  const [deployer] = await ethers.getSigners();
  console.log(`I am ${deployer.address}`);
  return deployer;
}

async function main() {
  const token = await deployTestErc20();

  const deployer = await getScriptRunnerAddress();

  const mintAmount = 10_000;
  const result = await token.mint(deployer.address, mintAmount);
  console.log(`Mint result: ${JSON.stringify(result)}`);
  console.log(`Minted myself ${mintAmount} tokens`);

  // await token.approve(deployer.address, mintAmount);

  const balance = await token.balanceOf(deployer.address);
  console.log(`My balance: ${balance}`);
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
