import hre, { ethers, network } from 'hardhat'
import { getDeployConfig, DeployableNetworks, saveDeploymentOutput, FixtureOverrides } from './deploy.config'
import { DeployManager } from './DeployManager/DeployManager'
import { logger } from '../../hardhat/utils'
import { createActionLog } from './utils/actionLog'
import { deployLockFixture } from './fixtures/deployLockFixture'
import { forkIfHardhat } from './utils/forkDeployHelper'

async function main() {
  // -------------------------------------------------------------------------------------------------------------------
  // Network Setup and Configuration
  // -------------------------------------------------------------------------------------------------------------------
  const initialNetwork = network.name as DeployableNetworks
  const currentNetwork = await forkIfHardhat(initialNetwork, 'bsc') // Fork if on hardhat network
  // Setup DeployManager
  const [deployerSigner] = await ethers.getSigners()
  const deployManager = await DeployManager.create({ signer: deployerSigner })
  // Setup deployment configuration variables. Optionally pass in accounts to be able to use them in the deployConfig
  const fixtureOverrides: FixtureOverrides = { accountOverrides: {}, contractOverrides: {} } // Template to override fixture data
  const deploymentVariables = await getDeployConfig(currentNetwork, fixtureOverrides)
  const { accounts: deploymentAccounts, contractOverrides } = deploymentVariables

  // Optional, used throughout the script and will be deployed if not passed
  const proxyAdminContractAddress = contractOverrides?.adminContracts.proxyAdminContractAddress
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
