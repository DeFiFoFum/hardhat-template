import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Networks } from '../../hardhat'
import path from 'path'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'
import { writeObjectToTsFile } from '../../lib/node/files'
import { getDateMinuteString } from '../../lib/node/dateHelper'
import { logger } from '../../hardhat/utils'

// Define a base directory for deployments
export const DEPLOYMENTS_BASE_DIR = path.resolve(__dirname, '../../deployments')

/**
 * Get the deploy config for a given network
 * @param network
 * @returns
 */
export const getDeployConfig = (network: DeployableNetworks, overrides: FixtureOverrides = {}): DeploymentVariables => {
  const config = deployableNetworkConfig[network]
  if (!config) {
    throw new Error(`No deploy config for network ${network}`)
  }
  return config(overrides)
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
export type DeployableNetworks = Extract<Networks, 'hardhat' | 'bsc' | 'bscTestnet'>

/**
 * The FixtureOverrides interface is used to provide custom overrides for the deployment configuration.
 * When calling getDeployConfig, you can pass an object conforming to this interface to override
 * the default account and contract settings specified in the deploy.config for a particular network.
 * This is useful for testing or when you need to deploy with specific parameters that differ from the defaults.
 */
export interface FixtureOverrides {
  accountOverrides?: Partial<DeploymentAccounts> // Overrides for account-related configurations
  contractOverrides?: DeploymentContractOverrides // Overrides for contract addresses or settings
}

/**
 * DeploymentAccounts defines the structure for account-related configurations
 * needed during the deployment process. It currently includes an adminAddress
 * which can be a string or a SignerWithAddress object.
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
 * Configuration for each deployable network. The structure is based on the interfaces above.
 *
 * accountOverrides and contractOverrides are optional and can be used to override configured values in this file.
 */
const addressPlaceholder = '0x-address-not-set-in_deploy.config'
const deployableNetworkConfig: Record<
  DeployableNetworks,
  ({ accountOverrides, contractOverrides }: FixtureOverrides) => DeploymentVariables
> = {
  bsc: ({ accountOverrides: ao, contractOverrides: co }: FixtureOverrides) => {
    return {
      accounts: {
        adminAddress: ao?.adminAddress || addressPlaceholder,
        proxyAdminOwnerAddress: ao?.proxyAdminOwnerAddress || addressPlaceholder,
      },
      contractOverrides: {
        proxyAdminContractAddress: co?.proxyAdminContractAddress || '',
      },
      wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    }
  },
  bscTestnet: ({ accountOverrides: ao, contractOverrides: co }: FixtureOverrides) => {
    return {
      accounts: {
        adminAddress: ao?.adminAddress || addressPlaceholder,
        proxyAdminOwnerAddress: ao?.proxyAdminOwnerAddress || addressPlaceholder,
      },
      contractOverrides: {
        proxyAdminContractAddress: co?.proxyAdminContractAddress || '',
      },
      wNative: addressPlaceholder,
    }
  },
  hardhat: ({ accountOverrides: ao, contractOverrides: co }: FixtureOverrides) => {
    return {
      accounts: {
        adminAddress: ao?.adminAddress || '',
        proxyAdminOwnerAddress: ao?.proxyAdminOwnerAddress || '',
      },
      contractOverrides: {
        proxyAdminContractAddress: co?.proxyAdminContractAddress || '',
      },
      wNative: addressPlaceholder,
    }
  },
}
