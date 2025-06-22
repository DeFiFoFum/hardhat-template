// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

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
    /// @notice Address which can perform BeaconProxy upgrades to the UpgradeableBeaconForFactory.
    function secureTimelockController() external view returns (address);

    /// @notice Set the beacon implementation for a given factory
    /// @dev WARN this function affects the contract code for all contracts created by the factory
    function upgradeBeaconFactoryImplementation(
        IBeaconFactory _beaconFactory,
        address _newBeaconImplementation
    ) external;

    /// @notice Upgrades the implementation of an upgradeable beacon
    /// @param _upgradeableBeacon The address of the upgradeable beacon
    /// @param _newBeaconImplementation The address of the new beacon implementation
    function upgradeBeaconImplementation(
        IUpgradeableBeacon _upgradeableBeacon,
        address _newBeaconImplementation
    ) external;

    /// @notice Deploys an UpgradeableBeaconForFactory for the factory.
    function deployUpgradeableBeaconForFactory(
        string memory _beaconFactoryName,
        IBeaconFactory _beaconFactory,
        address _startingBeaconImplementation
    ) external returns (IUpgradeableBeacon);

    /// @notice Returns true if the caller is the admin for the upgradeable beacon.
    function isAdminForUpgradeableBeacon(address _upgradeableBeacon) external view returns (bool);
}
