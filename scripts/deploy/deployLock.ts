import hre, { ethers, network } from 'hardhat'
import { getDeployConfig, DeployableNetworks, saveDeploymentOutput } from './deploy.config'
import { DeployManager } from './DeployManager/DeployManager'
import { logger } from '../../hardhat/utils'
import { getCurrentGasPriceForNetwork } from '../../lib/evm/getCurrentGasPrice'
import { forkIfHardhat } from './utils/forkDeployHelper'
import { Lock__factory, LockUpgradeable__factory } from '../../typechain-types'
import { deployLockFixture } from './fixtures/deployLockFixture'
import { createActionLog } from './utils/actionLog'

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
  const [deployerAccount, hardhatAdminAccount, hardhatProxyAdminOwnerAddress] = accounts
  // Optionally pass in accounts to be able to use them in the deployConfig
  let deploymentVariables = await getDeployConfig(deployConfigNetwork)
  if (currentNetwork === 'hardhat') {
    logger.warn(`Using hardhat network, deploying with overriding accounts`)
    deploymentVariables = await getDeployConfig(deployConfigNetwork, {
      accountOverrides: {
        adminAddress: hardhatAdminAccount.address,
        proxyAdminOwnerAddress: hardhatProxyAdminOwnerAddress.address,
      },
    })
  }

  // Setup deploy manager, optionally pass in signer
  const deployManager = await DeployManager.create({ signer: deployerAccount, gasPriceOverride: estimatedGasPrice })
  // Actions to take after deployment to finalize deployment setup
  const { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog } = createActionLog()

  // -------------------------------------------------------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------------------------------------------------------
  const lockDeployment = await deployLockFixture(hre, deployManager, {
    accountOverrides: deploymentVariables.accounts,
    contractOverrides: deploymentVariables.contractOverrides,
  })

  // -------------------------------------------------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------------------------------------------------

  let output = {
    deployedContracts: {
      // Add in contract details here
      ...lockDeployment.addressOutput,
    },
    deploymentVariables,
    NEXT_ACTIONS: getActions(),
  }

  try {
    await saveDeploymentOutput(currentNetwork, output, true, true)
  } catch (e) {
    logger.error(`Error saving deployment output to file: ${e}`)
  }

  // NOTE: Verifications are verbose, would be nice to cut down on that. The contracts compile each time
  logger.log('Verifying contracts...', '🔎')
  await deployManager.verifyContracts()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
