import { ethers, network } from 'hardhat'
import { getDeployConfig, DeployableNetworks, saveDeploymentOutput } from './deploy.config'
import { DeployManager } from './DeployManager'
import { logger } from '../../hardhat/utils'
import { setupFork } from '../../lib/evm/forkHelper'
import { createActionLog } from './utils/actionLog'

async function main() {
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
  const deployer = accounts[0]
  const deployerAddress = await deployer.getAddress()
  // Setup deploy manager
  const deployManager = await DeployManager.create({ signer: deployer })
  // Extract config for the network
  const deployConfig = getDeployConfig(deployConfigNetwork, accounts)
  // Contract overrides
  const contractOverrides = deployConfig.contractOverrides
  // Optional, used throughout the script and will be deployed if not passed
  let proxyAdminContractAddress = contractOverrides?.proxyAdminContractAddress
  // Actions to take after deployment to finalize deployment setup
  const { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog } = createActionLog()

  const currentTimestampInSeconds = Math.round(Date.now() / 1000)
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60
  const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS

  const lockedAmount = ethers.utils.parseEther('.00001')

  const lock = await deployManager.deployContract('Lock', [unlockTime, accounts[0].address, { value: lockedAmount }])
  logger.log(`Lock with 1 ETH deployed to: ${lock.address}`, '🔒')

  const { implementationThroughProxy: lockUpgradable } = await deployManager.deployUpgradeableContract(
    'LockUpgradeable',
    [unlockTime, accounts[0].address]
  )
  logger.log(`LockUpgradeable to: ${lockUpgradable.address}`, '🔒')

  await deployManager.verifyContracts()

  // -----------------------------------------------------------------------------------------------
  // Output
  // -----------------------------------------------------------------------------------------------

  let output = {
    deployedContracts: {
      // Add in contract details here
    },
    deployConfig,
    NEXT_ACTIONS: getActions(),
  }

  try {
    console.dir(output)
    logger.log('Writing deployment output to file...', '📝')
    await saveDeploymentOutput(currentNetwork, output, true)
  } catch (e) {
    logger.error(`Error saving deployment output to file: ${e}`)
  }

  // NOTE: Verifications are verbose, would be nice to cut down on that. The contracts compile each time
  if (currentNetwork !== 'hardhat') {
    logger.log('Verifying contracts...', '🔎')
    await deployManager.verifyContracts()
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
