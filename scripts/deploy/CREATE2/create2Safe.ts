import { ethers } from 'hardhat'
import { CREATE2_DEPLOYER } from '.'

import GnosisSafeProxyFactory_1_3_0 from '../../../artifacts-external/GnosisSafeProxyFactory_1.3.0.json'
import { GnosisSafeProxyFactory_130 } from '../../../typechain-types'
import { logger } from 'ethers'

interface SafeDeploymentOptions {
  owners?: string[]
  threshold?: number
  proxyFactoryAddress?: string
  gnosisSafeSingleton_l2?: string
}

/**
 * @notice Returns the proxy factory, gnosis safe singleton, and initializer for the CREATE2 Safe deployment
 * @param options (SafeDeploymentOptions) Options for the Safe deployment
 * @returns Proxy factory, gnosis safe singleton, and initializer
 */
export async function getCREATE2SafeInitializer(options?: SafeDeploymentOptions) {
  // -------------------------------------------------------------------------------------------------------------------
  // Safe Factory Contract
  // -------------------------------------------------------------------------------------------------------------------
  // Source: https://docs.safe.global/safe-smart-account/supported-networks/v1.3.0
  const proxyFactoryAddress = options?.proxyFactoryAddress ?? '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'
  // NOTE: Gnosis Safe Singleton L2
  const gnosisSafeSingleton_l2 = options?.gnosisSafeSingleton_l2 ?? '0x3E5c63644E683549055b9Be8653de26E0B4CD36E'
  logger.warn(
    `Using Safe Wallet v1.3.0 Proxy Factory: ${proxyFactoryAddress} and Singleton L2: ${gnosisSafeSingleton_l2} refer to Safe Wallet docs to ensure this is the correct version for your needs. https://docs.safe.global/safe-smart-account/supported-networks/v1.3.0`
  )

  const proxyFactoryABI = GnosisSafeProxyFactory_1_3_0.abi
  // Connect to the Proxy Factory contract
  const proxyFactory = (await ethers.getContractAt(proxyFactoryABI, proxyFactoryAddress)) as GnosisSafeProxyFactory_130

  // -------------------------------------------------------------------------------------------------------------------
  // Safe Initializer
  // -------------------------------------------------------------------------------------------------------------------

  // NOTE: For the safe to be deployed to the same address, the owners and threshold must be the same each time
  const owners = options?.owners ?? [CREATE2_DEPLOYER]
  const threshold = options?.threshold ?? 1

  // Encode the setup function call
  const initializer = ethers.utils.defaultAbiCoder.encode(
    ['address[]', 'uint256', 'address', 'bytes', 'address', 'address', 'uint256', 'address'],
    [
      owners,
      threshold,
      ethers.constants.AddressZero,
      '0x',
      ethers.constants.AddressZero,
      ethers.constants.AddressZero,
      0,
      ethers.constants.AddressZero,
    ]
  )

  return { proxyFactory, gnosisSafeSingleton_l2, initializer }
}
