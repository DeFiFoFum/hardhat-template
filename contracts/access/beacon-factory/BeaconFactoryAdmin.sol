// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IUpgradeableBeacon, IBeaconFactory, IBeaconFactoryAdmin} from "./IBeaconFactory.sol";
import {UpgradeableBeaconForFactory} from "./UpgradeableBeaconForFactory.sol";
import {IVersionable} from "../../interfaces/IVersionable.sol";

/**
 * @title BeaconFactoryAdmin
 * @notice Contract used to manage the upgrade of beacon factory implementations.
 */
contract BeaconFactoryAdmin is IBeaconFactoryAdmin, Ownable, IVersionable {
    /**
     * @notice Changelog
     * 1.1.0 - Added isAdminForUpgradeableBeacon helper function
     */
    string public constant override VERSION = "1.1.0";

    /// @notice Maximum duration for which upgrades can be locked
    uint256 public constant MAX_LOCK_DURATION = 365 days;

    /// -----------------------------------------------------------------------
    /// Storage variables
    /// -----------------------------------------------------------------------

    /// @notice Address of the SecureTimelockController to handle upgrades
    /// @dev Recommended to be at least 72 hours
    address public override(IBeaconFactoryAdmin) secureTimelockController;

    /// @notice Timestamp until which all upgrades are locked
    uint256 public beaconUpgradesLockedUntilTimestamp = 0;

    /// @notice Trusted controllers that can call the transferSecureTimelockController function
    mapping(address => bool) public isTrustedTimelockController;

    address[] public deployedBeaconFactories;

    /// -----------------------------------------------------------------------
    /// Events
    /// -----------------------------------------------------------------------

    event TransferSecureTimelockController(address oldSecureTimelockController, address newSecureTimelockController);
    event SetLockTimestamp(uint256 lockTimestamp);
    event TrustedControllerSet(address controller, bool isTrusted);
    event DeployedBeaconFactory(address upgradeableBeacon);

    /// -----------------------------------------------------------------------
    /// Errors
    /// -----------------------------------------------------------------------

    error OnlySecureTimelock();
    error BeaconUpgradeIsLocked();
    error FactoryAlreadyLocked(address _factory);
    error AddressZero();
    error UnauthorizedController(address _controller);
    error DurationAboveMax(uint256 _duration, uint256 _maxDuration);
    event SetLockTimestamp(uint256 oldLockTimestamp, uint256 newLockTimestamp);

    /// -----------------------------------------------------------------------
    /// Constructor & Initializer
    /// -----------------------------------------------------------------------

    constructor(address _owner, address _secureTimelockController) Ownable() {
        transferOwnership(_owner);

        if (_secureTimelockController == address(0)) {
            revert AddressZero();
        }
        secureTimelockController = _secureTimelockController;
    }

    /// -----------------------------------------------------------------------
    /// Modifiers & Functions
    /// -----------------------------------------------------------------------

    modifier onlySecureTimelock() {
        _validateSecureTimelockController();
        _;
    }

    modifier canPerformBeaconUpgrade() {
        if (block.timestamp < beaconUpgradesLockedUntilTimestamp) {
            revert BeaconUpgradeIsLocked();
        }
        _validateSecureTimelockController();
        _;
    }

    function _validateSecureTimelockController() internal view {
        if (msg.sender != secureTimelockController) {
            revert OnlySecureTimelock();
        }
    }

    /// -----------------------------------------------------------------------
    /// Secure TimelockController Functions
    /// -----------------------------------------------------------------------

    function transferSecureTimelockController(address _newSecureTimelockController) external onlySecureTimelock {
        if (!isTrustedTimelockController[_newSecureTimelockController]) {
            revert UnauthorizedController(_newSecureTimelockController);
        }
        emit TransferSecureTimelockController(secureTimelockController, _newSecureTimelockController);
        secureTimelockController = _newSecureTimelockController;
    }

    /// @notice Set the beacon implementation for a given factory
    /// @dev WARN this function affects the contract code for all contracts created by the factory
    function upgradeBeaconFactoryImplementation(
        IBeaconFactory _beaconFactory,
        address _newBeaconImplementation
    ) external override canPerformBeaconUpgrade {
        address upgradeableBeaconForFactory = _beaconFactory.getUpgradeableBeaconForFactory();
        IUpgradeableBeacon(upgradeableBeaconForFactory).upgradeTo(_newBeaconImplementation);
    }

    /// @notice Upgrades the implementation of an upgradeable beacon
    /// @param _upgradeableBeacon The address of the upgradeable beacon
    /// @param _newBeaconImplementation The address of the new beacon implementation
    function upgradeBeaconImplementation(
        IUpgradeableBeacon _upgradeableBeacon,
        address _newBeaconImplementation
    ) external override canPerformBeaconUpgrade {
        _upgradeableBeacon.upgradeTo(_newBeaconImplementation);
    }

    /// -----------------------------------------------------------------------
    /// Admin Functions
    /// -----------------------------------------------------------------------

    /// @notice Set a duration for which all upgrades are locked or extend the current lock.
    /// @dev If the current lock has expired, the new lock duration starts from the current block timestamp.
    ///      If the lock is still active, the new duration is added to the existing lock period.
    /// @param _duration The duration (in seconds) to lock upgrades.
    function lockBeaconUpgradesForDuration(uint256 _duration) external onlyOwner {
        if (_duration > MAX_LOCK_DURATION) {
            revert DurationAboveMax(_duration, MAX_LOCK_DURATION);
        }

        uint256 currentLockTimestamp = beaconUpgradesLockedUntilTimestamp;

        // If the current lock has expired, start from `block.timestamp`
        if (currentLockTimestamp < block.timestamp) {
            currentLockTimestamp = block.timestamp;
        }

        // Extend the lock
        uint256 newLockTimestamp = currentLockTimestamp + _duration;

        beaconUpgradesLockedUntilTimestamp = newLockTimestamp;

        emit SetLockTimestamp(currentLockTimestamp, newLockTimestamp);
    }

    function setTrustedTimelockController(address _controller, bool _isTrusted) external onlyOwner {
        emit TrustedControllerSet(_controller, _isTrusted);
        isTrustedTimelockController[_controller] = _isTrusted;
    }

    /// -----------------------------------------------------------------------
    /// Upgradeable Beacon Helper
    /// -----------------------------------------------------------------------

    /// @notice Check if the caller is the admin of the upgradeable beacon
    /// @param _upgradeableBeacon The address of the upgradeable beacon
    /// @return True if the caller is the admin of the upgradeable beacon, false otherwise
    function isAdminForUpgradeableBeacon(address _upgradeableBeacon) external view override returns (bool) {
        return Ownable(_upgradeableBeacon).owner() == address(this);
    }

    /// @notice Returns the length of the deployed beacon factories array
    /// @return The length of the deployed beacon factories array
    function getDeployedBeaconFactoriesLength() external view returns (uint256) {
        return deployedBeaconFactories.length;
    }

    /// @notice Deploys an implementation of an upgradeable beacon with the beacon admin set to this contract.
    function deployUpgradeableBeaconForFactory(
        string memory _beaconFactoryName,
        IBeaconFactory _beaconFactory,
        address _startingBeaconImplementation
    ) external override returns (IUpgradeableBeacon upgradeableBeacon) {
        address beaconFactoryAdmin = address(this);

        upgradeableBeacon = new UpgradeableBeaconForFactory(
            _beaconFactoryName,
            beaconFactoryAdmin,
            address(_beaconFactory),
            _startingBeaconImplementation
        );

        deployedBeaconFactories.push(address(upgradeableBeacon));
        emit DeployedBeaconFactory(address(upgradeableBeacon));

        return upgradeableBeacon;
    }
}
