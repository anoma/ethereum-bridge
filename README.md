# Namada Ethereum Bridge 

Namada Ethereum bridge is a set of smart contract to enable the exchange of tokens between the namada chain and ERC20 ethereum tokens. The mechanism used is inspired from [Cosmos Gravity Bridge](https://github.com/Gravity-Bridge/Gravity-Bridge).

# Features

- [x] Handle multiple ERC20 token transfers
- [x] Batched transfers
- [x] Issue native namada token on Ethereum
- [ ] Audit

# Smart contracts

The smart contracts used to operate the namada bridge on ethereum are:
- `Bridge.sol`: is in charge of authorizing tokens transfers to/from Namada.
- `Proxy.sol`: smart contract is in charge of keeping track of the existing contract addresses and can be queries by other smart contracts.
- `Vault.sol`: is used to escrow tokens
- `Token.sol`: corresponds to the native token of the chain that is being bridged to
- `TestERC20.sol`: is a test token used solely in tests

# Development

Development is done with [`foundry`](https://getfoundry.sh/), aided by [`just`](https://just.systems/).
All available commands can be queried with `just --list`.

## Running a development Ethereum node

```
$ just anvil
```

## Deploying contracts

```
$ just anvil-deploy <bridge-validator-set> <governance-validator-set>
```

Example JSON validator sets can be found inside of the
[scripts directory](script/).

## Broadcast a TestERC20 transaction

```
$ just anvil-allow <transfer-amount>
$ just anvil-transfer <target-namada-addr> <transfer-amount>
```

## Start a Solidity REPL

```
$ just
```
