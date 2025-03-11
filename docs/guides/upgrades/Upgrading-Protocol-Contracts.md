# Protocol Contract Upgrade Process

There are important considerations to keep in mind when upgrading protocol contracts as a bad upgrade can have significant negative impact on the protocol and its users.

- [Protocol Contract Upgrade Process](#protocol-contract-upgrade-process)
  - [Storage](#storage)
    - [Validating Storage Compatibility](#validating-storage-compatibility)
    - [`__gap` placeholder](#__gap-placeholder)
  - [Upgrade Process](#upgrade-process)

## Storage

Storage is one of the most important considerations of a protocol contract upgrade. The storage layout of the new contract must be compatible with the old contract to ensure that the data is not lost during the upgrade process.

### Validating Storage Compatibility

> [!NOTE]
> This step uses `forge` to check for storage compatibility between the old and new contracts. Be sure you have it installed before proceeding.

Run: `node ./scripts/checkStorage.js <contract-name>`

The output can be used with a tool like [diffchecker](https://www.diffchecker.com/text-compare/) to compare the storage layout of the old and new contracts.

### `__gap` placeholder

The `__gap` pattern is a way to ensure that future storage variables can be added to a contract without changing the storage layout of the existing contract. This is done by adding a large array of `uint256` variables to the contract which can be used to store future variables.

If new storage variables are added to the contract in the future, they can be added directly above the `__gap`. Then the `__gap` can be reduced to the necessary size to accommodate the new variables.

```js
    /// @dev Gap to provide storage for future variables
    uint256[50] private __gap;
```

## Upgrade Process

> [!IMPORTANT]
> All upgradeable contracts should be protected by a timelock with a `minDelay` of 24-72hrs. This is to ensure that any malicious or accidental upgrades can be stopped before.

After validating the upgrade logic and storage compatibility, the upgrade process can be initiated.

1. Deploy the new implementation contract.
2. Encode a set of timelock transactions to:
   1. Schedule an `upgrade` transaction for the protocol.
   2. Schedule a revert `upgrade` transaction as a safety measure.
   3. (see `./scripts/encode-txs/encodeUpgradeTxs.ts`)
3. Schedule the `upgrade` and revert `upgrade` transactions on the timelock.
4. Wait for the timelock delay period to pass.
5. Execute the `upgrade` transaction on the timelock.
6. Verify that the upgrade was successful and that the protocol is functioning as expected.
   1. If the upgrade was successful, `cancel` the revert `upgrade` transaction on the timelock to remove the revert transaction.
   2. If the upgrade was unsuccessful, execute the revert `upgrade` transaction on the timelock to revert the upgrade.
