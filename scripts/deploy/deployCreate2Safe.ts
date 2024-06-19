import { ethers, network } from 'hardhat'
import { writeObjectToTsFile } from '../../lib/node/files'
import { logger } from '../../hardhat/utils'
import { Networks } from '../../hardhat'
import { convertToExplorerUrlForNetwork } from '../../hardhat.config'
import { getCREATE2SafeInitializer } from '../../lib/evm/safe-wallet/create2Safe'
import { CREATE2_DEPLOYER } from './CREATE2'
import { getErrorMessage } from '../../lib/node/getErrorMessage'
import GnosisSafeL2_Artifact from '../../artifacts-external/GnosisSafeL2.json'
import { GnosisSafeL2 } from '../../typechain-types'
import { forkIfHardhat } from './utils/forkDeployHelper'
import { DeployableNetworks } from './deploy.config'
import { askYesOrNoQuestion } from '../../lib/prompts/promptUser'

async function main() {
  // NOTE: Deploy safes with different salts
  await deployCreate2Safe(0, 'SecureAdminSafe')
  // await deployCreate2Safe(1, 'TreasurySafe')
  // await deployCreate2Safe(2, 'PartnerSafe')
  // await deployCreate2Safe(2, 'GeneralAdminSafe')
  // await deployCreate2Safe(3, 'InsecureAdminSafe')
}

async function deployCreate2Safe(salt: number, name?: string) {
  logger.logHeader('Deploying Gnosis Safe with CREATE2', '🚀')
  const currentNetwork = network.name as DeployableNetworks
  const deployConfigNetwork = await forkIfHardhat(currentNetwork, 'mainnet' as DeployableNetworks)
  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()
  if (currentNetwork != 'hardhat' && deployerAddress != CREATE2_DEPLOYER) {
    throw new Error(`Deployer ${deployerAddress} address must be CREATE2_DEPLOYER: ${CREATE2_DEPLOYER}`)
  }
  const { proxyFactory, gnosisSafeSingleton_l2, initializerParams, initializerData } = await getCREATE2SafeInitializer()

  // -------------------------------------------------------------------------------------------------------------------
  // Salt setup and verification
  // -------------------------------------------------------------------------------------------------------------------
  if (!(await askYesOrNoQuestion(`Is the salt ${salt} correct? (Y/N)`))) {
    logger.error('Aborted deployment by user.')
    throw new Error()
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Create Safe
  // -------------------------------------------------------------------------------------------------------------------

  // Deploy the Gnosis Safe with CREATE2
  // const gasEstimate = await proxyFactory.estimateGas.createProxyWithNonce(gnosisSafeSingleton_l2, initializer, salt)
  const tx = await proxyFactory.connect(deployer).createProxyWithNonce(gnosisSafeSingleton_l2, initializerData, salt)
  logger.log('Gnosis Safe deployment transaction sent. Tx Hash:', tx.hash)

  // Wait for the transaction to be mined
  const receipt = await tx.wait()
  // NOTE: ProxyCreation event 0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235
  const gnosisSafeAddress = receipt.events?.[0]?.args?.proxy
  logger.log(`Gnosis Safe deployed at: ${gnosisSafeAddress}`, '🚀')

  try {
    logger.log('Attempting to setup newly created Gnosis Safe', '🛠️')
    // NOTE: Pulling in abi manually as these artifacts are in a `/artifacts-external` directory
    const gnosisSafe = new ethers.Contract(gnosisSafeAddress, GnosisSafeL2_Artifact.abi, deployer) as GnosisSafeL2
    // TODO: Can probably pass in the proper ownership data here instead of needing to send another tx.
    await gnosisSafe.setup(...initializerParams)
    logger.log('Successfully setup Gnosis Safe', '🚀')
  } catch (e) {
    logger.error(`Error setting up Gnosis Safe: ${getErrorMessage(e)}`)
    logger.warn(
      `You will need to setup the Gnosis Safe manually by calling setup on ${gnosisSafeAddress} with the initializerParams in output.`
    )
  }

  // -------------------------------------------------------------------------------------------------------------------
  // Output
  // -------------------------------------------------------------------------------------------------------------------

  const output = {
    address: convertToExplorerUrlForNetwork(network.name as Networks, gnosisSafeAddress),
    txHash: tx?.hash || 'DEPLOYMENT ERROR',
    salt,
    initializerData,
    initializerParams,
  }

  logger.logHeader('Deployment Output', '🚀')
  console.dir(output)
  await writeObjectToTsFile(
    __dirname + `/${name || 'create2SafeOutput'}.${salt}.${network.name}.ts`,
    'create2Deployment',
    output
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
