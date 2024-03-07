import hre, { ethers } from 'hardhat'
import { Networks } from '../../hardhat'
import { HttpNetworkUserConfig } from 'hardhat/types'
import { logger } from '../../hardhat/utils'
import { BigNumber } from 'ethers'

/**
 * Get the current gas price for a given network.
 * @param {Networks} networkName - The name of the network to get the gas price from.
 * @returns {Promise<BigNumber>} A promise that resolves to the current gas price.
 */
export async function getCurrentGasPriceForNetwork(networkName: Networks): Promise<BigNumber> {
  const rpcUrl = getRpcUrl(networkName)
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl)

  const gasPrice = await provider.getGasPrice()
  const gasPriceInGwei = ethers.utils.formatUnits(gasPrice, 'gwei')

  logger.info(`Current gas price on ${networkName}: ${gasPriceInGwei} gwei`)

  return gasPrice
}

/**
 * Helper function to get the RPC URL from the Hardhat network configuration.
 * @param {Networks} networkName - The name of the network to get the RPC URL for.
 * @returns {string} The RPC URL of the specified network.
 */
function getRpcUrl(networkName: Networks): string {
  const networkConfig = hre.config.networks[networkName] as HttpNetworkUserConfig
  if (!networkConfig) {
    throw new Error(`No configuration found for network: ${networkName}`)
  }
  if (!networkConfig.url) {
    throw new Error(`No RPC URL found for network: ${networkName}`)
  }
  return networkConfig.url
}

// Example usage:
// Replace 'mainnet' with the actual network name you want to use
/*
getCurrentGasPriceForNetwork('mainnet').then(gasPrice => {
  console.log(`Current gas price on mainnet: ${gasPrice}`);
}).catch(error => {
  console.error(error);
});
*/
