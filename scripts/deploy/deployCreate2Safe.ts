import { ethers, network } from 'hardhat'
import { writeObjectToTsFile } from '../utils'
import { logger } from '../../hardhat/utils'
import { Networks } from '../../hardhat'
import { convertToExplorerUrlForNetwork } from '../../hardhat.config'
import { getCREATE2SafeInitializer } from './CREATE2/create2Safe'
import { CREATE2_DEPLOYER } from './CREATE2'
import { getErrorMessage } from '../utils/getErrorMessage'
import GnosisSafeL2_Artifact from '../../artifacts-external/GnosisSafeL2.json'
import { GnosisSafeL2 } from '../../typechain-types'

async function main() {
  // NOTE: Deploy safes with different salts
  await deployCreate2Safe(0, 'SecureAdminSafe')
  // await deployCreate2Safe(1, 'TreasurySafe')
  // await deployCreate2Safe(2, 'GeneralAdminSafe')
  // await deployCreate2Safe(3, 'InsecureAdminSafe')
}

async function deployCreate2Safe(salt: number, name?: string) {
  logger.logHeader('Deploying Gnosis Safe with CREATE2', '🚀')
  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()
  if (deployerAddress != CREATE2_DEPLOYER) {
    throw new Error(`Deployer ${deployerAddress} address must be CREATE2_DEPLOYER: ${CREATE2_DEPLOYER}`)
  }
  const { proxyFactory, gnosisSafeSingleton_l2, initializerParams, initializerData } = await getCREATE2SafeInitializer()

  // -------------------------------------------------------------------------------------------------------------------
  // Salt setup and verification
  // -------------------------------------------------------------------------------------------------------------------
  // TODO: Add option to pass in salt with command line argument
  // For now, change this value manually.
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = () =>
    new Promise((resolve) => {
      // @notice Once a salt is used on a network, it cannot be used again with the same deployer account.
      // @notice Use the same salt on a different network, with the same deployer account, to deploy a Safe with the same address
      readline.question(`Is the salt ${salt} correct? (Y/N) `, (answer: string) => {
        readline.close()
        resolve(answer.trim().toUpperCase() === 'Y')
      })
    })

  const isSaltCorrect = await question()
  if (!isSaltCorrect) {
    throw new Error('Aborted by user: Salt is incorrect.')
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
