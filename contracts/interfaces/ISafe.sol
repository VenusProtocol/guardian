// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity 0.8.25;

import { Enum } from "@safe-global/safe-contracts/contracts/common/Enum.sol";

/**
 * @title ISafe - A multisignature wallet interface with support for confirmations using signed messages based on EIP-712.
 */
interface ISafe {
    /**
     * @notice Returns the nonce of the Safe contract.
     * @return Nonce.
     */
    function nonce() external view returns (uint256);
}
