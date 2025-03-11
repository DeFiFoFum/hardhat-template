# `TimelockController` Operations Guide

This guide provides information on how to securely operate the Timelock Controller.

- [`TimelockController` Operations Guide](#timelockcontroller-operations-guide)
  - [`TimelockController` Roles](#timelockcontroller-roles)
    - [`DEFAULT_ADMIN_ROLE`](#default_admin_role)
    - [`PROPOSER_ROLE`](#proposer_role)
    - [`EXECUTOR_ROLE`](#executor_role)
    - [`CANCELLER_ROLE`](#canceller_role)
  - [Scheduled Transactions](#scheduled-transactions)

## `TimelockController` Roles

### `DEFAULT_ADMIN_ROLE`

> [!WARNING]
> The `DEFAULT_ADMIN_ROLE` is not used to manage roles in the Timelock Controller. Instead, the Timelock Controller uses the `TIMELOCK_ADMIN_ROLE` as the role manager.

> [!NOTE]
> On deployment the `admin` can be set to `address(0)` which require that role management be sent through a timelock tx to the contract itself. This is an optional security feature which ensures that the admin role cannot be changed without a timelock tx.

```js
// 0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5
bytes32 public constant TIMELOCK_ADMIN_ROLE = keccak256("TIMELOCK_ADMIN_ROLE");
```

### `PROPOSER_ROLE`

> [!IMPORTANT]
> Because proposers can submit arbitrary transactions to the Timelock Controller, it is important to ensure that only secure and trusted addresses are granted the `PROPOSER_ROLE`.


Proposers can be added and removed by the `TIMELOCK_ADMIN_ROLE`.

Proposers should be secure and trusted addresses that are allowed to `schedule` transactions to the Timelock Controller.

```js
// 0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1
bytes32 public constant PROPOSER_ROLE = keccak256("PROPOSER_ROLE");
```

### `EXECUTOR_ROLE`

> [!WARNING]
> Granting the `EXECUTOR_ROLE` to `address(0)` will allow anyone to execute transactions on the Timelock Controller. This could be a security risk. It is recommended to only grant `EXECUTOR_ROLE` to trusted addresses.

Executors can be added and removed by the `TIMELOCK_ADMIN_ROLE`.

Executors are allowed to execute scheduled transactions which have passed their delay period.

```js
// 0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63
bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
```

### `CANCELLER_ROLE`

Cancellers can be added and removed by the `TIMELOCK_ADMIN_ROLE`.

Cancellers are allowed to cancel transactions that have been scheduled but not yet executed.

```js
// 0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783
bytes32 public constant CANCELLER_ROLE = keccak256("CANCELLER_ROLE");
```

## Scheduled Transactions

The Timelock Controller allows for transactions to be scheduled for execution at a future block timestamp.

1. Scheduled transactions must have a `delay >=  getMinDelay()`
2. Once scheduled, transactions do not expire and will remain in the queue until executed or cancelled.