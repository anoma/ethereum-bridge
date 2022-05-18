# Scripts

Useful scripts to manage smart contracts.

# Description

- `deploy.js` can be used to deploy and configure the whole set of smart contract to any chain. The deploy scripts also takes care of verifing contract on EtherScan.
- `upgrade-bridge.js` can be used to upgrade the bridge smart contract to a new version
- `upgrade-governance.js` can be used to upgrade the governance smart contract to a new version
- `fake-data-generator.js` can be used to generate validator set and signatures data

# How to run

```
npx hardhat run scripts/$SCRIPT_NAME.js --network $NETWORK_NAME
```
where `$SCRIPT_NAME` is a valid script in the `scripts` folder and `$NETWORK_NAME` must be configured in `hardhat.config.js`.