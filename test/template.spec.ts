import { artifacts, ethers } from 'hardhat'
// https://hardhat.org/hardhat-network-helpers/docs/reference
import { mine, time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import '@nomicfoundation/hardhat-chai-matchers'

import { dynamicFixture } from './fixtures'
import { Lock__factory } from '../typechain-types'

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
  const [deployer, admin, notAdmin] = accounts
  // Compose other fixtures to create a meta fixture
  const [unlockTime, owner] = [(await time.latest()) + 24 * 3600, accounts[0].address]
  const lock = await dynamicFixture<Lock__factory>(ethers, 'Lock', [unlockTime, owner])
  // Deploy other contracts within this fixture to gain efficiency of fixtures

  return {
    contracts: {
      lock,
    },
    accounts: {
      deployer,
      admin,
      notAdmin,
    },
  }
}

describe('Test Template', function () {
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

  it('Should be under the contract size limit', async function () {
    const contractArtifact = await artifacts.readArtifact('Lock')
    const contractSize = Buffer.byteLength(contractArtifact.deployedBytecode, 'utf8') / 2 // bytecode is hex-encoded

    const sizeLimit = 24576 // 24 KB limit
    expect(contractSize).to.be.lessThan(
      sizeLimit,
      `Contract size is ${contractSize} bytes, which exceeds the limit of ${sizeLimit} bytes`
    )
  })
})
