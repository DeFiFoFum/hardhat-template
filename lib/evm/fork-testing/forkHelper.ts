import hre, { network } from 'hardhat'
import { logger } from '../../../hardhat/utils'
import { Networks } from '../../../hardhat'
import { HttpNetworkConfig } from 'hardhat/types'
import { getErrorMessage } from '../../node/getErrorMessage'

/**
 * Sets up a network fork for testing purposes.
 *
 * This function is used to simulate a fork of a specified blockchain network at a given block number.
 * It can be useful for testing contracts and interactions in a controlled environment that mirrors
 * the state of the main network at a specific point in time.
 *
 * @param networkName The name of the network to fork. This should match one of the network names
 *                    configured in the Hardhat configuration file (hardhat.config.ts).
 * @param blockNumber The block number at which to fork the network. This allows you to set the state
 *                    of the forked network to that of the main network at the specified block.
 *
 * Example usage:
 * ```
 * // To fork the mainnet at block number 12345678
 * await setupFork('mainnet', 12345678);
 * // To fork 'latest', omit the block number
 * await setupFork('mainnet');
 * ```
 *
 * Note: After calling this function, you will be interacting with a local version of the specified
 * network that starts at the given block number. Any transactions or calls you make will be
 * reflected in this local fork and will not affect the actual network.
 *
 * Throws an error if the RPC URL for the specified network is not found in the Hardhat configuration.
 */

export async function setupFork(networkName: Networks, blockNumber?: number) {
  logger.log(`Setting up fork of ${networkName} at block ${blockNumber ? blockNumber : 'latest'}.`, '🍴')

  const forkingNetworkConfig = hre.config.networks[networkName] as HttpNetworkConfig
  if (!forkingNetworkConfig.url) throw Error(`Could not find a RPC url in network config for ${networkName}`)

  try {
    await network.provider.request({
      method: 'hardhat_reset',
      params: [
        {
          forking: {
            jsonRpcUrl: forkingNetworkConfig.url,
            blockNumber: blockNumber,
          },
        },
      ],
    })
  } catch (e) {
    const errorMessage = getErrorMessage(e)
    logger.error(`setupFork:: Error setting up fork: ${errorMessage}`)
    throw new Error(errorMessage)
  }

  const latestBlock = await hre.network.provider.send('eth_blockNumber')
  blockNumber = parseInt(latestBlock, 16)
  logger.log(`Fork has been setup. Starting a block: ${blockNumber}.`, '🍴')
  return blockNumber
}

/**
 * Resets the local fork to its original state.
 *
 * This function is used to reset the state of the local forked network to its original state before any transactions
 * or calls were made. This can be useful when you want to run multiple tests in succession without interference from
 * the changes made in previous tests.
 *
 * Example usage:
 * ```
 * // To reset the forked network to its initial state
 * await resetFork();
 * ```
 *
 * Note: After calling this function, the local fork will be in the same state as it was immediately after the
 * original call to `setupFork`. Any transactions or calls made after the fork was set up will be undone.
 */

export async function resetFork() {
  logger.log('Resetting fork', '🍴')
  await network.provider.request({
    method: 'hardhat_reset',
    params: [],
  })
}
