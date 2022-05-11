//SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.13;

import "./ICommon.sol";

interface IBridge is ICommon {
    event TransferToNamada(uint256 indexed nonce, address[] froms, uint256[] amounts);
    event TrasferToECR(uint256 indexed nonce, address[] froms, address[] tos, uint256[] amounts);

    function transferToERC(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        address[] calldata froms,
        address[] calldata tos,
        uint256[] calldata amounts,
        uint256 batchNonce
    ) external;

    function transferToNamada(address[] calldata froms, uint256[] calldata amounts) external;

    function authorize(
        ValidatorSetArgs calldata validatorSetArgs,
        Signature[] calldata signatures,
        bytes32 message
    ) external view returns (bool);

    function withdraw(address[] calldata tokens, address payable to) external;

    function updateValidatorSetHash(bytes32 _validatorSetHash) external;
}
