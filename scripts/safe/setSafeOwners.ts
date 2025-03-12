import { ethers, network } from 'hardhat'
import { getErrorMessage } from '../../lib/node/getErrorMessage'
import { logger } from '../../hardhat/utils'
import { CREATE2_DEPLOYER } from '../deploy/CREATE2/create2.config'
import { getCREATE2SafeInitializer } from '../../lib/evm/safe-wallet/create2Safe'
import { SafeWalletTxEncoder } from '../../lib/evm/safe-wallet/SafeWalletTxEncoder'
import { getSafeContractAt } from '../../lib/evm/safe-wallet/getSafeContracts'
import { DeployableNetworks } from '../deploy/deploy.config'
import { forkIfHardhat } from '../deploy/utils/forkDeployHelper'
import { askYesOrNoQuestion } from '../../lib/prompts/promptUser'
import { SafeOwnerConfig } from './safeWalletTypes'

function getSafeOwnerConfigArray(): SafeOwnerConfig[] {
  // TODO: Add your config
  return []
}

async function main() {
  logger.logHeader('Setting owners for Safes', '⚙️')
  const currentNetwork = network.name as DeployableNetworks
  const [deployer] = await ethers.getSigners()
  const deployerAddress = await deployer.getAddress()

  await forkIfHardhat(currentNetwork, 'polygon' as DeployableNetworks)

  if (deployerAddress != CREATE2_DEPLOYER) {
    throw new Error(`Deployer ${deployerAddress} address must be CREATE2_DEPLOYER: ${CREATE2_DEPLOYER}`)
  }
  const { proxyFactory, gnosisSafeSingleton_l2, initializerParams, initializerData } = await getCREATE2SafeInitializer()

  const safeOwnerConfigs = getSafeOwnerConfigArray()

  for (const safeOwnerConfig of safeOwnerConfigs) {
    // Safe initial setup (if not already called)
    const safeAddress = safeOwnerConfig.safeAddress
    const currentSafe = await getSafeContractAt(safeOwnerConfig.safeAddress, deployer)
    try {
      logger.log(`Trying Safe Setup on ${safeAddress}`, '⚙️')
      // NOTE: Pulling in abi manually as these artifacts are in a `/artifacts-external` directory
      await currentSafe.setup(...initializerParams)
      logger.log(`Safe Setup succeeded ${safeAddress}`, '⚙️')
    } catch (e) {
      logger.log(`Safe setup failed on ${safeAddress}`, '⚠️')
      logger.warn(getErrorMessage(e))
    }

    // Owner Setup
    logger.log(`Sending owner tx to ${safeAddress}`, '⚙️')

    const safeWalletTxEncoder = await SafeWalletTxEncoder.create(safeAddress, deployerAddress)

    const ownerData = await safeWalletTxEncoder.getAddOwnersTransactionData(safeOwnerConfig.ownersToAdd)
    if (!ownerData.data) {
      console.log({ ownerData })
      throw new Error(`setSafeOwners:: No tx data found for ${safeAddress} and ownerData: ${ownerData}`)
    }

    // Fetch the current gas price from the network
    const currentGasPrice = await ethers.provider.getGasPrice()
    // Fetch the current base fee from the network
    const feeData = await ethers.provider.getFeeData()

    // Increase it by 10%
    const adjustedGasPrice = currentGasPrice.mul(110).div(100)

    // Estimate the gas limit for the transaction
    const estimatedGasLimit = await deployer.estimateGas({
      to: safeAddress,
      data: ownerData.data,
      maxFeePerGas: feeData.maxFeePerGas || 1,
    })

    logger.log(`Estimated gas limit for transaction: ${estimatedGasLimit.toString()}`, '⛽')
    logger.log(`Adjusted gas price for transaction: ${adjustedGasPrice.toString()}`, '⛽')
    const estimatedEthCost = ethers.utils.formatEther(adjustedGasPrice.mul(estimatedGasLimit))
    logger.log(`Estimated ETH Tx Cost: ${estimatedEthCost.toString()}`, '💰')

    // -------------------------------------------------------------------------------------------------------------------
    // Owner Verification
    // -------------------------------------------------------------------------------------------------------------------
    console.dir(safeOwnerConfig)
    if (!(await askYesOrNoQuestion(`Are the above safeOwnerConfig correct before adding owners? (Y/N)`))) {
      logger.error('Aborted deployment by user.')
      throw new Error()
    }

    const tx = await deployer.sendTransaction({
      to: safeAddress,
      data: ownerData.data,
      gasLimit: estimatedGasLimit, // Use the estimated gas limit
      maxFeePerGas: adjustedGasPrice,
    })
    await tx.wait()

    logger.log(`TX Success: ${tx.hash}`, '🚀')

    const owners = await currentSafe.getOwners()
    logger.log(`Current Safe Owners: ${owners}`, '🔐')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
