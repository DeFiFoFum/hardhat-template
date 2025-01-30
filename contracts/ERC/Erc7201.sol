// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Erc7201
 * @notice This contract acts as a helper to calculate the storage slot for an ERC-7201 implementation.
 * @dev For more information, review the EIP-7201 proposal
 * https://eips.ethereum.org/EIPS/eip-7201
 */
contract Erc7201 {
    function getStorageAddress(string calldata namespace) public pure returns (bytes32) {
        return keccak256(abi.encode(uint256(keccak256(abi.encodePacked(namespace))) - 1)) & ~bytes32(uint256(0xff));
    }
}

/// @dev https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/master/contracts/token/ERC20/ERC20Upgradeable.sol
contract Erc7201_Example {
    /// @custom:storage-location erc7201:openzeppelin.storage.ERC20
    struct ERC20Storage {
        mapping(address account => uint256) _balances;
        mapping(address account => mapping(address spender => uint256)) _allowances;
        uint256 _totalSupply;
        string _name;
        string _symbol;
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ERC20")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant _ERC20StorageLocation = 0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00;

    function _getERC20Storage() private pure returns (ERC20Storage storage $) {
        assembly {
            $.slot := _ERC20StorageLocation
        }
    }

    function _updateTotalSupply(uint256 value) internal virtual {
        ERC20Storage storage $ = _getERC20Storage();
        $._totalSupply += value;
    }
}
