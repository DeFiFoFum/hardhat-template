import {
  BeaconFactory_Test,
  BeaconFactory_Test__factory,
  BeaconFactoryAdmin,
  BeaconFactoryAdmin__factory,
  ProxyAdmin,
  ProxyAdmin__factory,
  TimelockControllerEnumerable,
  TimelockControllerEnumerable__factory,
} from '../../typechain-types'
import { DeployManager } from '../../scripts/deploy/DeployManager/DeployManager'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { PopulatedTransaction, utils } from 'ethers'
import { logger } from '../../hardhat/utils'
import { time } from '@nomicfoundation/hardhat-network-helpers'
import { TimelockEncoder } from '../../lib/evm/access/TimelockEncoder'

// These are the required accounts for the context manager
export type AdminContracts_ContextManager_Accounts = {
  admin: SignerWithAddress
  governor: SignerWithAddress
  proposers: SignerWithAddress[]
  executors: SignerWithAddress[]
  deployer: SignerWithAddress
}

// These are the contracts managed by this context manager
type AdminContracts_ContextManager_Props = {
  accounts: AdminContracts_ContextManager_Accounts
  proxyAdmin: ProxyAdmin
  timelockController_24hr: TimelockControllerEnumerable
  timelockController_72hr: TimelockControllerEnumerable
  beaconFactoryAdmin: BeaconFactoryAdmin
}

type TimelockDelay = 86400 | 259200

const TIMELOCK_DELAY_24hr: TimelockDelay = 86400
const TIMELOCK_DELAY_72hr: TimelockDelay = 259200

export class AdminContracts_ContextManager {
  private _props: AdminContracts_ContextManager_Props
  private _deployManager: DeployManager

  constructor(props: AdminContracts_ContextManager_Props, deployManager: DeployManager) {
    this._props = props
    this._deployManager = deployManager
  }

  public get props(): AdminContracts_ContextManager_Props {
    return this._props
  }

  static async create(accounts: AdminContracts_ContextManager_Accounts): Promise<AdminContracts_ContextManager> {
    const deployManager = await DeployManager.create({ signer: accounts.deployer })
    const proxyAdmin = await deployManager.deployContract<ProxyAdmin__factory>('ProxyAdmin', [accounts.admin.address])
    const timelockController_24hr = await this._deployTimelockController(accounts, TIMELOCK_DELAY_24hr, {
      deployManager,
    })
    const timelockController_72hr = await this._deployTimelockController(accounts, TIMELOCK_DELAY_72hr, {
      deployManager,
    })
    const beaconFactoryAdmin = await this._deployBeaconFactoryAdmin(accounts, timelockController_72hr.address, {
      deployManager,
    })

    const contextManagerProps: AdminContracts_ContextManager_Props = {
      accounts,
      proxyAdmin,
      timelockController_24hr,
      timelockController_72hr,
      beaconFactoryAdmin,
    }

    return new AdminContracts_ContextManager(contextManagerProps, deployManager)
  }

  /// -----------------------------------------------------------------------
  /// Timelock Transactions
  /// -----------------------------------------------------------------------

  private static async _deployTimelockController(
    accounts: AdminContracts_ContextManager_Accounts,
    timelockDelay: number,
    { deployManager }: { deployManager: DeployManager | undefined },
  ): Promise<TimelockControllerEnumerable> {
    const currentDeployManager = deployManager || (await DeployManager.create({ signer: accounts.deployer }))

    const [minDelay, proposers, executors, admin] = [
      timelockDelay,
      accounts.proposers.map((signer) => signer.address),
      accounts.executors.map((signer) => signer.address),
      accounts.admin.address,
    ]
    const timelockController = await currentDeployManager.deployContract<TimelockControllerEnumerable__factory>(
      'TimelockControllerEnumerable',
      [minDelay, proposers, executors, admin],
    )

    return timelockController
  }

  public async submitTimelockTransactionAndExecute(
    populatedTx: PopulatedTransaction,
    timelockDelay: 86400 | 259200,
  ): Promise<void> {
    let timelockEncoder = await TimelockEncoder.create(this.props.timelockController_24hr.address)
    if (timelockDelay == 259200) {
      // NOTE: Using the 72hr timelock controller
      timelockEncoder = await TimelockEncoder.create(this.props.timelockController_72hr.address)
    }

    if (populatedTx.to === undefined || populatedTx.data === undefined) {
      console.dir({ populatedTx })
      throw new Error('submitTimelockTransactionAndExecute:: populatedTx is missing to or data')
    }

    const timelockEncodedTxs = await timelockEncoder.encodeTxsForSingleOperation(
      {
        target: populatedTx.to,
        value: populatedTx.value || '0',
        data: populatedTx.data,
      },
      timelockDelay,
    )

    logger.log(`Scheduling Timelock transaction: ${timelockEncodedTxs.scheduleEncoded.data}`, '📅')
    // Submit the transaction to the timelock
    await (
      await this._props.accounts.admin.sendTransaction({
        to: timelockEncodedTxs.scheduleEncoded.to,
        data: timelockEncodedTxs.scheduleEncoded.data,
      })
    ).wait()

    logger.log(`Jumping forward in time by ${timelockDelay} seconds`, '⏰')
    await time.increase(timelockDelay + 1)

    logger.log(`Executing Timelock transaction: ${timelockEncodedTxs.executeEncoded.data}`, '🚀')
    await (
      await this._props.accounts.admin.sendTransaction({
        to: timelockEncodedTxs.executeEncoded.to,
        data: timelockEncodedTxs.executeEncoded.data,
      })
    ).wait()
    logger.log(`Timelock transaction executed`, '🎉')
  }

