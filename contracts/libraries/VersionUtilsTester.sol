// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./VersionUtils.sol";

contract VersionUtilsTester {
    function testParseVersion(string memory version) external pure returns (VersionUtils.Version memory) {
        return VersionUtils.parseVersion(version);
    }

    function testIsCompatibleStrict(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) external pure returns (bool) {
        return VersionUtils.isCompatibleStrict(currentVersion, newVersion, minVersion);
    }

    function testIsCompatibleFlexible(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) external pure returns (bool) {
        return VersionUtils.isCompatibleFlexible(currentVersion, newVersion, minVersion);
    }

    function testRequireCompatibleStrict(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) external pure {
        VersionUtils.requireCompatibleStrict(currentVersion, newVersion, minVersion);
    }

    function testRequireCompatibleFlexible(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) external pure {
        VersionUtils.requireCompatibleFlexible(currentVersion, newVersion, minVersion);
    }
}
