// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev NOT FOR PRODUCTION USE
contract ERC20Mock_MaxMint is ERC20 {
    /// @notice The maximum amount that can be minted per transaction
    uint256 public MAX_MINT_AMOUNT = 1e4 * 1e18;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    function mintMax(address account) public {
        _mint(account, MAX_MINT_AMOUNT);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
