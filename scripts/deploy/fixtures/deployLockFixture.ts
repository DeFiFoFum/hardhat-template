// test/fixtures/deployLockFixture.ts
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { DeployableNetworks, FixtureOverrides, getDeployConfig } from '../deploy.config'
import { DeployManager } from '../DeployManager/DeployManager'
import { logger } from '../../../hardhat/utils'
import { formatEther } from 'ethers/lib/utils'
import { Lock__factory, LockUpgradeable__factory } from '../../../typechain-types'

export async function deployLockFixture(
  hre: HardhatRuntimeEnvironment,
  deployManager: DeployManager,
  fixtureOverrides: FixtureOverrides = {},
) {
  const currentNetwork = hre.network.name as DeployableNetworks
  const deployConfig = await getDeployConfig(currentNetwork, fixtureOverrides)

  const currentTimestampInSeconds = Math.round(Date.now() / 1000)
  const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60
  const unlockTime = currentTimestampInSeconds + ONE_YEAR_IN_SECS
  const lockedAmount = hre.ethers.utils.parseEther('.00001')

  const lockContractName = 'Lock'
  const lock = await deployManager.deployContract<Lock__factory>('Lock', [
    unlockTime,
    deployConfig.accounts.adminAddress,
  ])
  const deployer = (await hre.ethers.getSigners())[0]
  await deployer.sendTransaction({ to: lock.address, value: lockedAmount })
  await deployer.sendTransaction({ to: lock.address, value: lockedAmount })
  logger.log(`Lock with ${formatEther(lockedAmount)} ETH deployed to: ${lock.address}`, '🔒')

  const [proxyAdminContractAddress, proxyAdminOwnerAddress] = [
    deployConfig.contractOverrides.adminContracts.proxyAdminContractAddress,
    deployConfig.accounts.proxyAdminOwnerAddress,
  ]
  if (!proxyAdminContractAddress || !proxyAdminOwnerAddress) {
    throw new Error(
      'deployLockFixture:: proxyAdminContractAddress and proxyAdminOwnerAddress must be set in the deployment variables',
    )
  }

  const lockUpgradeable = await deployManager.deployUpgradeableContract<LockUpgradeable__factory>(
    'LockUpgradeable',
    [unlockTime, deployConfig.accounts.adminAddress],
    {
      name: 'LockUpgradeable', // Pass in contract name to log contract
      proxyAdminAddress: proxyAdminContractAddress,
      proxyAdminOwner: proxyAdminOwnerAddress,
    },
  )
  logger.log(`LockUpgradeable to: ${lock.address}`, '🔒')

  return {
    contractOutput: {
      lock,
      lockUpgradeable,
    },
    addressOutput: {
      lock: lock.address,
      lockUpgradeable: lockUpgradeable.implementationThroughProxy.address,
      proxyAdmin: lockUpgradeable.proxyAdmin.address,
    },
    unlockTime,
    lockedAmount,
  }
}
