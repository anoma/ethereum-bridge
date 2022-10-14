const { network } = require('hardhat');

async function main() {
  await network.provider.send('evm_mine');
  console.log(`Mined a block`);
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
