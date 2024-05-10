import hre, { ethers, network } from 'hardhat'
import { getDeployConfig, DeployableNetworks, saveDeploymentOutput } from './deploy.config'
import { DeployManager } from './DeployManager'
import { logger } from '../../hardhat/utils'
import { setupFork } from '../../lib/evm/forkHelper'
import { createActionLog } from './utils/actionLog'
import { deployLockFixture } from './fixtures/deployLockFixture'

async function main() {
  // -------------------------------------------------------------------------------------------------------------------
  // Network Setup and Configuration
  // -------------------------------------------------------------------------------------------------------------------
  const currentNetwork = network.name as DeployableNetworks
  let deployConfigNetwork = currentNetwork
  if (currentNetwork === 'hardhat') {
    logger.log('Hardhat network detected, setting up fork...', '🍴')
    // NOTE: choosing fork network
    const forkedNetwork = 'bsc'
    await setupFork(forkedNetwork)
    deployConfigNetwork = forkedNetwork
  }

  const accounts = await ethers.getSigners()
  // Extract config for the network
  const [deployerAccount, hardhatAdminAccount, hardhatProxyAdminOwnerAddress] = accounts
  // Setup deploy manager
  const deployManager = await DeployManager.create({ signer: deployerAccount })
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
  // Contract overrides
  const contractOverrides = deploymentVariables.contractOverrides
  // Optional, used throughout the script and will be deployed if not passed
  let proxyAdminContractAddress = contractOverrides?.proxyAdminContractAddress
  // Actions to take after deployment to finalize deployment setup
  const { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog } = createActionLog()

  // -------------------------------------------------------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------------------------------------------------------
  const lockDeployment = await deployLockFixture(hre, deployManager, {
    accountOverrides: deploymentVariables.accounts,
    contractOverrides: deploymentVariables.contractOverrides,
  })

  // -----------------------------------------------------------------------------------------------
  // Output
  // -----------------------------------------------------------------------------------------------

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
