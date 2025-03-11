// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IUpgradeableBeacon, IBeacon, IBeaconFactory} from "./IBeaconFactory.sol";

/**
 * @title UpgradeableBeaconForFactory
 * @notice Immutable contract which can validate and upgrade the implementation beacon proxies for a factory.
 *   The rationale for this contract is that a factory can be upgradable, while keeping the beacon immutable.
 * @dev OZ's UpgradeableBeacon didn't quite work for the use case.
 */
contract UpgradeableBeaconForFactory is IUpgradeableBeacon, Ownable {
    /// -----------------------------------------------------------------------
    /// Storage variables
    /// -----------------------------------------------------------------------

    /// @notice The name of the beacon factory for identification
    string public beaconFactoryName;

    /// @notice The factory that created this beacon
    IBeaconFactory public immutable beaconFactory;

    /// @notice The address of the current implementation
    address private __beaconImplementation;

    /// -----------------------------------------------------------------------
    /// Events
    /// -----------------------------------------------------------------------

    /// @dev Emitted when the implementation returned by the beacon is changed.
    event Upgraded(address indexed implementation);
    event BeaconUpgraded(address indexed oldImplementation, address indexed newImplementation);

    /// -----------------------------------------------------------------------
    /// Errors
    /// -----------------------------------------------------------------------

    error NotAContract(address _address);
    error AddressZero(string addressLabel);
    error InvalidBeaconImplementation(address _implementation);

    /// -----------------------------------------------------------------------
    /// Constructor
    /// -----------------------------------------------------------------------

    /// @dev To be deployed be a factory on initialization.
    constructor(
        string memory _beaconFactoryName,
        address _beaconFactoryAdmin,
        address _beaconFactory,
        address _startingBeaconImplementation
    ) Ownable() {
        if (_beaconFactoryAdmin == address(0)) {
            revert AddressZero("_beaconFactoryAdmin");
        }
        beaconFactoryName = _beaconFactoryName;
        beaconFactory = IBeaconFactory(_beaconFactory);

        _setBeaconImplementation(_startingBeaconImplementation, true);
        _transferOwnership(_beaconFactoryAdmin);
    }

    /// -----------------------------------------------------------------------
    /// IBeacon Interface
    /// -----------------------------------------------------------------------

    function implementation() public view override(IBeacon) returns (address) {
        return __beaconImplementation;
    }

    /// -----------------------------------------------------------------------
    /// Upgrade Functions - onlyOwner
    /// -----------------------------------------------------------------------

    /// @notice Upgrades the beacon to a new implementation.
    /// @dev WARN This function MUST be protected behind a BeaconFactoryAdmin contract which MUST be protected by a 72 hour timelock.
    /// - For a factory, this update will update all contracts deployed by the factory.
    function upgradeTo(address newImplementation) public override(IUpgradeableBeacon) onlyOwner {
        _setBeaconImplementation(newImplementation, false);
    }

    /// @dev On initialization, the factory is not fully deployed and MUST validate the beacon implementation.
    function _setBeaconImplementation(address _newBeaconImplementation, bool _isInit) internal {
        if (!Address.isContract(_newBeaconImplementation)) {
            revert NotAContract(_newBeaconImplementation);
        }

        /// @dev On initialization, the factory is not fully deployed and MUST validate the beacon implementation.
        if (!_isInit && !beaconFactory.isValidateBeaconImplementation(_newBeaconImplementation)) {
            revert InvalidBeaconImplementation(_newBeaconImplementation);
        }
        emit BeaconUpgraded(__beaconImplementation, _newBeaconImplementation);
        emit Upgraded(_newBeaconImplementation);

        __beaconImplementation = _newBeaconImplementation;
    }
}
