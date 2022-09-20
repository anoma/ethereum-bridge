# Namada Ethereum Bridge 

Namada Ethereum bridge is a set of smart contract to enable the exchange of tokens between the namada chain and ERC20 ethereum tokens. The mechanism used is highly inspired from [Cosmos Gravity Bridge](https://gitproxy.com/Gravity-Bridge/Gravity-Bridge).

# Features

- [x] Handle multiple ERC20 tokens
- [x] Batched transfers
- [x] Issue native namada token on Ethereum
- [x] Tested with +95% coverage
- [ ] Audit

# Smart contracts

The smart contracts used to operate the namada bridge on ethereum are:
- `Governance.sol`
- `Bridge.sol`
- `Proxy.sol`

`Proxy` smart contract is in charge of keeping track of the existing contract addresses and can be queries by other smart contracts.

`Bridge` is in charge of authorizing tokens the transfers between the chains.

`Governance` functionality is twofold: keep the namada validator set up-to-date and upgrade existing contract to new versions.
