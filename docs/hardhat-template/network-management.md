---
title: Network Management
version: 1.0.0
created: 2025-03-26
updated: 2025-03-26
tags: [networks, configuration, accounts, security]
parent_index: index-hardhat-template.md
---

# 🌐 Network Management

This document explains how to manage networks and accounts in the Hardhat template, including the security-focused approach to account separation.

## 📑 Table of Contents

- [🌐 Network Management](#-network-management)
  - [📑 Table of Contents](#-table-of-contents)
  - [🔐 Account Management](#-account-management)
    - [Account Tiers](#account-tiers)
  - [🔧 Network Configuration](#-network-configuration)
  - [🆕 Adding New Networks](#-adding-new-networks)
  - [🛡️ Security Best Practices](#️-security-best-practices)

[↑ Back to Parent Index](../index-hardhat-template.md)

## 🔐 Account Management

The template implements a three-tier account management system for enhanced security:

### Account Tiers

1. **MAINNET Accounts**
   - Primary production deployment accounts
   - Used for final contract deployments
   - Highest security requirement
   - Environment Variables: `MAINNET_MNEMONIC` or `MAINNET_PRIVATE_KEY`

2. **MAINNET_DUMMY Accounts**
   - Used for mainnet testing and verification
   - Prevents front-running of actual deployments
   - Environment Variables: `MAINNET_DUMMY_MNEMONIC` or `MAINNET_DUMMY_PRIVATE_KEY`

3. **TESTNET Accounts**
   - Used for testnet deployments and testing
   - Lower security requirement
   - Environment Variables: `TESTNET_MNEMONIC` or `TESTNET_PRIVATE_KEY`

> [!IMPORTANT]
> Never share or commit private keys or mnemonics. Always use environment variables.

[↑ Back to Top](#-network-management)

## 🔧 Network Configuration

Networks are configured using a type-safe approach with the `NetworkUserConfigExtended` interface. Each network configuration includes:

- RPC URL
- Chain ID
- Account configuration
- Block explorer URL helper

Example configuration:

```typescript
{
  url: getEnv('NETWORK_RPC_URL') || 'https://default-rpc.network',
  getExplorerUrl: (address: string) => `https://explorer.network/address/${address}`,
  chainId: 1234,
  accounts: networkAccounts,
}
```

[↑ Back to Top](#-network-management)

## 🆕 Adding New Networks

To add a new network:

1. Add the network name to the `NETWORKS` array
2. Create network configuration in `networkConfig`
3. Add explorer API key if needed
4. Update custom chain configuration if required

Example:

```typescript
// Add to NETWORKS array
export const NETWORKS = <const>[
  // ... existing networks ...
  'newNetwork',
]

// Add network configuration
const networkConfig: ExtendedHardhatNetworkConfig = {
  // ... existing networks ...
  newNetwork: {
    url: getEnv('NEW_NETWORK_RPC_URL') || 'https://rpc.newnetwork.org',
    getExplorerUrl: (address: string) => `https://explorer.newnetwork.org/address/${address}`,
    chainId: 1234,
    accounts: mainnetAccounts, // or testnetAccounts based on network type
  },
}
```

[↑ Back to Top](#-network-management)

## 🛡️ Security Best Practices

1. **Account Separation**
   - Use different accounts for testing and production
   - Keep MAINNET accounts strictly for final deployments
   - Use MAINNET_DUMMY for verification and testing

2. **Environment Variables**
   - Never hardcode private keys or mnemonics
   - Use `.env` file for local development
   - Use secure secrets management in CI/CD

3. **RPC Endpoints**
   - Use reliable RPC providers
   - Always provide fallback URLs
   - Consider using private RPC endpoints for production

> [!WARNING]
> Always verify you're using the correct account tier for your current operation to prevent accidental mainnet deployments with production accounts.

[↑ Back to Top](#-network-management)
