import { expect } from 'chai'
import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { VersionUtilsTester } from '../../typechain-types'
import { dynamicFixture } from '../fixtures'
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'

type FixtureReturn = Awaited<ReturnType<typeof fixture>>
async function fixture() {
  // Contracts are deployed using the first signer/account by default
  const accounts = await ethers.getSigners()

  const VersionUtilsTester = await ethers.getContractFactory('VersionUtilsTester')
  const versionUtilsTester = await VersionUtilsTester.deploy()
  await versionUtilsTester.deployed()

  return { accounts, versionUtilsTester }
}

describe('VersionUtils', () => {
  let FR: FixtureReturn
  before(async function () {
    // Add code here to run before all tests
  })

  beforeEach(async function () {
    // Add code here to run before each test
    FR = await loadFixture(fixture)
  })

  describe('Version Parsing', () => {
    it('should correctly parse valid version strings', async () => {
      const testCases: [string, number[]][] = [
        ['2.4.0', [2, 4, 0]],
        ['1.0.0', [1, 0, 0]],
        ['10.20.30', [10, 20, 30]],
        ['0.1.0', [0, 1, 0]],
      ]

      for (const [version, expected] of testCases) {
        const result = await FR.versionUtilsTester.testParseVersion(version)
        expect(result.major).to.equal(expected[0])
        expect(result.minor).to.equal(expected[1])
        expect(result.patch).to.equal(expected[2])
      }
    })

    it('should revert on invalid version formats', async () => {
      const invalidVersions = [
        '', // empty string
        '1', // missing components
        '1.2', // missing patch
        '1.2.3.4', // too many components
        '.1.2', // missing major
        '1..2', // empty minor
        '1.2.', // missing patch
        'a.b.c', // non-numeric
        '1.2.c', // partial non-numeric
      ]

      for (const version of invalidVersions) {
        await expect(FR.versionUtilsTester.testParseVersion(version)).to.be.revertedWithCustomError(
          FR.versionUtilsTester,
          'InvalidVersionFormat',
        )
      }
    })
  })

  describe('Version Compatibility', () => {
    describe('Strict Compatibility', () => {
      it('should pass for valid version upgrades', async () => {
        const testCases = [
          ['2.4.0', '2.4.1', '2.4.0'], // patch upgrade
          ['2.4.0', '2.5.0', '2.4.0'], // minor upgrade
          ['2.4.1', '2.4.1', '2.4.0'], // same version
          ['2.4.0', '2.4.0', '2.3.0'], // above minimum
        ]

        for (const [current, new_, min] of testCases) {
          expect(await FR.versionUtilsTester.testIsCompatibleStrict(current, new_, min)).to.be.true
        }
      })

      it('should fail for invalid version upgrades', async () => {
        const testCases = [
          ['2.4.0', '3.0.0', '2.4.0'], // major change
          ['2.4.0', '1.0.0', '1.0.0'], // major downgrade
          ['2.4.0', '2.3.0', '2.3.0'], // minor downgrade
          ['2.4.1', '2.4.0', '2.4.0'], // patch downgrade
          ['2.4.0', '2.4.1', '2.5.0'], // below minimum
        ]

        for (const [current, new_, min] of testCases) {
          expect(await FR.versionUtilsTester.testIsCompatibleStrict(current, new_, min)).to.be.false
        }
      })
    })

    describe('Flexible Compatibility', () => {
      it('should pass for valid version upgrades', async () => {
        const testCases = [
          ['2.4.0', '2.4.1', '2.4.0'], // patch upgrade
          ['2.4.0', '2.5.0', '2.4.0'], // minor upgrade
          ['2.4.0', '3.0.0', '2.4.0'], // major upgrade
          ['2.4.1', '2.4.1', '2.4.0'], // same version
        ]

        for (const [current, new_, min] of testCases) {
          expect(await FR.versionUtilsTester.testIsCompatibleFlexible(current, new_, min)).to.be.true
        }
      })

      it('should fail for invalid version upgrades', async () => {
        const testCases = [
          ['2.4.0', '1.0.0', '1.0.0'], // major downgrade
          ['2.4.0', '2.3.0', '2.3.0'], // minor downgrade
          ['2.4.1', '2.4.0', '2.4.0'], // patch downgrade
          ['2.4.0', '2.4.1', '2.5.0'], // below minimum
        ]

        for (const [current, new_, min] of testCases) {
          expect(await FR.versionUtilsTester.testIsCompatibleFlexible(current, new_, min)).to.be.false
        }
      })
    })
  })

  describe('Minimum Version Check', () => {
    it('should correctly validate minimum versions', async () => {
      const testCases: [string, string, boolean][] = [
        ['2.4.1', '2.4.0', true], // above minimum
        ['2.4.0', '2.4.0', true], // equal to minimum
        ['2.3.9', '2.4.0', false], // below minimum
        ['2.5.0', '2.4.1', true], // minor above
        ['3.0.0', '2.4.0', true], // major above
        ['1.9.9', '2.0.0', false], // major below
      ]

      for (const [version, minVersion, expected] of testCases) {
        expect(await FR.versionUtilsTester.testIsCompatibleFlexible(version, version, minVersion)).to.equal(expected)
      }
    })
  })
})
