import { ethers } from 'hardhat'
import { Networks } from '../../hardhat'
import { logger } from '../../hardhat/utils'
import { convertStorageValueToAddress, getStorageAtNetwork } from './storage/getStorageAt'

export const EIP1967_ADMIN_SLOT = `0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103`
export const EIP1967_IMPLEMENTATION_SLOT = `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc`

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

export async function getProxyAdminOfProxyContract(
  networkName: Networks,
  contractAddress: string,
): Promise<{ proxyAdminAddress: string; proxyAdminOwner: string | null }> {
  const storageValue = await getStorageAtNetwork(contractAddress, EIP1967_ADMIN_SLOT, networkName)
  const proxyAdminAddress = convertStorageValueToAddress(storageValue)

  let proxyAdminOwner = null
  try {
    proxyAdminOwner = await ethers.getContractAt('Ownable', proxyAdminAddress).then((contract) => contract.owner())
  } catch (e) {
    logger.warn(
      `getProxyAdminOfProxyContract:: owner() not a valid function on the address of the ProxyAdmin ${proxyAdminAddress}.`,
    )
  }
  return { proxyAdminAddress, proxyAdminOwner }
}

export async function getImplementationOfProxyContract(networkName: Networks, contractAddress: string) {
  const storageValue = await getStorageAtNetwork(contractAddress, EIP1967_IMPLEMENTATION_SLOT, networkName)
  const implementationAddress = convertStorageValueToAddress(storageValue)

  return implementationAddress
}
