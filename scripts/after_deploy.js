//* Approves the bridge to spend the test ERC20 of the deployer, and makes a transfer to Namada from the deployer *//

const { ethers, network } = require('hardhat');
const fs = require('fs');

/// testErc20Address should be the address of the first contract deployed to Hardhat, which was TestERC20
const testErc20Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
/// address of sole validator from <https://github.com/anoma/namada/files/9299669/anoma-dev.c21a27c05f23fae3d2f5bac3ad.tar.gz>
const receiverNamadaAddress =
  'atest1v4ehgw36xuunwd6989prwdfkxqmnvsfjxs6nvv6xxucrs3f3xcmns3fcxdzrvvz9xverzvzr56le8f';

async function main() {
  const [me] = await ethers.getSigners();
  console.log(`I am ${me.address}`);

  const testErc20 = await ethers.getContractAt('TestERC20', testErc20Address);
  console.log(`TestERC20 at: ${testErc20Address}`);

  const stateJson = readStateJson();
  const bridgeAddress = stateJson.bridge;
  console.log(`Bridge at: ${bridgeAddress}`);

  const transferAmount = 100;
  await testErc20.approve(bridgeAddress, transferAmount);
  console.log(`Approved the bridge to spend ${transferAmount} of my TestERC20`);
  const bridgeAllowance = await testErc20.allowance(me.address, bridgeAddress);
  console.log(`To confirm, bridge allowance is: ${bridgeAllowance}`);

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);

  console.log(`Transferring ${testErc20Address} to ${receiverNamadaAddress}`);
  const tx = await bridge.transferToNamada(
    [
      {
        from: testErc20Address,
        to: receiverNamadaAddress,
        amount: transferAmount,
      },
    ],
    0,
  );
  console.log(`Result: ${JSON.stringify(tx, null, 2)}`);

  const receipt = await tx.wait();

  const events = receipt.events.filter((event) => event.event !== undefined);
  events.forEach((event) => {
    console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  });

  const bridgeRemainingAllowance = await testErc20.allowance(
    me.address,
    bridgeAddress,
  );
  console.log(
    `Bridge remaining allowance (should be zero): ${bridgeRemainingAllowance}`,
  );

  for (let i = 0; i < 50; i++) {
    await network.provider.send('evm_mine');
    console.log(`Mined a block (${i + 1})`);
  }
}

function readStateJson() {
  const state = fs.readFileSync('scripts/state-localhost-31337.json', {
    encoding: 'UTF-8',
  });
  console.log(state);

  const stateJson = JSON.parse(state);
  return stateJson;
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
