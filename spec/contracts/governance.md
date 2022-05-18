# Governance

`Governance` smart contract goals are twofold:
- upgrade contract to the next version
- unlock funds in the bridge contract in emergency cases

# Functions

## upgradeContract
This function is used to upgrade a contract address. The upgrades is done by calling the `upgradeContract` function of the `Hub` smart contract with the contract name and the new address as arguments. Before calling the `Hub` contract, the following checks are done:
- The new address must be different than the zero address
- The contract name to be updated must be different from `bridge`
- More than 2/3 of the voting power have to sign a specific message

## upgradeBridgeContract
This function is used to upgrade the `bridge` contract address. The upgrades is done by calling the `upgradeContract` function of the `Hub` smart contract with `bridge` as first argument and the new bridge contract address as second. Before calling the `Hub` contract, the following checks are done:
- The new address must be different than the zero address
- More than 2/3 of the voting power have to sign a specific message

## addContract
This function is used to add a new contract to the `Hub`. The upgrades is done by calling the `addContract` function of the `Hub` smart contract with the contract name and the new address as arguments. Before calling the `Hub` contract, the following checks are done:
- The new address must be different than the zero address
- More than 2/3 of the voting power have to sign a specific message

## updateValidatorsSet
This function is used to keep up-to-date the governance and bridge validator set. Both validator and governance set are passed as arguments in the form of a hash, which needs to be signed by 2/3 of the voting power. Before updating the variables holding governance and bridge validator set hash, the following checks are done:
- More than 2/3 of the voting power have to sign a specific message

If the checks outcome is positive, a `ValidatorSetUpdate` is emitted.

## withdraw
This function is used to withdraw funds from the bridge in case of malfunction. This function can be called only if 2/3 of the voting power agree to do it.

# Events

## ValidatorSetUpdate
This event contains information about a validator set update for both bridge and governance smarts. It contains the nonce used and both the governance and bridge validator set hash.

## NewContract
This event contains information about a new contract address being saved. It contains the contract name and contract address.

## UpgradedContract
This event contains information about a contract upgrade. It contains the contract name and the new contract address.