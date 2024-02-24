import { logger } from '../../../hardhat/utils'
import { setupFork } from '../../../test/utils'
import { DeployableNetworks } from '../deploy.config'

/**
 * Checks if the current network is Hardhat and if so, sets up a fork of the desired network.
 * This function is useful when you want to simulate a deployment on a test network or mainnet
 * while actually working on the Hardhat network. It allows you to test your contracts under
 * conditions that closely resemble the network you are targeting.
 *
 * @param currentNetwork - The network on which the deployment script is currently running.
 * @param desiredFork - The network you wish to fork if running on Hardhat.
 * @returns The network that should be used for deployment configuration. This will be the
 *          desired fork network if a fork was set up, or the original network otherwise.
 *
 * Usage example:
 * (async () => {
 *   // Suppose you are running your script on the Hardhat network but want to simulate
 *   // the deployment on the mainnet.
 *   const currentNetwork = network.name as DeployableNetworks
 *   const accounts = await ethers.getSigners()
 *   const deployConfigNetwork = await forkIfHardhat(currentNetwork, 'mainnet');
 *   const deployConfig = getDeployConfig(deployConfigNetwork, accounts)
 * })();
 */
export async function forkIfHardhat(currentNetwork: DeployableNetworks, desiredFork: DeployableNetworks) {
  let deployConfigNetwork = currentNetwork
  if (currentNetwork === 'hardhat') {
    logger.log(`Hardhat network detected, setting up fork for network ${desiredFork}`, '🍴')
    await setupFork(desiredFork)
    deployConfigNetwork = desiredFork
  }
  return deployConfigNetwork
}
