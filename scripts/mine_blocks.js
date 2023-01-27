const { network } = require('hardhat');

async function main() {
  // iterate 5 times
  for (let i = 0; i < 5; i++) {
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
