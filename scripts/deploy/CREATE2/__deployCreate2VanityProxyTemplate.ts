import hre, { ethers, network } from 'hardhat'
import { DeployableNetworks, FixtureOverrides, getDeployConfig, saveDeploymentOutput } from '../deploy.config'
import { DeployManager } from '../DeployManager/DeployManager'
import { forkIfHardhat } from '../utils/forkDeployHelper'
import { createActionLog } from '../utils/actionLog'
import { CREATE2_DEPLOYER } from '.'
import { CreateXDeployer } from '../../../lib/evm/create2/CreateXDeployer'
import { logger } from '../../../lib/node/logger'
import { LockUpgradeable__factory } from '../../../typechain-types'
import {
  formatNamedProxyContractName,
  SupportedNamedProxyContractNames,
} from '../../../lib/evm/proxy/namedProxy.config'

// TODO: Generate with vanity_generator_create2.rs
const salts = [
  {
    salt: '0xff6425c998ee8b75e0996bd19f74505a7a07e918000b67125cdc3313061ec518',
    address: '0x0000d6ebd8e7a7f7e3c84d2d037f7c8d92690a71',
  },
]
const salt = salts[0]

// TODO: Hardcoded using the LockUpgradeable implementation. Might be nice to infer from the named proxy contract.
async function deployCreate2VanityProxy(contractName: SupportedNamedProxyContractNames) {
  const proxyContractName = await formatNamedProxyContractName(contractName)

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
  let proxyAdminContractAddress = contractOverrides?.adminContracts.proxyAdminContractAddress
  // Actions to take after deployment to finalize deployment setup
  const { pushActionsAndLog, pushActions, getActions, tryActionCatchAndLog } = createActionLog()

  // -------------------------------------------------------------------------------------------------------------------
  // Verification
  // -------------------------------------------------------------------------------------------------------------------

  const { SecureAdminSafe, GeneralAdminSafe } = deploymentVariables.accounts.multisigConfig!

  if (!SecureAdminSafe || !GeneralAdminSafe) {
    throw new Error(
      'deployCreate2VanityProxy:: SecureAdminSafe and GeneralAdminSafe must be set in the deployment variables',
    )
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Deployment
  // -------------------------------------------------------------------------------------------------------------------

  if (deployerSigner.address !== CREATE2_DEPLOYER) {
    throw new Error(`Deployer ${deployerSigner.address} MUST be the CREATE2 Deployer: ${CREATE2_DEPLOYER}`)
  }

  const lockUpgradeable_Implementation = await deployManager.deployContract<LockUpgradeable__factory>(
    'LockUpgradeable',
    [],
  )

  const createXDeployer = await CreateXDeployer.create(ethers, deployerSigner)
  const deployProxyResult = await createXDeployer.deployProxyWithImplementationAndSalt(
    'LockUpgradeableProxy',
    lockUpgradeable_Implementation,
    salt.salt,
    salt.address,
    SecureAdminSafe,
  )

  // logger.log(`Registering ${GeneralAdminSafe}`, '🚀')
  // await (await lockUpgradeable.connect(deployerSigner).transferOwnership(GeneralAdminSafe)).wait()

  // -----------------------------------------------------------------------------------------------
  // Output
  // -----------------------------------------------------------------------------------------------

  let output = {
    deployedContracts: {
      lockProxy: deployProxyResult.implementationThroughProxy.address,
      proxyVerificationCommand: deployProxyResult.verificationCommand,
      lockUpgradeable_Implementation: lockUpgradeable_Implementation.address,
    },
    adminAddresses: {
      registeredInitializer: GeneralAdminSafe,
      proxyAdmin: SecureAdminSafe,
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
deployCreate2VanityProxy('LockUpgradeableProxy').catch((error) => {
  console.error(error)
  process.exitCode = 1
})
