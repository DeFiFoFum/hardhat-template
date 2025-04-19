import { ContractFactory } from 'ethers'
import { ethers } from 'hardhat'
import { logger } from '../../../hardhat/utils'
import { TransparentUpgradeableProxy__factory } from '../../../typechain-types'

export const DEFAULT_X_DEPLOYER_ADDRESS = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'

/**
 * XDeployer is a utility class to deploy contracts using the Create2 pattern.
 *
 * Credit to @pcaversaccio for the XDeployer implementation and contract deployments.
 * https://github.com/pcaversaccio/xdeployer
 */
export class XDeployer {
  ethers: typeof ethers
  xDeployerAddress = DEFAULT_X_DEPLOYER_ADDRESS

  constructor(_ethers: typeof ethers) {
    this.ethers = _ethers
  }

  getBytes32SaltFromNumber(saltNumber: number) {
    const hexValue = this.ethers.utils.hexlify(saltNumber)
    // Pad the hexadecimal string to 32 bytes (64 characters + '0x' prefix)
    const paddedHexString = ethers.utils.hexZeroPad(hexValue, 32)
    return paddedHexString
  }

  async deployXTransparentUpgradeableProxy(
    params: Parameters<TransparentUpgradeableProxy__factory['deploy']>,
    saltNumber: number,
  ) {
    const deployDetails = await this.deployXContract<TransparentUpgradeableProxy__factory>(
      'TransparentUpgradeableProxy',
      params,
      saltNumber,
    )

    const proxyContract = await this.ethers.getContractAt(
      'ITransparentUpgradeableProxy',
      deployDetails.newContractAddress,
    )

    return {
      proxyContract,
      ...deployDetails,
    }
  }

  async deployXContract<CF extends ContractFactory>(
    contractName: string,
    params: Parameters<CF['deploy']>,
    saltNumber: number,
  ): Promise<{ newContractAddress: string; newContractSalt: string; saltInput: number }> {
    const createX = await this.ethers.getContractAt('ICreateX', this.xDeployerAddress)
    const initCode = (await this.ethers.getContractFactory(contractName)).getDeployTransaction(...params).data
    const saltHex = this.getBytes32SaltFromNumber(saltNumber)

    logger.log(`deployXContract:: Deploying contract ${contractName} with salt ${saltHex}`, '🚀')

    if (!initCode) {
      throw new Error('deployXContract:: Could not get initCode')
    }

    const deployTx = await createX.deployCreate2(saltHex, initCode)
    const deployReceipt = await deployTx.wait()

    let [newContractAddress, newContractSalt] = [null, null]
    for (const event of deployReceipt.events || []) {
      try {
        const parsedEvent = createX.interface.parseLog(event)
        if (parsedEvent.name === 'ContractCreation') {
          newContractAddress = parsedEvent.args.newContract
          newContractSalt = parsedEvent.args.salt
        }
      } catch (e) {
        // NOTE: parseLog will throw on events which it doesn't recognize
        // logger.error(`deployXContract:: Error parsing event: ${e.message}`, e)
      }
    }

    logger.log(
      `deployXContract:: Contract deployed at address: ${newContractAddress} with salt ${newContractSalt}`,
      '🚀',
    )
    if (!newContractAddress || !newContractSalt) {
      throw new Error('deployXContract:: Could not get newContractAddress or newContractSalt')
    }
    return { newContractAddress, newContractSalt, saltInput: saltNumber }
  }
}
