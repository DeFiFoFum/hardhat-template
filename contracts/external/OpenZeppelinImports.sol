// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @dev Decided to adapt this contract with a constructor to set the initial owner. See contracts/proxy/ProxyAdmin.sol
// import {ProxyAdmin} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {TransparentUpgradeableProxy, ITransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev This contract enables hardhat to compile the builds for upgradeable deployments
contract OpenZeppelinImports {
    // No implementation required
}
