# MultiSig Access Architecture v1.0

This guide provides a comprehensive overview of the multi-sig architecture and admin contract infrastructure that forms the foundation for the management of a smart contract protocol. It outlines the different multi-sigs, their roles and responsibilities, and the security model that underpins the governance framework.

## Table of Contents

- [MultiSig Access Architecture v1.0](#multisig-access-architecture-v10)
  - [Table of Contents](#table-of-contents)
  - [1. Multi-Sig Hierarchy](#1-multi-sig-hierarchy)
    - [1.1 Secure Admin Multi-sig](#11-secure-admin-multi-sig)
    - [1.2 General Admin Multi-sig](#12-general-admin-multi-sig)
    - [1.3 Insecure Admin Safe](#13-insecure-admin-safe)
    - [1.4 Treasury Safe](#14-treasury-safe)
  - [2. Admin Contract Infrastructure](#2-admin-contract-infrastructure)
    - [2.1 TimelockControllerEnumerable](#21-timelockcontrollerenumerable)
      - [72-Hour Timelock](#72-hour-timelock)
      - [24-Hour Timelock](#24-hour-timelock)
      - [6-Hour Timelock](#6-hour-timelock)
    - [2.2 ProxyAdmin](#22-proxyadmin)
    - [2.3 BeaconFactoryAdmin](#23-beaconfactoryadmin)
  - [3. Security Model](#3-security-model)
    - [3.1 Timelock Protection](#31-timelock-protection)
    - [3.2 Separation of Concerns](#32-separation-of-concerns)
    - [3.4 Recommended Signer Thresholds](#34-recommended-signer-thresholds)
  - [4. Operational Workflows](#4-operational-workflows)
    - [4.1 Protocol Upgrades](#41-protocol-upgrades)
    - [4.2 Parameter Changes](#42-parameter-changes)
    - [4.3 Emergency Actions](#43-emergency-actions)
    - [4.4 Fund Management](#44-fund-management)

## 1. Multi-Sig Hierarchy

Generally this structure relies on at least four multi-sigs, each with different roles and responsibilities. The multi-sigs are designed to provide varying levels of security and operational efficiency based on the type of operations they are responsible for.

### 1.1 Secure Admin Multi-sig

> [!IMPORTANT]
> The Secure Admin Multi-sig is the highest security multi-sig and controls the most critical protocol operations.

**Purpose**: Handle critical protocol operations that require the highest level of security.

**Key Capabilities**:

- Perform protocol proxy upgrades
- Propose and execute timelock transactions
- Control the ProxyAdmin contract
- Manage the BeaconFactoryAdmin contract
- Set critical protocol parameters

**Operational Characteristics**:

- Less frequent transactions
- Thorough validation process
- Higher signer threshold (recommended 3/5 or 4/7)
- Used for operations that can fundamentally change the protocol

**Security Considerations**:

- Keys should be stored on hardware wallets
- Signers should be geographically distributed
- Regular security audits of the signing process

### 1.2 General Admin Multi-sig

> [!NOTE]
> The General Admin Multi-sig handles day-to-day operations and is used more frequently than the Secure Admin Multi-sig.

**Purpose**: Handle routine administrative operations that require moderate security.

**Key Capabilities**:

- Manage protocol roles
- Adjust non-critical parameters
- Execute operations approved by governance
- Manage whitelists and access controls

**Operational Characteristics**:

- More frequent transactions
- Moderate validation process
- Lower signer threshold (recommended 2/5)
- Used for time-sensitive operations

**Security Considerations**:

- Balance between security and operational efficiency
- Regular rotation of signers
- Clear documentation of operations

### 1.3 Insecure Admin Safe

> [!WARNING]
> The Insecure Admin Safe is assumed to be potentially compromisable at any time and should only be used for non-critical operations.

**Purpose**: Provide quick access for emergency actions, testing, and non-critical operations.

**Key Capabilities**:

- Pause contracts in emergency situations
- Execute testing operations
- Perform non-critical administrative tasks

**Operational Characteristics**:

- Single-signer capability (1/n)
- No consensus required
- Quick response time
- Used for operations where speed is critical

**Security Considerations**:

- Assume this multi-sig could be compromised at any time
- Limit the capabilities accessible to this multi-sig
- Regularly audit actions taken by this multi-sig

### 1.4 Treasury Safe

> [!NOTE]
> The Treasury Safe is dedicated to managing protocol fees and funds.

**Purpose**: Manage protocol fees and funds.

**Key Capabilities**:

- Receive protocol fees
- Manage protocol treasury
- Distribute funds according to governance decisions

**Operational Characteristics**:

- Separate from operational multi-sigs
- May have different signers focused on fund management
- Used for financial operations

**Security Considerations**:

- Strong focus on financial controls
- Regular audits of fund movements
- Clear documentation of fund allocations

## 2. Admin Contract Infrastructure

Along with this admin infrastructure comes contracts to manage upgrades, parameter changes, and access control. These contracts work together to provide a secure and flexible governance framework.

### 2.1 TimelockControllerEnumerable

The protocol uses three TimelockControllerEnumerable contracts with different delay periods to provide varying levels of security for different types of operations.

> [!IMPORTANT]
> Timelocks provide a delay between when an operation is proposed and when it can be executed, giving users time to react to potentially malicious changes.

#### 72-Hour Timelock

**Purpose**: Secure the most critical protocol operations.

**Key Characteristics**:

- 72-hour delay between proposal and execution
- Used for beacon implementation upgrades
- Connected to the BeaconFactoryAdmin contract
- Highest security timelock

**Access Control**:

- TIMELOCK_ADMIN_ROLE: Secure Admin Multi-sig
- PROPOSER_ROLE: Secure Admin Multi-sig
- EXECUTOR_ROLE: General Admin Multi-sig and/or Secure Admin Multi-sig
- CANCELLER_ROLE: General Admin Multi-sig and Insecure Admin Safe

#### 24-Hour Timelock

**Purpose**: Secure standard administrative operations.

**Key Characteristics**:

- 24-hour delay between proposal and execution
- Used for proxy upgrades and parameter changes
- Medium security timelock

**Access Control**:

- TIMELOCK_ADMIN_ROLE: Secure Admin Multi-sig
- PROPOSER_ROLE: General Admin Multi-sig and/or Secure Admin Multi-sig
- EXECUTOR_ROLE: General Admin Multi-sig and/or Secure Admin Multi-sig
- CANCELLER_ROLE: General Admin Multi-sig and Insecure Admin Safe

#### 6-Hour Timelock

**Purpose**: Secure time-sensitive operations.

**Key Characteristics**:

- 6-hour delay between proposal and execution
- Used for operations that need to be executed relatively quickly
- Lower security timelock

**Access Control**:

- TIMELOCK_ADMIN_ROLE: Secure Admin Multi-sig
- PROPOSER_ROLE: General Admin Multi-sig and/or Secure Admin Multi-sig
- EXECUTOR_ROLE: General Admin Multi-sig and Insecure Admin Safe
- CANCELLER_ROLE: General Admin Multi-sig and Insecure Admin Safe

### 2.2 ProxyAdmin

> [!IMPORTANT]
> The ProxyAdmin contract is the admin of all transparent upgradeable proxies in the protocol.

**Purpose**: Manage upgrades of transparent upgradeable proxies.

**Key Capabilities**:

- Upgrade proxy implementations
- Change proxy admins
- Query proxy implementations and admins

**Access Control**:

- Owner: Secure Admin Multi-sig or 24-Hour Timelock

**Security Considerations**:

- Critical contract that can change the behavior of all proxies
- Should be controlled by the highest security multi-sig or timelock
- All upgrades should be thoroughly tested and audited

### 2.3 BeaconFactoryAdmin

See [BeaconFactoryAdmin-operations-guide](./BeaconFactoryAdmin-operations-guide.md) for more information.

> [!IMPORTANT]
> The BeaconFactoryAdmin contract manages the upgrade of beacon factory implementations, affecting all contracts deployed by those factories.

**Purpose**: Manage upgrades of beacon factory implementations.

**Key Capabilities**:

- Upgrade beacon implementations
- Lock upgrades for a specified duration
- Set trusted timelock controllers

**Access Control**:

- Owner: Secure Admin Multi-sig
- secureTimelockController: 72-Hour Timelock

**Security Considerations**:

- Extremely critical contract that can change the behavior of all contracts deployed by factories
- Upgrades can only be performed through the 72-hour timelock
- Upgrades can be locked for up to 365 days for additional security

## 3. Security Model

### 3.1 Timelock Protection

Timelocks provide a delay between when an operation is proposed and when it can be executed, giving users time to react to potentially malicious changes.

**Timelock Usage**:

- Critical operations use the 72-hour timelock
- Standard administrative operations use the 24-hour timelock
- Time-sensitive operations use the 6-hour timelock

**Security Benefits**:

- Users have time to exit the protocol if they disagree with a proposed change
- Malicious proposals can be identified and cancelled before execution
- Provides transparency into upcoming protocol changes

### 3.2 Separation of Concerns

The protocol separates different types of operations across different multi-sigs and contracts to limit the impact of a potential compromise.

**Separation Principles**:

- Critical operations require multiple multi-sigs to coordinate
- Fund management is separated from protocol administration
- Emergency actions are limited in scope

**Security Benefits**:

- Compromise of a single multi-sig cannot compromise the entire protocol
- Different operations have appropriate security levels
- Clear responsibility for different types of operations

### 3.4 Recommended Signer Thresholds

Different multi-sigs should have different signer thresholds based on their purpose and security requirements.

**Recommended Thresholds**:

- Secure Admin Multi-sig: 3/5 or 4/7
- General Admin Multi-sig: 2/5
- Insecure Admin Safe: 1/n
- Treasury Safe: 3/5

**Threshold Considerations**:

- Higher thresholds provide more security but less operational efficiency
- Lower thresholds provide more operational efficiency but less security
- Thresholds should be set based on the criticality of the operations performed by each multi-sig

## 4. Operational Workflows

This section describes common operational workflows and which multi-sigs and contracts are involved in each.

### 4.1 Protocol Upgrades

Protocol upgrades involve changing the implementation of proxy contracts or beacon factories.

**Transparent Proxy Upgrades**:

1. Secure Admin Multi-sig proposes an upgrade through the 24-hour timelock
2. After the timelock delay, General Admin Multi-sig executes the upgrade
3. The upgrade is performed by the ProxyAdmin contract

**Beacon Factory Upgrades**:

1. Secure Admin Multi-sig proposes an upgrade through the 72-hour timelock
2. After the timelock delay, General Admin Multi-sig executes the upgrade
3. The upgrade is performed by the BeaconFactoryAdmin contract

> [!WARNING]
> Beacon factory upgrades affect all contracts deployed by the factory and should be treated with extreme caution.

### 4.2 Parameter Changes

Parameter changes involve updating configuration values in protocol contracts.

**Critical Parameter Changes**:

1. Secure Admin Multi-sig proposes the change through the 24-hour timelock
2. After the timelock delay, General Admin Multi-sig executes the change

**Standard Parameter Changes**:

1. General Admin Multi-sig proposes the change through the 6-hour timelock
2. After the timelock delay, General Admin Multi-sig executes the change

**Emergency Parameter Changes**:

1. Insecure Admin Safe directly executes the change (for parameters that allow this)

### 4.3 Emergency Actions

Emergency actions involve responding to critical situations that require immediate attention.

**Contract Pausing**:

1. Insecure Admin Safe directly pauses the affected contracts

**Emergency Mode Activation**:

1. General Admin Multi-sig activates emergency mode on affected contracts

**Emergency Recovery**:

1. Secure Admin Multi-sig proposes recovery actions through the appropriate timelock
2. After the timelock delay, General Admin Multi-sig executes the recovery actions

### 4.4 Fund Management

Fund management involves handling protocol fees and treasury operations.

**Fee Collection**:

1. Protocol fees are automatically sent to the Treasury Safe

**Fund Distribution**:

1. Treasury Safe signers propose a distribution plan
2. Treasury Safe signers execute the distribution after approval

**Emergency Fund Recovery**:

1. Secure Admin Multi-sig and Treasury Safe coordinate to recover funds in emergency situations
