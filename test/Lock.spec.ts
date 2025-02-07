/**
 * hardhat-network-helpers:
 * `mine`: Increase block height
 * `time`: Adjust block timestamp
 */
import { mine, time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { deployOneYearLockFixture } from './fixtures/deployLock'
/**
 * hardhat-chai-matchers reference
 * https://hardhat.org/hardhat-chai-matchers/docs/reference
 *
 * The @nomicfoundation/hardhat-chai-matchers plugin is meant to be a drop-in replacement
 * for the @nomiclabs/hardhat-waffle plugin
 *
 * https://hardhat.org/hardhat-chai-matchers/docs/migrate-from-waffle
 *
 * VSCode + Hardhat:
 * https://marketplace.visualstudio.com/items?itemName=NomicFoundation.hardhat-solidity
 */
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs'
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('Lock', function () {
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
    const lockDeployment = await deployOneYearLockFixture(ethers)
    return { ...lockDeployment }
  }

  let FR: FixtureReturn
  before(async function () {
    // Add code here to run before all tests
  })

  beforeEach(async function () {
    // Add code here to run before each test
    FR = await loadFixture(fixture)
  })

  describe('Deployment', function () {
    it('Should set the right unlockTime', async function () {
      expect(await FR.lock.unlockTime()).to.equal(FR.unlockTime)
    })

    it('Should set the right owner', async function () {
      expect(await FR.lock.owner()).to.equal(FR.owner.address)
    })

    it('Should receive and store the funds to lock', async function () {
      expect(await ethers.provider.getBalance(FR.lock.address)).to.equal(FR.lockedAmount)
    })

    it('Should fail if the unlockTime is not in the future', async function () {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest()
      const Lock = await ethers.getContractFactory('Lock')
      await expect(Lock.deploy(latestTime, FR.owner.address, { value: 1 })).to.be.revertedWith(
        'Unlock time should be in the future',
      )
    })
  })

  describe('Withdrawals', function () {
    describe('Validations', function () {
      it('Should revert with the right error if called too soon', async function () {
        await expect(FR.lock.withdraw()).to.be.revertedWith("You can't withdraw yet")
      })

      it('Should revert with the right error if called from another account', async function () {
        // We can increase the time in Hardhat Network
        await time.increaseTo(FR.unlockTime)

        // We use lock.connect() to send a transaction from another account
        await expect(FR.lock.connect(FR.otherAccount).withdraw()).to.be.revertedWith("You aren't the owner")
        // NOTE: To test for a custom error, we can use the `to.be.revertedWithCustomError()` matcher
        // await expect(lock.connect(otherAccount).withdraw()).to.be.revertedWithCustomError('ErrorLock_NotTheOwner')
      })

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async function () {
        // Transactions are sent using the first signer by default
        await time.increaseTo(FR.unlockTime)

        await expect(FR.lock.withdraw()).not.to.be.reverted
      })
    })

    describe('Events', function () {
      it('Should emit an event on withdrawals', async function () {
        await time.increaseTo(FR.unlockTime)

        await expect(FR.lock.withdraw()).to.emit(FR.lock, 'Withdrawal').withArgs(FR.lockedAmount, anyValue) // We can accept any value as `when` arg
      })
    })

    describe('Transfers', function () {
      it('Should transfer the funds to the owner', async function () {
        await time.increaseTo(FR.unlockTime)

        await expect(FR.lock.withdraw()).to.changeEtherBalances(
          [FR.owner, FR.lock],
          [FR.lockedAmount, -FR.lockedAmount],
        )
      })
    })
  })
})
