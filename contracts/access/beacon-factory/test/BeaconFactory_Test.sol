// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IUpgradeableBeacon, IBeaconFactory, IBeaconFactoryAdmin} from "../IBeaconFactory.sol";

contract BeaconProxyImplementation_Test {
    function test() external pure returns (string memory) {
        return "BeaconProxyImplementation_Test";
    }
}

contract BeaconFactory_Test is IBeaconFactory {
    IUpgradeableBeacon private __upgradeableBeaconForFactory;

    constructor(address _beaconFactoryAdmin) {
        address _implementation = address(new BeaconProxyImplementation_Test());

        __upgradeableBeaconForFactory = IBeaconFactoryAdmin(_beaconFactoryAdmin).deployUpgradeableBeaconForFactory(
            "BeaconFactory_Test", // _beaconFactoryName
            IBeaconFactory(this), // _beaconFactory
            _implementation // _startingBeaconImplementation
        );
    }

    function isValidateBeaconImplementation(address /*_implementation*/) external pure returns (bool) {
        return true;
    }

    function getUpgradeableBeaconForFactory() external view returns (address) {
        return address(__upgradeableBeaconForFactory);
    }

    function getBeaconProxyImplementationForFactory() external view returns (address) {
        return __upgradeableBeaconForFactory.implementation();
    }
}
