import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Networks } from '../../hardhat'
import path from 'path'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/address/convertAddresses'
import { getAddressToNameMap } from '../../lib/evm/address/addressBookHelper'
import { writeObjectToTsFile } from '../../lib/node/files'
import { getDateMinuteString } from '../../lib/node/dateHelper'
import { logger } from '../../hardhat/utils'
import { ethers } from 'hardhat'
import { DeploymentAccounts, DeploymentContractOverrides, DeploymentVariables, MultisigConfig } from './deploy.schemas'

// Re-export types for backward compatibility
export type { DeploymentAccounts, DeploymentContractOverrides, DeploymentVariables }

// Define a base directory for deployments
export const DEPLOYMENTS_BASE_DIR = path.resolve(__dirname, '../../deployments')

/**
 * Get the deploy config for a given network
 * @param network
 * @returns
 */
export async function getDeployConfig(
  network: DeployableNetworks,
  overrides: FixtureOverrides = {},
): Promise<DeploymentVariables> {
  const config = deployableNetworkConfig[network]
  if (!config) {
    throw new Error(`No deploy config for network ${network}`)
  }
  return await config(overrides)
}

/**
 * Generates a file path for deployment based on the current date and network name, and saves the deployment details to that file.
 * @param networkName - The name of the network for which the deployment is being done
 * @param deploymentDetails - The details of the deployment to save
 */
export async function saveDeploymentOutput(
  networkName: Networks,
  deploymentDetails: {},
  convertAddressesToExplorerLinks: boolean,
  logOutput: boolean,
): Promise<{}> {
  // getDateMinuteString: YYYYMMDDTHH:MM
  const filePath = path.resolve(DEPLOYMENTS_BASE_DIR, `${getDateMinuteString()}-${networkName}-deployment`)
  if (convertAddressesToExplorerLinks) {
    let addressToNameMap: Record<string, string> | undefined = undefined

    // Try to load address book, but continue even if it fails
    const addressBookPath = path.join(__dirname, '../../lib/evm/address/safe-address-book-latest.csv')
    try {
      addressToNameMap = getAddressToNameMap(addressBookPath, parseInt(networkName))
    } catch (error) {
      logger.warn(`Failed to load address book: ${error instanceof Error ? error.message : String(error)}`)
      logger.warn(`Address book path: ${addressBookPath}`)
    }

    // Convert addresses to explorer links, with optional name mapping
    deploymentDetails = convertAddressesToExplorerLinksByNetwork(deploymentDetails, networkName, addressToNameMap)
  }
  if (logOutput) {
    logger.log(`Deployment output for ${networkName}:`, '📝')
    console.dir(deploymentDetails, { depth: null })
  }
  await writeObjectToTsFile(filePath, 'deployment', deploymentDetails)
  logger.log(`Deployment output saved to: ${filePath}.ts`, '📝')
  return deploymentDetails
}

/**
 * DeployableNetworks is a subset of the Networks type, specifically including
 * networks where deployment scripts will be executed. To support additional networks,
 * extend the Extract type with the network's key as defined in the Networks type.
 */
export type DeployableNetworks = Extract<Networks, 'hardhat' | 'bsc' | 'bscTestnet'>

/**
 * The FixtureOverrides interface is used to provide custom overrides for the deployment configuration.
 * When calling getDeployConfig, you can pass an object conforming to this interface to override
 * the default account and contract settings specified in the deploy.config for a particular network.
 * This is useful for testing or when you need to deploy with specific parameters that differ from the defaults.
 */
export interface FixtureOverrides {
  accountOverrides?: Partial<DeploymentAccounts> // Overrides for account-related configurations
  contractOverrides?: Partial<DeploymentContractOverrides> // Overrides for contract addresses or settings
}

/**
 * Apply overrides to the production values. This is useful for composing and testing fixtures,
 *  as well as for certain scripts.
 *
 * @param {DeploymentVariables} productionValues
 * @param {FixtureOverrides} fixtureOverrides
 * @returns
 */
function applyFixtureOverrides(
  productionValues: DeploymentVariables,
  { accountOverrides, contractOverrides }: FixtureOverrides,
): DeploymentVariables {
  return {
    ...productionValues,
    accounts: { ...productionValues.accounts, ...accountOverrides },
    contractOverrides: { ...productionValues.contractOverrides, ...contractOverrides },
  }
}

const ADDRESS_PLACEHOLDER = '0x-address-not-set-in_deploy.config'

/**
 * Multisig config for Omnichain Multisig Safes
 */
const omniChainMultisigConfig: MultisigConfig = {
  // TODO: Configure
  SecureAdminSafe: ADDRESS_PLACEHOLDER,
  GeneralAdminSafe: ADDRESS_PLACEHOLDER,
  InsecureAdminSafe: ADDRESS_PLACEHOLDER,
}

/**
 * Configuration for each deployable network. The structure is based on the interfaces above.
 *
 * accountOverrides and contractOverrides are optional and can be used to override configured values in this file.
 */
const deployableNetworkConfig: Record<
  DeployableNetworks,
  (fixtureOverrides: FixtureOverrides) => Promise<DeploymentVariables>
> = {
  bsc: async (fixtureOverrides: FixtureOverrides) => {
    const productionValues: DeploymentVariables = {
      accounts: {
        adminAddress: ADDRESS_PLACEHOLDER,
        multisigConfig: null,
        proxyAdminOwnerAddress: null,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        adminContracts: {
          proxyAdminContractAddress: null,
          timelock_OneDay: null,
          timelock_ThreeDay: null,
        },
        protocolContracts: {},
      },
      wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
  bscTestnet: async (fixtureOverrides: FixtureOverrides) => {
    const productionValues: DeploymentVariables = {
      accounts: {
        adminAddress: ADDRESS_PLACEHOLDER,
        multisigConfig: null,
        proxyAdminOwnerAddress: null,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        adminContracts: {
          proxyAdminContractAddress: null,
          timelock_OneDay: null,
          timelock_ThreeDay: null,
        },
        protocolContracts: {},
      },
      wNative: ADDRESS_PLACEHOLDER,
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
  hardhat: async (fixtureOverrides: FixtureOverrides) => {
    if (!fixtureOverrides.accountOverrides) {
      logger.log(
        `deploy.config:: No FixtureOverrides passed, using default account overrides for hardhat network`,
        '📝',
      )
    }
    const accounts = await ethers.getSigners()
    const productionValues: DeploymentVariables = {
      accounts: {
        adminAddress: accounts[0].address,
        multisigConfig: null,
        proxyAdminOwnerAddress: accounts[0].address,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        adminContracts: {
          proxyAdminContractAddress: null,
          timelock_OneDay: null,
          timelock_ThreeDay: null,
        },
        protocolContracts: {},
      },
      wNative: ADDRESS_PLACEHOLDER,
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
}
