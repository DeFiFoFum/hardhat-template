import { z } from 'zod'
import { logger } from '../../lib/node/logger'

/**
  // Example usage in deployment scripts:

  // In configuration, addresses can be null
  const config: DeploymentContractOverrides = {
    adminContracts: {
      proxyAdminContractAddress: null,
      timelock_ThreeDay: null,
      ...
    },
    ...
  }

  // In deployment script that requires non-null addresses:
  const result = validateDeploymentAdminContracts(config.adminContracts)
  if (!result.success) {
    throw new Error(`Missing required contract addresses: ${result.error.map(e => e.message).join(', ')}`)
  }
  // result.data is now typed as RequiredAdminContracts with no null values
  const contracts: RequiredAdminContracts = result.data
 */

// ---------------------------------------------------------------------------------------------------------------------
//
// 🚀 Deploy Configuration Schemas 🚀
//
// ---------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------
// Accounts Types
// ---------------------------------------------------------------------------------------------------------------------

// Schema for addresses - must be valid Ethereum addresses
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address')

export const multisigConfigSchema = z
  .object({
    SecureAdminSafe: addressSchema,
    GeneralAdminSafe: addressSchema,
    InsecureAdminSafe: addressSchema,
  })
  .strict()
export type MultisigConfig = z.infer<typeof multisigConfigSchema>

// Schema for deployment accounts
export const deploymentAccountsSchema = z
  .object({
    adminAddress: addressSchema,
    multisigConfig: multisigConfigSchema.nullable(),
    // NOTE: Used in place of the SecureAdminSafe if null
    proxyAdminOwnerAddress: addressSchema.nullable(),
  })
  .strict()
export type DeploymentAccounts = z.infer<typeof deploymentAccountsSchema>

// ---------------------------------------------------------------------------------------------------------------------
// Admin Contract Overrides Types
// ---------------------------------------------------------------------------------------------------------------------

// Schema for admin contract overrides (configuration)
const adminContractsSchema = z
  .object({
    proxyAdminContractAddress: addressSchema.nullable(),
    timelock_OneDay: addressSchema.nullable(),
    timelock_ThreeDay: addressSchema.nullable(),
  })
  .strict()
export type AdminContracts = z.infer<typeof adminContractsSchema>

// Schema for required admin contracts (deployment)
const requiredAdminContractsSchema = z
  .object({
    proxyAdminContractAddress: addressSchema,
    timelock_OneDay: addressSchema,
    timelock_ThreeDay: addressSchema,
  })
  .strict()
export type RequiredAdminContracts = z.infer<typeof requiredAdminContractsSchema>

// ---------------------------------------------------------------------------------------------------------------------
// Protocol Contract Overrides Types
// ---------------------------------------------------------------------------------------------------------------------

// Schema for protocol contract overrides
const protocolContractsSchema = z.object({}).strict()
export type ProtocolContracts = z.infer<typeof protocolContractsSchema>

// ---------------------------------------------------------------------------------------------------------------------
// Deployment Variables Types
// ---------------------------------------------------------------------------------------------------------------------

// Schema for contract overrides
export const deploymentContractOverridesSchema = z
  .object({
    adminContracts: adminContractsSchema,
    protocolContracts: protocolContractsSchema,
  })
  .strict()
export type DeploymentContractOverrides = z.infer<typeof deploymentContractOverridesSchema>

// Utility type to make all properties non-nullable
export type RequiredProperties<T> = {
  [P in keyof T]: NonNullable<T[P]>
}

// Schema for deployment variables
export const deploymentVariablesSchema = z
  .object({
    accounts: deploymentAccountsSchema,
    contractOverrides: deploymentContractOverridesSchema,
    wNative: addressSchema,
  })
  .strict()
export type DeploymentVariables = z.infer<typeof deploymentVariablesSchema>

// ---------------------------------------------------------------------------------------------------------------------
//
// 🔍 Validation Functions 🔍
//
// ---------------------------------------------------------------------------------------------------------------------

export function validateConfigAccounts(accounts: DeploymentVariables['accounts']) {
  try {
    const result = deploymentAccountsSchema.parse(accounts)
    return {
      success: true as const,
      data: result,
    }
  } catch (error) {
    logger.error(`validateConfigAccounts:: Invalid accounts config: ${JSON.stringify(error)}`)

    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      }
    }
    return {
      success: false as const,
      error: [{ path: 'unknown', message: 'Unknown validation error' }],
    }
  }
}

export function validateConfigAdminContracts(contractOverrides: DeploymentContractOverrides['adminContracts']) {
  try {
    const result = adminContractsSchema.parse(contractOverrides)
    return {
      success: true as const,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      }
    }
    return {
      success: false as const,
      error: [{ path: 'unknown', message: 'Unknown validation error' }],
    }
  }
}

export function validateDeploymentAdminContracts(contractOverrides: DeploymentContractOverrides['adminContracts']):
  | {
      success: true
      data: RequiredAdminContracts
    }
  | {
      success: false
      error: { path: string; message: string }[]
    } {
  // First validate the basic structure
  const configResult = validateConfigAdminContracts(contractOverrides)
  if (!configResult.success) {
    return configResult
  }

  // Then validate that all required fields are non-null
  try {
    const result = requiredAdminContractsSchema.parse(contractOverrides)
    return {
      success: true as const,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: `Required contract address is null: ${err.path.join('.')}`,
        })),
      }
    }
    return {
      success: false as const,
      error: [{ path: 'unknown', message: 'Unknown validation error' }],
    }
  }
}

export function validateContractOverrides(contractOverrides: DeploymentContractOverrides) {
  try {
    const result = deploymentContractOverridesSchema.parse(contractOverrides)
    return {
      success: true as const,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      }
    }
    return {
      success: false as const,
      error: [{ path: 'unknown', message: 'Unknown validation error' }],
    }
  }
}
