import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Networks } from '../../hardhat'
import path from 'path'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'
import { writeObjectToTsFile } from '../../lib/node/files'
import { getDateMinuteString } from '../../lib/node/dateHelper'

// Define a base directory for deployments
export const DEPLOYMENTS_BASE_DIR = path.resolve(__dirname, '../../deployments')

/**
 * Get the deploy config for a given network
 * @param network
 * @returns
 */
export const getDeployConfig = (network: DeployableNetworks, signers?: SignerWithAddress[]): DeploymentVariables => {
  const config = deployableNetworkConfig[network]
  if (!config) {
    throw new Error(`No deploy config for network ${network}`)
  }
  return config(signers)
}

/**
 * Generates a file path for deployment based on the current date and network name, and saves the deployment details to that file.
 * @param networkName - The name of the network for which the deployment is being done
 * @param deploymentDetails - The details of the deployment to save
 */
export async function saveDeploymentOutput(
  networkName: Networks,
  deploymentDetails: {},
  convertAddressesToExplorerLinks: boolean
): Promise<{}> {
  // getDateMinuteString: YYYYMMDDTHH:MM
  const filePath = path.resolve(DEPLOYMENTS_BASE_DIR, `${getDateMinuteString()}-${networkName}-deployment`)
  if (convertAddressesToExplorerLinks) {
    deploymentDetails = convertAddressesToExplorerLinksByNetwork(deploymentDetails, networkName, true)
  }
  await writeObjectToTsFile(filePath, 'deployment', deploymentDetails)
  return deploymentDetails
}

/**
 * Extract networks as deployments are needed
 *
 * NOTE: Add networks as needed
 */
export type DeployableNetworks = Extract<Networks, 'hardhat' | 'bsc' | 'bscTestnet'>

/**
 * Deployment Variables for each network
 *
 * NOTE: Update variables as needed
 */
interface DeploymentVariables {
  proxyAdminAddress: string
  adminAddress: string | SignerWithAddress
  wNative: string
  contractOverrides?: {
    proxyAdminContractAddress?: string
  }
}

const deployableNetworkConfig: Record<DeployableNetworks, (signers?: SignerWithAddress[]) => DeploymentVariables> = {
  bsc: (signers?: SignerWithAddress[]) => {
    return {
      proxyAdminAddress: '0x',
      // NOTE: Example of extracting signers
      adminAddress: signers?.[0] || '0x',
      wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    }
  },
  bscTestnet: (signers?: SignerWithAddress[]) => {
    return {
      proxyAdminAddress: '0x',
      adminAddress: signers?.[0] || '0x',
      wNative: '0x',
    }
  },
  hardhat: (signers?: SignerWithAddress[]) => {
    return {
      proxyAdminAddress: '0x',
      adminAddress: signers?.[0] || '0x',
      wNative: '0x',
    }
  },
}
