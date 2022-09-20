# Proxy

`Proxy` smart contract holds references to the addresses of the latests contract version. This is useful when smart contracts need to communiate between them. The same pattern is beign use by rocketpool.

# Functions

## upgradeContract
This function is used to change the address of a specific contract by name. This function can be only called from the governance smart contract. The following checks are done before upgrading to the new address:
- The current saved address must be different from the zero address
- The new address must be different from the zero address
- The new address must be different from the current address

## addContract
This function is used to add a new contract address queriable by name. This function can be only called from the governance smart contract. The following checks are done before upgrading to the new address:
- The new smart contract name must be unique
- The new address must be different from the zero address

## getContract
This function is used query a contract by name. Return the zero address if nothing is found.