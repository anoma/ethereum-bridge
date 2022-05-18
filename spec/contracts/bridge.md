# Bridge

`Bridge` smart contract is in charge of coordinating trasfer beetween ERC20 contracts and Namada in both directions.

# Functions

## transferToERC
This function is used to transfer tokens from namada to ethereum. Since the transfer needs to be always authorized from 2/3 of the voting power, transfers can be batched together. The following checks are done before authorizing the transfers:
- Batch invariants are checked
- More than 2/3 of the voting power have to sign a the batch serialization

If the checks are succesfull, a `TrasferToERC` event is emitted.

## transferToNamada
This function is used to transfer tokens from ethereum to namada, by transfering the tokens to the bridge address. The only checks done is on the batch format.

## authorize
This function is used to check if 2/3 of the voting power have authorized an action by checking their signature against an arbitrary message. 

## withdraw
This function is used to withdra all the ETH and ERC20 tokens locked by the bridge and send them to another abitrary address. This function can only be called from governance.

## updateValidatorSetHash
This function is used to update the validator set hash. This function can be called only from the governance address. Of particular interest is that we always keep track of 2 validator set. `currentValidatorSetHash` is the one used to authorize actions, meanwhile `nextValidatorSetHash` is going to be used the next time `updateValidatorSetHash` is called. This mechanism is specific for namada since, due to the how namada handle the Proof Of Stake pipeline, we alreayd have knowledge of the validator set for epoch `t + 1` at epoch `t`.

# Events

## TransferToNamada
This events contains information about the execution of a batch transfer from ethereum to namada. It contains the batch nonce, the source address and the tokens amounts.

## TrasferToERC
This event contains information about the execution of batch transfer from namada to ethereum. It contains the batch nonce, the source and destination addresses and the token amounts.