  /// -----------------------------------------------------------------------
  /// BeaconFactoryAdmin
  /// -----------------------------------------------------------------------

  private static async _deployBeaconFactoryAdmin(
    accounts: AdminContracts_ContextManager_Accounts,
    controllerAddress: string,
    { deployManager }: { deployManager: DeployManager | undefined },
  ): Promise<BeaconFactoryAdmin> {
    const currentDeployManager = deployManager || (await DeployManager.create({ signer: accounts.deployer }))

    const beaconFactoryAdmin = await currentDeployManager.deployContract<BeaconFactoryAdmin__factory>(
      'BeaconFactoryAdmin',
      [accounts.admin.address, controllerAddress],
    )

    return beaconFactoryAdmin
  }

  public async deployBeaconFactoryAdmin(controllerAddress: string): Promise<BeaconFactoryAdmin> {
    const beaconFactoryAdmin = await AdminContracts_ContextManager._deployBeaconFactoryAdmin(
      this.props.accounts,
      controllerAddress,
      {
        deployManager: this._deployManager,
      },
    )

    return beaconFactoryAdmin
  }

  public getBeaconFactoryAdmin(): BeaconFactoryAdmin {
    return this.props.beaconFactoryAdmin
  }

  /// TimelockController
  /// -----------------------------------------------------------------------

  public async isAdminTimelock(address: string): Promise<{ isAdminTimelock: boolean; timelockDelay: TimelockDelay }> {
    const { timelockController_24hr, timelockController_72hr } = this.props
    const adminTimelockControllers = [timelockController_24hr, timelockController_72hr]
    for (const adminTimelockController of adminTimelockControllers) {
      if (address === adminTimelockController.address) {
        const timelockDelay = (await adminTimelockController.getMinDelay()).toNumber() as TimelockDelay
        return { isAdminTimelock: true, timelockDelay }
      }
    }

    return { isAdminTimelock: false, timelockDelay: 0 as TimelockDelay }
  }

  public async beaconFactoryAdmin_TransferSecureTimelockController(newController: string): Promise<string> {
    const { isAdminTimelock, timelockDelay } = await this.isAdminTimelock(newController)

    if (!isAdminTimelock) {
      throw new Error('transferSecureTimelockController: Not an admin timelock controller')
    }

    logger.log(`Admin: ${newController} is a SecureTimelockController with a delay of ${timelockDelay}`, '🔒')
    const populatedTx = await this.encodeBeaconFactoryAdmin_TransferSecureTimelockController_AndWhitelist(newController)
    // TODO: There could be a better way to pass around the timelocks. This doesn't scale if we decided to add more timelocks
    const activeTimelockDelay = timelockDelay == 86400 ? 259200 : 86400
    await this.submitTimelockTransactionAndExecute(populatedTx, activeTimelockDelay)

    logger.log(`Timelock transaction executed`, '🎉')
    const currentTimelockController = await this.props.beaconFactoryAdmin.secureTimelockController()
    return currentTimelockController
  }

  // TODO: Getting kind of messy here, might need to refactor soon
  public async encodeBeaconFactoryAdmin_TransferSecureTimelockController_AndWhitelist(newController: string) {
    const beaconFactoryAdmin = this.getBeaconFactoryAdmin()
    const populatedTx = await beaconFactoryAdmin.populateTransaction.transferSecureTimelockController(newController)
    populatedTx.from = await beaconFactoryAdmin.secureTimelockController()

    logger.log(`setTrustedTimelockController: ${newController} on BeaconFactoryAdmin`, '🚀')
    const isTrustedTimelockController = true
    await beaconFactoryAdmin
      .connect(this.props.accounts.admin)
      .setTrustedTimelockController(newController, isTrustedTimelockController)

    return populatedTx
  }

  public async deployTestBeaconFactory(beaconFactoryAdminOverride?: BeaconFactoryAdmin): Promise<BeaconFactory_Test> {
    const beaconFactoryAdmin = beaconFactoryAdminOverride ?? this.getBeaconFactoryAdmin()
    const beaconFactory_Test = await this._deployManager.deployContract<BeaconFactory_Test__factory>(
      'BeaconFactory_Test',
      [beaconFactoryAdmin.address],
    )

    return beaconFactory_Test
  }

  /// BeaconImplementation
  /// -----------------------------------------------------------------------

  public async encodeUpgradeBeaconFactoryImplementation(upgradeableBeacon: string, newImplementationAddress: string) {
    const beaconFactoryAdmin = this.getBeaconFactoryAdmin()
    const populatedTx = await beaconFactoryAdmin.populateTransaction.upgradeBeaconFactoryImplementation(
      upgradeableBeacon,
      newImplementationAddress,
    )
    populatedTx.from = await beaconFactoryAdmin.secureTimelockController()

    return populatedTx
  }
}
