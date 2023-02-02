require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require('hardhat-contract-sizer');
const deploy = require('./tasks/deploy.js');

task("deploy", "Deploy the smart contracts")
  .addOptionalParam("configuration", "The path to a JSON file containing configuration values for deployment", '')
  .setAction(async ({configuration}, hre) => {
    await deploy.main(hre, configuration)
  })

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.17",
    settings: {
      optimizer: {
        enabled: true,
        runs: parseInt(process.env.RUNS) || 200,
      },
      viaIR: (process.env.VIAIR  === 'true'),
    },
  },
  networks: {
    localhost: {
      chainId: 31337,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      chainId: 3,
      accounts: process.env.ROPSTEN_PRIVATE_KEY !== undefined ? [process.env.ROPSTEN_PRIVATE_KEY] : [],
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      chainId: 5,
      accounts: process.env.GOERLI_PRIVATE_KEY !== undefined ? [process.env.GOERLI_PRIVATE_KEY] : [],
    }
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    only: [],
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS  === 'true'),
    currency: "USD",
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP
  },
  etherscan: {
    apiKey: {
      ropsten: process.env.ROPSTEN_ETHERSCAN_API_KEY,
      goerli: process.env.GOERLI_ETHERSCAN_API_KEY
    }
  },
};
