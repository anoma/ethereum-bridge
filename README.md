# Namada Ethereum Bridge 

This repository contains a set of smart contracts that enable the exchange of
tokens between the Namada chain and ERC20 Ethereum tokens. The design of the
bridge is inspired by the
[Cosmos Gravity Bridge](https://github.com/Gravity-Bridge/Gravity-Bridge).


## Design overview

The smart contracts are designed in a generic way, such that they may be plugged
to an arbitrary BFT consensus chain, with >2/3 of signatures by voting power
(i.e. stake, if it is a PoS secured chain) over some bridge protocol message.

Value transferred to the native chain is escrowed in a vault abstraction, which
enables other contracts to be upgraded without moving value around. When ERC20
tokens are transferred back to Ethereum, value is released from escrow into the
destination accounts. As for tokens of the native chain, these are minted on
Ethereum, when transferred over, and burned, when transferred back.

Transfers to the native chain may be unordered from the point of view of Ethereum.
However, transfers to Ethereum, originating from the native chain, must be ordered
by a monotonically increasing sequence number. The nonce is signed together with
the root of a merkle tree containing transfers made by users in the native chain.
This merkle tree is dubbed the Bridge pool, as it functions as a mempool of sorts.
Existence proofs of a transfer in the Bridge pool must be provided, for a transfer
to be validated.

To decrease gas costs on Ethereum, transfers may be batched together. It is expected
that wallet implementations will facilitate the batching process, and warn users that
their transfers will not take any effect until they have been flushed from the queue
of pending transfers.

## Features

- [x] Handle multiple ERC20 token transfers.
- [x] Batched transfers.
- [x] Issue native namada token on Ethereum.
- [ ] Audit.

## Smart contracts

The smart contracts used to operate the Namada bridge on Ethereum are:

- [`Bridge.sol`](src/Bridge.sol): Authorizes tokens transfers to/from Namada.
- [`Proxy.sol`](src/Proxy.sol): Keeps track of the existing contract addresses and can
  be queries by other smart contracts.
- [`Vault.sol`](src/Vault.sol): Secures escrowed ERC20 tokens.
- [`Token.sol`](src/Token.sol): Corresponds to the native token of the chain that is being
  bridged to.
- [`TestERC20.sol`](src/TestERC20.sol): Test token used solely in tests.

## Development

Development is done with [`foundry`](https://getfoundry.sh/), aided by
[`just`](https://just.systems/). All available commands can be queried
with `just --list`.

### Building the Ethereum smart contracts

```
$ just build
```

### Running a development Ethereum node

```
$ just anvil
```

### Deploying the smart contracts to the development node

```
$ just anvil-deploy <bridge-validator-set> <governance-validator-set>
```

Example JSON validator sets can be found inside of the
[scripts directory](script/).

### Broadcast a TestERC20 transaction to the development node

```
$ just anvil-allow <transfer-amount>
$ just anvil-transfer <target-namada-addr> <transfer-amount>
```

### Start a development Solidity REPL

```
$ just
```
