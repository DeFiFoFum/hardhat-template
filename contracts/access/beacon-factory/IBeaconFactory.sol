// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IBeacon} from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";

/// @notice Interface for the contract which stores the implementation address for a beacon.
interface IUpgradeableBeacon is IBeacon {
    function upgradeTo(address newImplementation) external;
}

/// @notice Interface for a factory contract which deploys BeaconProxy contracts which reference the implementation stored in an UpgradeableBeacon.
interface IBeaconFactory {
    event BeaconProxyData(address indexed beaconProxy, bytes implementationData);

    function isValidateBeaconImplementation(address _implementation) external view returns (bool);

    /// @notice Address of the immutable contract which stores the implementation address for a beacon.
    function getUpgradeableBeaconForFactory() external view returns (address);

    /// @notice Address of the implementation which will be used for the deployed BeaconProxy contracts.
    function getBeaconProxyImplementationForFactory() external view returns (address);
}

/// @notice Interface for the contract which manages the upgrade of beacon factory implementations.
/// @dev This architecture is built with security in mind. The UpgradeableBeacon and BeaconFactoryAdmin are
///  intended on being immutable
interface IBeaconFactoryAdmin {
    function secureTimelockController() external view returns (address);

    function deployUpgradeableBeaconForFactory(
        string memory _beaconFactoryName,
        IBeaconFactory _beaconFactory,
        address _startingBeaconImplementation
    ) external returns (IUpgradeableBeacon);
}
