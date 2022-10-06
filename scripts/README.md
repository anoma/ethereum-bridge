# Scripts

Useful scripts to manage smart contracts.

# Description

- `deploy.js` can be used to deploy and configure the whole set of smart contract to any chain. The deploy scripts also takes care of verifing contract on EtherScan.
- `upgrade-bridge.js` can be used to upgrade the bridge smart contract to a new version
- `upgrade-governance.js` can be used to upgrade the governance smart contract to a new version
- `fake-data-generator.js` can be used to generate fake validator set and signatures data

# How to run

```
npx hardhat run scripts/$SCRIPT_NAME.js --network $NETWORK_NAME
```

where `$SCRIPT_NAME` is a valid script in the `scripts` folder and `$NETWORK_NAME` must be configured in `hardhat.config.js`.

# Deploying to a local hardhat node

Ensure a node is running.

```shell
npx hardhat node
```

Then do the following:

```shell
$ npx run scripts/fake-data-generator.js

$ npx hardhat run scripts/before_deploy.js --network localhost
# the test ERC20 should have been deployed to 0x5FbDB2315678afecb367f032d93F642f64180aa3

$ npx hardhat run scripts/deploy.js --network localhost
Running on network localhost with chain-id 31337
prompt: Is the network correct?:  true
prompt: Full path to bridge validator set json file: bridge-validator-set.json
prompt: Full path to next bridge validator set json file: bridge-validator-set.json
prompt: Full path to governance validator set json file: bridge-validator-set.json
prompt: Total wrapped NAM ERC20 token supply:  10000
Using 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 as deploy address with 9999998462408939861122 balance.
prompt: Is the signer address correct?:  true
prompt: Whitelisted token addresses, comma separated (not including wNAM):  0x5FbDB2315678afecb367f032d93F642f64180aa3
prompt: Whitelisted token caps, comma separated (not including wNAM):  10000

Proxy address: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
Governance address: 0x0165878A594ca255338adfa4d48449f69242Eb8F
Bridge address: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
Token address: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

Running checks...
Looking good!

$ npx hardhat run scripts/after_deploy.js --network localhost
```
