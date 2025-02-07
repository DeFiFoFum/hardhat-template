import { artifacts, ethers } from 'hardhat'
// https://hardhat.org/hardhat-network-helpers/docs/reference
import { mine, time, loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import '@nomicfoundation/hardhat-chai-matchers'

import { dynamicFixture } from './fixtures'
import { Erc7201__factory, Lock__factory } from '../typechain-types'
import { DeployManager } from '../scripts/deploy/DeployManager'

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
  const deployManager = await DeployManager.create({ signer: deployer })

  const erc7201 = await deployManager.deployContract<Erc7201__factory>('Erc7201', [])

  return {
    contracts: {
      erc7201,
    },
    accounts: {
      deployer,
      admin,
      notAdmin,
    },
  }
}

describe('ERC-7201', function () {
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
    const contractArtifact = await artifacts.readArtifact('Erc7201')
    const contractSize = Buffer.byteLength(contractArtifact.deployedBytecode, 'utf8') / 2 // bytecode is hex-encoded

    const sizeLimit = 24576 // 24 KB limit
    expect(contractSize).to.be.lessThan(
      sizeLimit,
      `Contract size is ${contractSize} bytes, which exceeds the limit of ${sizeLimit} bytes`,
    )
  })

  it('Should return the correct storage address for namespace ID', async function () {
    // source: https://github.com/OpenZeppelin/openzeppelin-contracts-upgradeable/blob/7f47eb4df9cf70306cc167f4d655275d94dda7cc/contracts/token/ERC20/ERC20Upgradeable.sol#L44C53-L44C119
    const namespace = 'openzeppelin.storage.ERC20'
    const storageAddress = await contracts.erc7201.getStorageAddress(namespace)
    expect(storageAddress).to.be.equal('0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00')
  })

  it('Should return a storage address for a custom namespace ID', async function () {
    const customNameSpaceId = 'openzeppelin.storage.ERC20'
    const storageAddress = await contracts.erc7201.getStorageAddress(customNameSpaceId)
    expect(storageAddress).to.not.be.undefined

    console.dir({
      customNameSpaceId,
      storageAddress,
    })
  })
})
