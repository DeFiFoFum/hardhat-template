// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import {TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title LockUpgradeableProxy
 * @notice Helps with onchain usability by providing a name for the proxy
 */
contract LockUpgradeableProxy is TransparentUpgradeableProxy {
    /// @dev Prevent bytecode collisions with other proxies
    string public constant CONTRACT_NAME = "LockUpgradeableProxy";

    constructor(
        address logic_,
        address admin_,
        bytes memory data_
    ) TransparentUpgradeableProxy(logic_, admin_, data_) {}
}
