# Namada Ethereum Smart Contracts
Namada leaverage a set of smart contract to issue/escrow tokens between ETH and Namada chains. 
The set is composed of 3 contracts:
- Governance
- Bridge
- Hub

A use case can be the following:
- User `A` sends 100USDC from his wallet to the bridge calling the `transferToNamada` functin
- As soon as namada receives the log of this action, it mint 100USDC on the namada chain for the specified user
- User `A` is now able to transfer USDC on nadama

## Hub
`Hub` smart contract holds references to the addresses of the latests contract version. This is useful when smart contracts need to communiate between them.
The same pattern is beign use by rocketpool.

## Governance
`Governance` smart contract goals are twofold:
- upgrade contract to the next version
- unlock funds in the bridge contract in emergency cases

## Bridge
`Bridge` smart contract is in charge of coordinating trasfer beetween ERC20 contracts and Namada in both directions.

