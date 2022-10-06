//* Deploys a test ERC20 contract and mints some tokens for the deployer *//

const { ethers } = require('hardhat');

const TEST_ERC20_CONTRACT_NAME = 'TestERC20';
const TEST_ERC20_TOTAL_SUPPLY = 10_000;

async function deployTestErc20() {
  const TestERC20 = await ethers.getContractFactory(TEST_ERC20_CONTRACT_NAME);
  const token = await TestERC20.deploy();
  await token.deployed();
  console.log(`ERC20 token deployed: ${token.address}`);
  return token;
}

async function getScriptRunnerAddress() {
  const [deployer] = await ethers.getSigners();
  console.log(`My Ethereum address is ${deployer.address}`);
  return deployer;
}

async function main() {
  const deployer = await getScriptRunnerAddress();

  const token = await deployTestErc20();

  const result = await token.mint(deployer.address, TEST_ERC20_TOTAL_SUPPLY);
  console.log(`Mint result: ${JSON.stringify(result, null, 2)}`);
  console.log(`Minted myself ${TEST_ERC20_TOTAL_SUPPLY} tokens`);

  // await token.approve(deployer.address, mintAmount);

  const balance = await token.balanceOf(deployer.address);
  console.log(`My balance: ${balance}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
