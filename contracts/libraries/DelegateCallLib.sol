// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library DelegateCallLib {
    /**
     * @dev Handles the result of a delegatecall and reverts with the revert reason if the call failed.
     * @param success The success flag returned by the delegatecall.
     * @param result The result bytes returned by the delegatecall.
     * @return The result bytes if the delegatecall was successful.
     */
    function handleDelegateCallResult(bool success, bytes memory result) internal pure returns (bytes memory) {
        if (success) {
            return result;
        } else {
            // If the result length is less than 68, then the transaction failed silently (without a revert reason)
            if (result.length < 68) revert("delegatecall failed without a revert reason");

            assembly {
                // Slice the sighash to remove the function selector
                result := add(result, 0x04)
            }
            // All that remains is the revert string
            revert(abi.decode(result, (string)));
        }
    }
}
