import { ethers } from 'hardhat'
import { Networks } from '../../hardhat'
import { geRpcUrlForNetwork } from '../../hardhat.config'
import { logger } from '../../hardhat/utils'

/**
 * Retrieves the proxy admin address for a given proxy contract on a specified network.
 *
 * This function queries the Ethereum blockchain for the storage at a specific slot
 * known to contain the address of the proxy admin for a given proxy contract. It
 * constructs a JSON-RPC request to fetch the storage at the slot corresponding to
 * the proxy admin address, then formats and returns the address.
 *
 * @param {Networks} networkName - The network to query (e.g., 'mainnet', 'ropsten', 'bscTestnet').
 * @param {string} address - The address of the proxy contract whose admin address is to be fetched.
 * @returns {Promise<string>} A promise that resolves to the proxy admin address.
 *
 * @example
 * // Get the proxy admin address for a proxy contract on Binance Smart Chain testnet
 * const proxyAdminAddress = await getProxyAdminOfProxyContract('bscTestnet', '0x123...');
 * console.log(proxyAdminAddress); // Outputs: '0x456...'
 *
 * @throws Will throw an error if the network is not found or if the storage cannot be fetched.
 */

export async function getProxyAdminOfProxyContract(networkName: Networks, address: string) {
  const networkUrl = geRpcUrlForNetwork(networkName)

  if (!networkUrl) {
    throw new Error('getProxyAdminOfProxyContract:: Network not found')
  }

  const data = JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getStorageAt',
    params: [address, '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103', 'latest'],
    id: 1,
  })

  const response = await fetch(networkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  }).then((res) => res.json())

  if (!response.result) {
    throw new Error('Failed to get the storage from the network')
  }

  const proxyAdminAddress = '0x' + response.result.slice(26)

  let proxyAdminOwner
  try {
    proxyAdminOwner = await ethers.getContractAt('Ownable', proxyAdminAddress).then((contract) => contract.owner())
  } catch (e) {
    logger.error('Error getting proxy admin owner.')
    console.dir(e)
    proxyAdminOwner = 'no-owner-found'
  }
  return { proxyAdminAddress, proxyAdminOwner }
}
