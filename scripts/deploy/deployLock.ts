import { ethers, network } from 'hardhat'
import { getDeployConfig, DeployableNetworks } from './deploy.config'
import { DeployManager } from './DeployManager'
import { logger } from '../../hardhat/utils'
import { getCurrentGasPriceForNetwork } from '../../lib/evm/getCurrentGasPrice'
import { forkIfHardhat } from './utils/forkDeployHelper'
import { Lock__factory, LockUpgradeable__factory } from '../../typechain-types'

/**
 * // NOTE: This is an example of the default hardhat deployment approach.
 * This project takes deployments one step further by assigning each deployment
 * its own task in ../tasks/ organized by date.
 */
async function main() {
  // -------------------------------------------------------------------------------------------------------------------
  // Deployment Setup
  // -------------------------------------------------------------------------------------------------------------------
  // Setup network and fork if hardhat
  const currentNetwork = network.name as DeployableNetworks
  const dryRunNetwork: DeployableNetworks = 'bsc'
  const deployConfigNetwork = await forkIfHardhat(currentNetwork, dryRunNetwork)

  // Estimate gas price
  const estimatedGasPrice = await getCurrentGasPriceForNetwork(deployConfigNetwork)
  logger.log(`Deploy estimated gas price: ${ethers.utils.formatUnits(estimatedGasPrice.toString(), 'gwei')} gwei`, `⛽`)
  // Setup accounts
  const accounts = await ethers.getSigners()
  const deployerAccount = accounts[0]
  // Optionally pass in accounts to be able to use them in the deployConfig
  const deploymentVariables = getDeployConfig(deployConfigNetwork, accounts)

  // Setup deploy manager, optionally pass in signer
  const deployManager = await DeployManager.create({ signer: deployerAccount, gasPriceOverride: estimatedGasPrice })

  // -------------------------------------------------------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------------------------------------------------------

  const currentTimestampInSeconds = Math.round(Date.now() / 1000)
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60
  const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS

  const lockedAmount = ethers.utils.parseEther('.00001')

  const lock = await deployManager.deployContract<Lock__factory>('Lock', [
    unlockTime,
    accounts[0].address,
    { value: lockedAmount },
  ])
  logger.log(`Lock with 1 ETH deployed to: ${lock.address}`, '🔒')

  const { implementationThroughProxy: lockUpgradable } =
    await deployManager.deployUpgradeableContract<LockUpgradeable__factory>('LockUpgradeable', [
      unlockTime,
      accounts[0].address,
    ])
  logger.log(`LockUpgradeable to: ${lockUpgradable.address}`, '🔒')
  await deployerAccount.sendTransaction({
    to: lockUpgradable.address,
    value: lockedAmount,
  })
  logger.log(
    `Transferred ${ethers.utils.formatEther(lockedAmount)} ETH to LockUpgradeable at: ${lockUpgradable.address}`,
    '💸'
  )

  await deployManager.verifyContracts()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
