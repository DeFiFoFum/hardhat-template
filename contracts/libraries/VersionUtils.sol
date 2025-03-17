// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

library VersionUtils {
    error IncompatibleVersion();
    error BelowMinimumVersion();
    error MajorVersionMismatch();
    error InvalidVersionFormat();

    struct Version {
        uint256 major;
        uint256 minor;
        uint256 patch;
    }

    function parseVersion(string memory version) internal pure returns (Version memory) {
        bytes memory versionBytes = bytes(version);
        if (versionBytes.length == 0) revert InvalidVersionFormat();

        uint256 firstDot = type(uint256).max;
        uint256 secondDot = type(uint256).max;
        uint256 dotCount = 0;

        for (uint i = 0; i < versionBytes.length; i++) {
            bytes1 char = versionBytes[i];
            if (char == ".") {
                dotCount++;
                if (dotCount > 2) revert InvalidVersionFormat();
                if (firstDot == type(uint256).max) firstDot = i;
                else secondDot = i;
            } else if (char < bytes1("0") || char > bytes1("9")) {
                revert InvalidVersionFormat();
            }
        }

        if (dotCount != 2 || firstDot == 0 || secondDot == firstDot + 1 || secondDot == versionBytes.length - 1) {
            revert InvalidVersionFormat();
        }

        return
            Version({
                major: _parseInt(version, 0, firstDot),
                minor: _parseInt(version, firstDot + 1, secondDot),
                patch: _parseInt(version, secondDot + 1, bytes(version).length)
            });
    }

    function _parseInt(string memory str, uint256 startIndex, uint256 endIndex) private pure returns (uint256) {
        uint256 val = 0;
        for (uint256 i = startIndex; i < endIndex; i++) {
            val = val * 10 + uint8(bytes(str)[i]) - 48;
        }
        return val;
    }

    /// @notice Strict version check - requires same major version
    function isCompatibleStrict(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) internal pure returns (bool) {
        Version memory current = parseVersion(currentVersion);
        Version memory newer = parseVersion(newVersion);
        Version memory minimum = parseVersion(minVersion);

        // Check minimum version first
        if (!_meetsMinimumVersion(newer, minimum)) return false;

        // Strict major version check
        if (current.major != newer.major) return false;

        // Minor must be >= current
        if (newer.minor < current.minor) return false;

        // If same minor, patch must be >= current
        if (newer.minor == current.minor && newer.patch < current.patch) return false;

        return true;
    }

    /// @notice Flexible version check - allows major version upgrades
    function isCompatibleFlexible(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) internal pure returns (bool) {
        Version memory current = parseVersion(currentVersion);
        Version memory newer = parseVersion(newVersion);
        Version memory minimum = parseVersion(minVersion);

        // Check minimum version first
        if (!_meetsMinimumVersion(newer, minimum)) return false;

        // Allow only forward major version changes
        if (newer.major < current.major) return false;

        // If same major, apply minor/patch rules
        if (newer.major == current.major) {
            if (newer.minor < current.minor) return false;
            if (newer.minor == current.minor && newer.patch < current.patch) return false;
        }

        return true;
    }

    function requireCompatibleStrict(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) internal pure {
        if (!isCompatibleStrict(currentVersion, newVersion, minVersion)) {
            revert IncompatibleVersion();
        }
    }

    function requireCompatibleFlexible(
        string memory currentVersion,
        string memory newVersion,
        string memory minVersion
    ) internal pure {
        if (!isCompatibleFlexible(currentVersion, newVersion, minVersion)) {
            revert IncompatibleVersion();
        }
    }

    function _meetsMinimumVersion(Version memory version, Version memory minVersion) private pure returns (bool) {
        if (version.major < minVersion.major) return false;
        if (version.major > minVersion.major) return true;

        if (version.minor < minVersion.minor) return false;
        if (version.minor > minVersion.minor) return true;

        return version.patch >= minVersion.patch;
    }
}
