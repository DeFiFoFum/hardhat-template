import { logger } from '../../../hardhat/utils'
import { TimelockControllerEnumerable, TimelockControllerEnumerable__factory } from '../../../typechain-types'
import { DeployManager } from './DeployManager'

export interface TimelockControllerRoles {
  proposers: string[]
  executors: string[]
  cancellers: string[]
  admin: string | null
}

export interface TimelockDeployManager_Props extends TimelockControllerRoles {
  deployManager: DeployManager
}

export interface ITimelockDeployManager {
  props: TimelockDeployManager_Props
  deployAndConfigureTimelock(minDelaySeconds: number): Promise<TimelockControllerEnumerable>
}

/**
 * TimelockDeployManager
 *
 * NOTE: This implementation depends on Hardhat + EthersV5
 */
export class TimelockDeployManager implements ITimelockDeployManager {
  private _props: TimelockDeployManager_Props

  private constructor(props: TimelockDeployManager_Props) {
    this._props = props
  }

  get props(): TimelockDeployManager_Props {
    return this._props
  }

  static async create(props: TimelockDeployManager_Props): Promise<TimelockDeployManager> {
    if (props.admin) {
      logger.warn(
        `Admin is set to ${props.admin} for TIMELOCK_ADMIN_ROLE. It is recommended to leave this null to allow for timelocked admin role changes.`,
      )
    }

    return new TimelockDeployManager(props)
  }

  async deployAndConfigureTimelock(minDelaySeconds: number): Promise<TimelockControllerEnumerable> {
    logger.log('Deploying timelock...', '🔒')
    const { deployManager, proposers, executors, admin, cancellers } = this._props
    const deployer = await deployManager.getSigner()
    const tempAdmin = await deployer.getAddress()

    logger.log(`Using deployer ${tempAdmin} as temporary admin`, '👤')
    logger.log(`Proposers: ${proposers.join(', ')}`, '📋')
    logger.log(`Executors: ${executors.join(', ')}`, '🔑')
    logger.log(`Final admin: ${admin}`, '👑')
    logger.log(`Minimum delay: ${minDelaySeconds} seconds`, '⏰')

    // Deploy timelock with deployer as temp admin
    logger.log('Deploying TimelockControllerEnumerable contract...', '📄')
    const timelock = await deployManager.deployContract<TimelockControllerEnumerable__factory>(
      'TimelockControllerEnumerable',
      [minDelaySeconds, proposers, executors, tempAdmin],
    )
    logger.log(`TimelockControllerEnumerable deployed at ${timelock.address}`, '✅')

    // Grant canceller role to specified addresses if any
    if (cancellers.length > 0) {
      logger.log(`Configuring cancellers: ${cancellers.join(', ')}`, '🚫')
      const cancellerRole = await timelock.CANCELLER_ROLE()
      for (const canceller of cancellers) {
        logger.log(`Granting canceller role to ${canceller}...`, '🔄')
        await timelock.connect(deployer).grantRole(cancellerRole, canceller)
      }
    }

    // Grant admin role to final admin and revoke from deployer
    logger.log('Configuring final admin permissions...', '👑')
    const adminRole = await timelock.TIMELOCK_ADMIN_ROLE()

    if (admin) {
      logger.log(`Granting admin role to ${admin}...`, '🔄')
      await timelock.connect(deployer).grantRole(adminRole, admin)
    } else {
      logger.log(`Leaving TIMELOCK_ADMIN_ROLE as ${timelock.address}...`, '🔄')
    }

    logger.log(`Revoking temporary admin role from ${tempAdmin}...`, '🔄')
    await timelock.connect(deployer).revokeRole(adminRole, tempAdmin)
    logger.log('Admin configuration complete', '✅')

    return timelock
  }
}
