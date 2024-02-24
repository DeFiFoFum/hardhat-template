import { ethers } from 'hardhat'
import { CREATE2_DEPLOYER } from '.'

import GnosisSafeProxyFactory_1_3_0 from '../../../artifacts-external/GnosisSafeProxyFactory_1.3.0.json'
import { GnosisSafeL2, GnosisSafeProxyFactory_130 } from '../../../typechain-types'

interface SafeDeploymentOptions {
  owners?: string[]
  threshold?: number
  proxyFactoryAddress?: string
  gnosisSafeSingleton_l2?: string
}

export async function getCREATE2SafeInitializer(options?: SafeDeploymentOptions) {
  // -------------------------------------------------------------------------------------------------------------------
  // Safe Factory Contract
  // -------------------------------------------------------------------------------------------------------------------
  // Source: https://docs.safe.global/safe-smart-account/supported-networks/v1.3.0
  const proxyFactoryAddress = options?.proxyFactoryAddress ?? '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2'
  // NOTE: Gnosis Safe Singleton L2
  const gnosisSafeSingleton_l2 = options?.gnosisSafeSingleton_l2 ?? '0x3E5c63644E683549055b9Be8653de26E0B4CD36E'
  const proxyFactoryABI = GnosisSafeProxyFactory_1_3_0.abi
  // Connect to the Proxy Factory contract
  const proxyFactory = (await ethers.getContractAt(proxyFactoryABI, proxyFactoryAddress)) as GnosisSafeProxyFactory_130

  // -------------------------------------------------------------------------------------------------------------------
  // Safe Initializer
  // -------------------------------------------------------------------------------------------------------------------

  // NOTE: For the safe to be deployed to the same address, the owners and threshold must be the same each time
  const owners = options?.owners ?? [CREATE2_DEPLOYER]
  const threshold = options?.threshold ?? 1

  const initializerParams: Parameters<GnosisSafeL2['setup']> = [
    owners,
    threshold,
    ethers.constants.AddressZero,
    '0x',
    ethers.constants.AddressZero,
    ethers.constants.AddressZero,
    0,
    ethers.constants.AddressZero,
  ]

  // Encode the setup function call
  const initializerData = ethers.utils.defaultAbiCoder.encode(
    ['address[]', 'uint256', 'address', 'bytes', 'address', 'address', 'uint256', 'address'],
    initializerParams
  )

  return { proxyFactory, gnosisSafeSingleton_l2, initializerParams, initializerData }
}
