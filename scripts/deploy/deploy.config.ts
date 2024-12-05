import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Networks } from '../../hardhat'
import path from 'path'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'
import { writeObjectToTsFile } from '../../lib/node/files'
import { getDateMinuteString } from '../../lib/node/dateHelper'
import { logger } from '../../hardhat/utils'
import { ethers } from 'hardhat'

// Define a base directory for deployments
export const DEPLOYMENTS_BASE_DIR = path.resolve(__dirname, '../../deployments')

/**
 * Get the deploy config for a given network
 * @param network
 * @returns
 */
export async function getDeployConfig(
  network: DeployableNetworks,
  overrides: FixtureOverrides = {}
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
  logOutput: boolean
): Promise<{}> {
  // getDateMinuteString: YYYYMMDDTHH:MM
  const filePath = path.resolve(DEPLOYMENTS_BASE_DIR, `${getDateMinuteString()}-${networkName}-deployment`)
  if (convertAddressesToExplorerLinks) {
    deploymentDetails = convertAddressesToExplorerLinksByNetwork(deploymentDetails, networkName, true)
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
export type DeployableNetworks = Extract<Networks, 'hardhat' | 'bsc' | 'bscTestnet' | 'blast'>

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
 * DeploymentAccounts defines the structure for account-related configurations
 * needed during the deployment process.
 *
 * Extend or modify this interface to include additional account-related configurations as needed.
 */
export interface DeploymentAccounts {
  adminAddress: string
  proxyAdminOwnerAddress: string
}

/**
 * DeploymentContractOverrides allows for specifying addresses of already deployed
 * contracts or for overriding the default addresses during deployment.
 *
 * Extend or modify this interface to include overrides for additional contracts as needed.
 */
export interface DeploymentContractOverrides {
  proxyAdminContractAddress?: string
}

/**
 * Deployment variables used for the deployment of contracts in this project.
 *
 * Extend or modify the DeploymentVariables interface if additional variables are required.
 */
interface DeploymentVariables {
  // Accounts and contract overrides should be configured above
  accounts: DeploymentAccounts
  contractOverrides: DeploymentContractOverrides
  // These deployment variables can be changed and extended as needed.
  wNative: string
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
  { accountOverrides, contractOverrides }: FixtureOverrides
): DeploymentVariables {
  return {
    ...productionValues,
    accounts: { ...productionValues.accounts, ...accountOverrides },
    contractOverrides: { ...productionValues.contractOverrides, ...contractOverrides },
  }
}

/**
 * Configuration for each deployable network. The structure is based on the interfaces above.
 *
 * accountOverrides and contractOverrides are optional and can be used to override configured values in this file.
 */
const addressPlaceholder = '0x-address-not-set-in_deploy.config'
const deployableNetworkConfig: Record<
  DeployableNetworks,
  (fixtureOverrides: FixtureOverrides) => Promise<DeploymentVariables>
> = {
  blast: async (fixtureOverrides: FixtureOverrides) => {
    const productionValues = {
      accounts: {
        adminAddress: addressPlaceholder,
        proxyAdminOwnerAddress: addressPlaceholder,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        // proxyAdminContractAddress: '',
      },
      wNative: '',
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
  bsc: async (fixtureOverrides: FixtureOverrides) => {
    const productionValues = {
      accounts: {
        adminAddress: addressPlaceholder,
        proxyAdminOwnerAddress: addressPlaceholder,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        // proxyAdminContractAddress: '',
      },
      wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
  bscTestnet: async (fixtureOverrides: FixtureOverrides) => {
    const productionValues = {
      accounts: {
        adminAddress: addressPlaceholder,
        proxyAdminOwnerAddress: addressPlaceholder,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        // proxyAdminContractAddress: '',
      },
      wNative: addressPlaceholder,
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
  hardhat: async (fixtureOverrides: FixtureOverrides) => {
    if (!fixtureOverrides.accountOverrides) {
      logger.log(
        `deploy.config:: No FixtureOverrides passed, using default account overrides for hardhat network`,
        '📝'
      )
    }
    const accounts = await ethers.getSigners()
    const productionValues = {
      accounts: {
        adminAddress: accounts[0].address,
        proxyAdminOwnerAddress: accounts[0].address,
      },
      // Optionally pass contract overrides to skip deployments already made in fixtures
      contractOverrides: {
        // proxyAdminContractAddress: '',
      },
      wNative: addressPlaceholder,
    }
    // Optionally pass override values over production for easier reusability in fixtures
    return applyFixtureOverrides(productionValues, fixtureOverrides)
  },
}
