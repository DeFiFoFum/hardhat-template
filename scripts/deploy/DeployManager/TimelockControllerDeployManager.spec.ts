import { ethers, network } from 'hardhat'
// https://hardhat.org/hardhat-network-helpers/docs/reference
import { mine, time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import '@nomicfoundation/hardhat-chai-matchers'
import { DeployManager } from './DeployManager'
import { TimelockDeployManager } from './TimelockControllerDeployManager'
import { TimelockControllerEnumerable } from '../../../typechain-types'

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
  // Ensure we're using the hardhat network
  if (network.name !== 'hardhat') {
    throw new Error('This test must be run on the hardhat network')
  }

  // Contracts are deployed using the first signer/account by default
  const accounts = await ethers.getSigners()
  const [deployer, admin, notAdmin, proposer, executor, canceller] = accounts

  // Create DeployManager instance
  const deployManager = await DeployManager.create({
    signer: deployer,
    baseDir: './deployments/test',
  })

  return {
    contracts: {},
    accounts: {
      deployer,
      admin,
      notAdmin,
      proposer,
      executor,
      canceller,
    },
    deployManager,
  }
}

describe('TimelockControllerDeployManager - Hardhat + EthersV5', function () {
  let FR: FixtureReturn
  let accounts: FixtureReturn['accounts']
  let deployManager: DeployManager
  let timelockDeployManager: TimelockDeployManager

  beforeEach(async function () {
    FR = await loadFixture(fixture)
    accounts = FR.accounts
    deployManager = FR.deployManager
  })

  describe('create', () => {
    it('should create a TimelockDeployManager instance with correct props', async () => {
      const proposers = [accounts.proposer.address]
      const executors = [accounts.executor.address]
      const admin = accounts.admin.address
      const cancellers = [accounts.canceller.address]

      timelockDeployManager = await TimelockDeployManager.create({
        deployManager,
        proposers,
        executors,
        cancellers,
        admin,
      })

      expect(timelockDeployManager.props.deployManager).to.equal(deployManager)
      expect(timelockDeployManager.props.proposers).to.deep.equal(proposers)
      expect(timelockDeployManager.props.executors).to.deep.equal(executors)
      expect(timelockDeployManager.props.admin).to.equal(admin)
      expect(timelockDeployManager.props.cancellers).to.deep.equal(cancellers)
    })
  })

  describe('deployAndConfigureTimelock', () => {
    const minDelaySeconds = 3600 // 1 hour

    beforeEach(async () => {
      const proposers = [accounts.proposer.address]
      const executors = [accounts.executor.address]
      const admin = accounts.admin.address
      const cancellers = [accounts.canceller.address]

      timelockDeployManager = await TimelockDeployManager.create({
        deployManager,
        proposers,
        executors,
        cancellers,
        admin,
      })
    })

    it('should deploy timelock with correct initial configuration', async () => {
      const timelock = await timelockDeployManager.deployAndConfigureTimelock(minDelaySeconds)

      // Check timelock address is not zero
      expect(timelock.address).to.not.equal(ethers.constants.AddressZero)

      // Check min delay
      const actualMinDelay = await timelock.getMinDelay()
      expect(actualMinDelay).to.equal(minDelaySeconds)

      // Check roles
      const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE()
      const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
      const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE()
      const CANCELLER_ROLE = await timelock.CANCELLER_ROLE()

      // Check admin role
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.true
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.deployer.address)).to.be.false

      // Check proposer role
      expect(await timelock.hasRole(PROPOSER_ROLE, accounts.proposer.address)).to.be.true

      // Check executor role
      expect(await timelock.hasRole(EXECUTOR_ROLE, accounts.executor.address)).to.be.true

      // Check canceller role
      expect(await timelock.hasRole(CANCELLER_ROLE, accounts.canceller.address)).to.be.true
    })

    it('should handle deployment without cancellers', async () => {
      // Create new instance without cancellers
      timelockDeployManager = await TimelockDeployManager.create({
        deployManager,
        proposers: [accounts.proposer.address],
        executors: [accounts.executor.address],
        admin: accounts.admin.address,
        cancellers: [],
      })

      const timelock = await timelockDeployManager.deployAndConfigureTimelock(minDelaySeconds)
      const CANCELLER_ROLE = await timelock.CANCELLER_ROLE()

      // Verify no cancellers were set
      expect(await timelock.hasRole(CANCELLER_ROLE, accounts.canceller.address)).to.be.false
    })

    it('should deploy timelock with null admin to enable timelocked admin changes', async () => {
      // Create new instance with null admin
      timelockDeployManager = await TimelockDeployManager.create({
        deployManager,
        proposers: [accounts.proposer.address],
        executors: [accounts.executor.address],
        admin: null,
        cancellers: [],
      })

      const timelock = await timelockDeployManager.deployAndConfigureTimelock(minDelaySeconds)
      const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE()
      const deployer = await deployManager.getSigner()
      const deployerAddress = await deployer.getAddress()

      // Verify initial state
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, deployerAddress)).to.be.false // Deployer should not have admin role
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, timelock.address)).to.be.true // Timelock should be the only admin

      // Test that admin role changes must go through timelock
      const target = timelock.address
      const value = 0
      const data = timelock.interface.encodeFunctionData('grantRole', [TIMELOCK_ADMIN_ROLE, accounts.admin.address])
      const predecessor = ethers.constants.HashZero
      const salt = ethers.utils.randomBytes(32)
      const delay = minDelaySeconds

      // Schedule granting admin role to admin address
      await timelock.connect(accounts.proposer).schedule(target, value, data, predecessor, salt, delay)

      // Verify admin role is not yet granted
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.false

      // Fast forward time past the delay
      await time.increase(delay + 1)

      // Execute the operation
      await timelock.connect(accounts.executor).execute(target, value, data, predecessor, salt)

      // Verify admin role was granted after timelock execution
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.true
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, timelock.address)).to.be.true
    })

    it('should allow timelock to execute transactions when it is the only admin', async () => {
      const timelock = await timelockDeployManager.deployAndConfigureTimelock(minDelaySeconds)
      const TIMELOCK_ADMIN_ROLE = await timelock.TIMELOCK_ADMIN_ROLE()
      const PROPOSER_ROLE = await timelock.PROPOSER_ROLE()
      const EXECUTOR_ROLE = await timelock.EXECUTOR_ROLE()

      // First verify initial state
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.true
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, timelock.address)).to.be.true

      // Revoke admin role from the admin address
      await timelock.connect(accounts.admin).revokeRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)

      // Verify only timelock has admin role
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.false
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, timelock.address)).to.be.true

      // Create a simple operation to test timelock execution
      const target = timelock.address // Target is the timelock itself
      const value = 0 // No ETH transfer
      const data = timelock.interface.encodeFunctionData('grantRole', [TIMELOCK_ADMIN_ROLE, accounts.admin.address]) // Encode the grantRole function call
      const predecessor = ethers.constants.HashZero // No predecessor
      const salt = ethers.utils.randomBytes(32) // Random salt
      const delay = minDelaySeconds
      try {
        // Schedule the operation
        await timelock.connect(accounts.proposer).schedule(target, value, data, predecessor, salt, delay)
      } catch (error) {
        throw new Error(`Failed to schedule timelock operation: ${error}`)
      }

      // Fast forward time past the delay
      await time.increase(delay + 1)

      try {
        // Execute the operation
        await timelock.connect(accounts.executor).execute(target, value, data, predecessor, salt)
      } catch (error) {
        throw new Error(`Failed to execute timelock operation: ${error}`)
      }

      // Verify the admin role was granted back to the admin address
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, accounts.admin.address)).to.be.true
      expect(await timelock.hasRole(TIMELOCK_ADMIN_ROLE, timelock.address)).to.be.true

      // If we get here, the transaction was successful
      // This validates that the timelock can still execute operations even when it's the only admin
    })
  })
})
