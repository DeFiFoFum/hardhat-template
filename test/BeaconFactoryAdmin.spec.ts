import { ethers } from 'hardhat'
// https://hardhat.org/hardhat-network-helpers/docs/reference
import { mine, time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import '@nomicfoundation/hardhat-chai-matchers'

import { AdminContracts_ContextManager } from './context-managers/AdminContractsContextManager'
import { BeaconFactoryAdmin } from '../typechain-types'

/**
 * Configurable fixture to use for each test file.
 *
 * As only one fixture can be used per test. This fixture intends to batch multiple contract
 * deployment functions into a single fixture.
 *
 * Fixtures improve test efficiency by reusing the same setup in every test.
 * loadFixture() runs this setup once, snapshots that state,
 * and resets the Hardhat Network to that snapshot for every test.
 */
type FixtureReturn = Awaited<ReturnType<typeof fixture>>
async function fixture() {
  // Contracts are deployed using the first signer/account by default
  const accounts = await ethers.getSigners()
  const [deployer, admin, governor, notAdmin, newAdmin] = accounts

  // Import other fixtures here to compose into the parent fixture
  // const deployment = await genericFixture(ethers, 'MockToken')
  // const mockToken = deployment.contract

  const [proposers, executors] = [[admin], [admin]]
  const adminContracts_ContextManager = await AdminContracts_ContextManager.create({
    admin,
    deployer,
    proposers,
    executors,
    governor,
  })

  const beaconFactoryAdmin_AdminControlled = await adminContracts_ContextManager.deployBeaconFactoryAdmin(admin.address)
  const beaconFactory_Test = await adminContracts_ContextManager.deployTestBeaconFactory(
    beaconFactoryAdmin_AdminControlled,
  )
  const MockERC20 = await ethers.getContractFactory('MockToken')
  const mockERC20_Implementation = await MockERC20.deploy('MockERC20', 'MockERC20', 18)

  return {
    adminContracts_ContextManager,
    contracts: {
      // mockToken,
      beaconFactoryAdmin: adminContracts_ContextManager.props.beaconFactoryAdmin,
      beaconFactoryAdmin_AdminControlled,
      secureTimelockController: adminContracts_ContextManager.props.timelockController_72hr,
      timelockController_72hr: adminContracts_ContextManager.props.timelockController_72hr,
      timelockController_24hr: adminContracts_ContextManager.props.timelockController_24hr,
      testBeaconFactory: {
        beaconFactory: beaconFactory_Test,
        beaconFactoryAdmin: beaconFactoryAdmin_AdminControlled,
        mockERC20_Implementation,
      },
    },
    accounts: {
      deployer,
      admin,
      newAdmin,
      notAdmin,
    },
  }
}

describe('BeaconFactoryAdmin', function () {
  let FR: FixtureReturn
  let accounts: FixtureReturn['accounts']
  let contracts: FixtureReturn['contracts']

  before(async function () {
    // Add code here to run before all tests
  })

  beforeEach(async function () {
    // Add code here to run before each test
    FR = await loadFixture(fixture)
    accounts = FR.accounts
    contracts = FR.contracts
  })

  it('Should be able to load fixture', async () => {
    expect(FR).to.not.be.undefined
    expect(accounts).to.not.be.undefined
    expect(contracts).to.not.be.undefined
  })

  it('Should be able to upgrade a beacon factory through BeaconFactoryAdmin', async () => {
    expect(FR).to.not.be.undefined
    expect(accounts).to.not.be.undefined
    expect(contracts).to.not.be.undefined
  })

  it('Should NOT be able to upgrade without SecureTimelockController', async () => {
    const { beaconFactoryAdmin, beaconFactory, mockERC20_Implementation } = contracts.testBeaconFactory
    // Attempt upgrade from a non-controller account
    await expect(
      beaconFactoryAdmin
        .connect(accounts.notAdmin)
        .upgradeBeaconFactoryImplementation(beaconFactory.address, mockERC20_Implementation.address),
    ).to.be.revertedWithCustomError(beaconFactoryAdmin, 'OnlySecureTimelock')
  })

  it('Should be able to lock upgrades through owner', async () => {
    const { beaconFactoryAdmin } = contracts.testBeaconFactory
    const duration = 1000
    await beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(duration)
    const lockTimestamp = await beaconFactoryAdmin.beaconUpgradesLockedUntilTimestamp()
    expect(lockTimestamp).to.be.gte((await time.latest()) + duration - 1)
  })

  it('Should NOT be able to lock through non-owner', async () => {
    const { beaconFactoryAdmin } = contracts.testBeaconFactory
    const duration = 1000
    await expect(
      beaconFactoryAdmin.connect(accounts.notAdmin).lockBeaconUpgradesForDuration(duration),
    ).to.be.revertedWith('Ownable: caller is not the owner')
  })

  describe('transferSecureTimelockController', function () {
    it('should transfer secure timelock controller when called by the current controller', async function () {
      await FR.adminContracts_ContextManager.beaconFactoryAdmin_TransferSecureTimelockController(
        FR.contracts.timelockController_24hr.address,
      )

      const newSecureTimelockController =
        await FR.adminContracts_ContextManager.props.beaconFactoryAdmin.secureTimelockController()
      expect(newSecureTimelockController).to.equal(FR.contracts.timelockController_24hr.address)
    })

    it('should revert if called by a non-controller', async function () {
      const nonController = accounts.notAdmin
      const newControllerAddress = accounts.newAdmin.address

      await expect(
        FR.adminContracts_ContextManager.props.beaconFactoryAdmin
          .connect(nonController)
          .transferSecureTimelockController(newControllerAddress),
      ).to.be.revertedWithCustomError(FR.contracts.beaconFactoryAdmin, 'OnlySecureTimelock')
    })

    it('should revert if the new controller is not trusted', async function () {
      const { beaconFactoryAdmin, beaconFactory, mockERC20_Implementation } = contracts.testBeaconFactory

      const untrustedControllerAddress = accounts.notAdmin.address

      await expect(
        beaconFactoryAdmin.connect(accounts.admin).transferSecureTimelockController(untrustedControllerAddress),
      ).to.be.revertedWithCustomError(beaconFactoryAdmin, 'UnauthorizedController')
    })
  })

  describe('upgradeBeaconFactoryImplementation', function () {
    it('should upgrade the beacon proxy implementation when conditions are met', async function () {
      const { beaconFactoryAdmin, beaconFactory, mockERC20_Implementation } = contracts.testBeaconFactory

      const newImplementation = mockERC20_Implementation.address
      await beaconFactoryAdmin
        .connect(FR.accounts.admin)
        .upgradeBeaconFactoryImplementation(beaconFactory.address, newImplementation)

      const upgradedImplementation = await beaconFactory.getBeaconProxyImplementationForFactory()
      expect(upgradedImplementation).to.equal(newImplementation)
    })

    it('should revert if the upgrade is locked', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory
      const newImplementation = ethers.Wallet.createRandom().address
      const lockDuration = 1000

      await beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(lockDuration)

      // Assume the current time is within the lock period
      const lockEndTimestamp = (await beaconFactoryAdmin.beaconUpgradesLockedUntilTimestamp()).toNumber()
      expect(lockEndTimestamp).to.be.gt((await time.latest()) + lockDuration - 10)
      await time.increaseTo(lockEndTimestamp - 10)

      await expect(
        beaconFactoryAdmin
          .connect(accounts.admin)
          .upgradeBeaconFactoryImplementation(beaconFactory.address, newImplementation),
      ).to.be.revertedWithCustomError(beaconFactoryAdmin, 'BeaconUpgradeIsLocked')
    })

    it('should revert if called by a non-controller', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory
      const newImplementation = ethers.Wallet.createRandom().address

      await expect(
        beaconFactoryAdmin
          .connect(accounts.notAdmin)
          .upgradeBeaconFactoryImplementation(beaconFactory.address, newImplementation),
      ).to.be.revertedWithCustomError(beaconFactoryAdmin, 'OnlySecureTimelock')
    })
  })

  describe('lockBeaconUpgradesForDuration', function () {
    it('should lock upgrades for the specified duration', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory
      const duration = 1000

      await beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(duration)

      const lockTimestamp = await beaconFactoryAdmin.beaconUpgradesLockedUntilTimestamp()
      expect(lockTimestamp).to.be.gte((await time.latest()) + duration)
    })

    it('should extend the lock if it is still active', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory
      const initialDuration = 1000
      const extensionDuration = 500

      await beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(initialDuration)
      await beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(extensionDuration)

      const lockTimestamp = await beaconFactoryAdmin.beaconUpgradesLockedUntilTimestamp()
      expect(lockTimestamp).to.be.gte((await time.latest()) + initialDuration + extensionDuration - 10)
    })

    it('should revert if the duration exceeds the maximum allowed', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory
      const excessiveDuration = 366 * 24 * 60 * 60 // More than 365 days

      await expect(
        beaconFactoryAdmin.connect(accounts.admin).lockBeaconUpgradesForDuration(excessiveDuration),
      ).to.be.revertedWithCustomError(beaconFactoryAdmin, 'DurationAboveMax')
    })
  })

  describe('setTrustedTimelockController', function () {
    it('should set a trusted timelock controller', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory

      await beaconFactoryAdmin.connect(accounts.admin).setTrustedTimelockController(accounts.newAdmin.address, true)

      const isTrusted = await beaconFactoryAdmin.isTrustedTimelockController(accounts.newAdmin.address)
      expect(isTrusted).to.be.true
    })

    it('should revert if called by a non-owner', async function () {
      const { beaconFactoryAdmin, beaconFactory } = contracts.testBeaconFactory

      await expect(
        beaconFactoryAdmin.connect(accounts.notAdmin).setTrustedTimelockController(accounts.newAdmin.address, true),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('deployUpgradeableBeaconForFactory', function () {
    it('should deploy a new upgradeable beacon for the factory', async function () {
      const { beaconFactoryAdmin, beaconFactory, mockERC20_Implementation } = contracts.testBeaconFactory

      const beacon = await beaconFactoryAdmin
        .connect(accounts.admin)
        .deployUpgradeableBeaconForFactory(
          'BeaconFactory_Test',
          beaconFactory.address,
          mockERC20_Implementation.address,
        )

      expect(beacon).to.not.be.undefined
    })
  })
})
