require("dotenv").config();

require("@nomiclabs/hardhat-etherscan");
require("@nomiclabs/hardhat-waffle");
require("hardhat-gas-reporter");
require("solidity-coverage");
require('hardhat-exposed');
require('solidity-coverage')
require('hardhat-contract-sizer');

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  solidity: {
    version: "0.8.13",
    settings: {
      optimizer: {
        enabled: true,
        runs: parseInt(process.env.RUNS) || 200,
      },
      viaIR: (process.env.VIAIR  === 'true'),
    },
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
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
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};
