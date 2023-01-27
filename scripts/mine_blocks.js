const { network } = require('hardhat');

async function main() {
  // iterate 50 times
  for (let i = 0; i < 50; i++) {
    // mine a block
    await network.provider.send('evm_mine');
  }
  console.log(`Mined blocks`);
}

main()
  .then(() => console.log('Done'))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
