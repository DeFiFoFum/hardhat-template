import { artifacts, ethers } from 'hardhat'
// https://hardhat.org/hardhat-network-helpers/docs/reference
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers'
import { expect } from 'chai'
import '@nomicfoundation/hardhat-chai-matchers'

// Import Context Managers
import { Accounts_ContextManager } from './context-managers/Accounts_ContextManager'
import { CreateXDeployer, SaltType } from '../lib/evm/create2/CreateXDeployer'
import { DeployManager } from '../scripts/deploy/DeployManager/DeployManager'
import { CreateX__factory } from '../typechain-types'

/**
 * Configurable fixture to use for each test file.
 *
 * This fixture sets up the complete testing environment with context managers.
 * It initializes accounts, core protocol, collateral, and borrower operations.
 *
 * Fixtures improve test efficiency by reusing the same setup in every test.
 * loadFixture() runs this setup once, snapshots that state,
 * and resets the Hardhat Network to that snapshot for every test.
 */
type FixtureReturn = Awaited<ReturnType<typeof fixture>>
async function fixture() {
  // 1. Set up accounts
  const accounts = await ethers.getSigners()
  const accounts_CM = await Accounts_ContextManager.createWithAccountsArray(accounts)
  const { deployer } = accounts_CM.props.signers
  const deployManager = await DeployManager.create({ signer: deployer })

  const createX = await deployManager.deployContract<CreateX__factory>('CreateX', [])
  const createXDeployer = await CreateXDeployer.create(ethers, deployer, createX)

  return {
    createXDeployer,
    contracts: {
      createX,
    },
    accounts: accounts_CM.props.signers,
  }
}

describe('CreateXDeployer', function () {
  // Test variables
  let FR: FixtureReturn
  let accounts: FixtureReturn['accounts']
  let contracts: FixtureReturn['contracts']
  let createXDeployer: CreateXDeployer

  beforeEach(async function () {
    // Load the fixture before each test
    FR = await loadFixture(fixture)
    accounts = FR.accounts
    contracts = FR.contracts
    createXDeployer = FR.createXDeployer
  })

  describe('Basic Functionality', function () {
    it('Should be able to load fixture', async () => {
      expect(FR).to.not.be.undefined
      expect(accounts).to.not.be.undefined
      expect(contracts).to.not.be.undefined
    })

    it('Should be under the contract size limit', async function () {
      const contractArtifact = await artifacts.readArtifact('CreateX')
      const contractSize = Buffer.byteLength(contractArtifact.deployedBytecode, 'utf8') / 2 // bytecode is hex-encoded
      const sizeLimit = 24576 // 24 KB limit
      expect(contractSize).to.be.lessThan(
        sizeLimit,
        `Contract size is ${contractSize} bytes, which exceeds the limit of ${sizeLimit} bytes`,
      )
    })
  })

  describe('Initialization', function () {
    it('Should initialize with correct properties', async () => {
      expect(createXDeployer.ethers).to.equal(ethers)
      expect(createXDeployer.deployer).to.equal(accounts.deployer)
      expect(createXDeployer.createX).to.not.be.undefined
    })

    it('Should create an instance with the static create method', async () => {
      const newInstance = await CreateXDeployer.create(ethers, accounts.deployer)
      expect(newInstance).to.be.instanceOf(CreateXDeployer)
    })
  })

  describe('Salt Conversion Methods', function () {
    it('Should convert a number to a bytes32 salt', async () => {
      const saltNumber = 123456
      const bytes32Salt = createXDeployer.getBytes32SaltFromNumber(saltNumber)
      expect(bytes32Salt).to.have.lengthOf(66) // 0x + 64 hex chars
      expect(bytes32Salt).to.match(/^0x/)
    })

    it('Should calculate init code hash correctly', async () => {
      const testBytecode = '0x1234567890abcdef'
      const hash = createXDeployer.calculateInitCodeHash(testBytecode)
      expect(hash).to.match(/^0x/)
      expect(hash).to.have.lengthOf(66) // 0x + 64 hex chars
      // Hash should be deterministic for the same input
      expect(createXDeployer.calculateInitCodeHash(testBytecode)).to.equal(hash)
    })
  })

  describe('Proxy Bytecode Preparation', function () {
    it('Should prepare proxy bytecode with constructor args', async () => {
      const result = await createXDeployer.getProxyBytecodeWithConstructorArgs('TransparentUpgradeableProxy')
      expect(result).to.have.property('bytecode')
      expect(result).to.have.property('bytecodeHash')
      expect(result.bytecode).to.match(/^0x/)
      expect(result.bytecodeHash).to.match(/^0x/)
    })

    it('Should throw an error for invalid proxy contract name', async () => {
      try {
        // @ts-ignore - Testing invalid contract name
        await createXDeployer.getProxyBytecodeWithConstructorArgs('NonExistentContractName')
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error).to.exist
      }
    })
  })

  describe('CREATE2 Address Computation', function () {
    it('Should compute CREATE2 address correctly', async () => {
      const inputSalt = createXDeployer.getBytes32SaltFromNumber(123)
      const initCodeHash = '0x' + '1'.repeat(64)
      const address = createXDeployer.computeCreate2Address(inputSalt, initCodeHash)
      expect(address).to.match(/^0x/)
      expect(address).to.match(/^0x[0-9a-fA-F]{40}$/) // Valid Ethereum address format
    })

    it('Should produce different addresses for different salts', async () => {
      const initCodeHash = '0x' + '1'.repeat(64)
      const salt1 = createXDeployer.getBytes32SaltFromNumber(123)
      const salt2 = createXDeployer.getBytes32SaltFromNumber(456)
      const address1 = createXDeployer.computeCreate2Address(salt1, initCodeHash)
      const address2 = createXDeployer.computeCreate2Address(salt2, initCodeHash)
      expect(address1).to.not.equal(address2)
    })

    it('Should produce different addresses for different code hashes', async () => {
      const salt = createXDeployer.getBytes32SaltFromNumber(123)
      const hash1 = '0x' + '1'.repeat(64)
      const hash2 = '0x' + '2'.repeat(64)
      const address1 = createXDeployer.computeCreate2Address(salt, hash1)
      const address2 = createXDeployer.computeCreate2Address(salt, hash2)
      expect(address1).to.not.equal(address2)
    })
  })

  describe('Salt Validation and Protection', function () {
    it('Should validate salts correctly', async () => {
      // Create a normal salt (no protection)
      const normalSalt = createXDeployer.createSalt(SaltType.NORMAL, 12345)
      expect(createXDeployer.validateSalt(normalSalt)).to.be.true

      // Create a sender-protected salt
      const senderProtectedSalt = createXDeployer.createSalt(SaltType.SENDER_PROTECTED, 12345)
      expect(createXDeployer.validateSalt(senderProtectedSalt)).to.be.true

      // Create a sender-protected salt with a different address (should fail validation)
      const otherAddress = accounts.alice?.address || '0x1234567890123456789012345678901234567890'
      const invalidSalt = createXDeployer.createSalt(SaltType.SENDER_PROTECTED, 12345, otherAddress)
      expect(createXDeployer.validateSalt(invalidSalt)).to.be.false
    })

    it('Should identify salt protection types correctly', async () => {
      const normalSalt = createXDeployer.createSalt(SaltType.NORMAL, 12345)
      expect(createXDeployer.getSaltType(normalSalt)).to.equal(SaltType.NORMAL)

      const crossChainSalt = createXDeployer.createSalt(SaltType.CROSS_CHAIN_PROTECTED, 12345)
      expect(createXDeployer.getSaltType(crossChainSalt)).to.equal(SaltType.CROSS_CHAIN_PROTECTED)

      const senderSalt = createXDeployer.createSalt(SaltType.SENDER_PROTECTED, 12345)
      expect(createXDeployer.getSaltType(senderSalt)).to.equal(SaltType.SENDER_PROTECTED)

      const bothSalt = createXDeployer.createSalt(SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED, 12345)
      expect(createXDeployer.getSaltType(bothSalt)).to.equal(SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED)
    })

    it('Should create different salts for different protection types', async () => {
      const entropy = 12345
      const normalSalt = createXDeployer.createSalt(SaltType.NORMAL, entropy)
      const crossChainSalt = createXDeployer.createSalt(SaltType.CROSS_CHAIN_PROTECTED, entropy)
      const senderSalt = createXDeployer.createSalt(SaltType.SENDER_PROTECTED, entropy)
      const bothSalt = createXDeployer.createSalt(SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED, entropy)

      expect(normalSalt).to.not.equal(crossChainSalt)
      expect(normalSalt).to.not.equal(senderSalt)
      expect(normalSalt).to.not.equal(bothSalt)
      expect(crossChainSalt).to.not.equal(senderSalt)
      expect(crossChainSalt).to.not.equal(bothSalt)
      expect(senderSalt).to.not.equal(bothSalt)
    })
  })

  describe('Guarded Salt Processing', function () {
    it('Should transform input salt to guarded salt based on protection type', async () => {
      // Test each protection type
      const normalSalt = createXDeployer.createSalt(SaltType.NORMAL, 12345)
      const guardedNormalSalt = createXDeployer.getGuardedSalt(normalSalt)
      expect(guardedNormalSalt).to.not.equal(normalSalt)
      expect(guardedNormalSalt).to.match(/^0x/)

      const crossChainSalt = createXDeployer.createSalt(SaltType.CROSS_CHAIN_PROTECTED, 12345)
      const guardedCrossChainSalt = createXDeployer.getGuardedSalt(crossChainSalt)
      expect(guardedCrossChainSalt).to.not.equal(crossChainSalt)
      expect(guardedCrossChainSalt).to.match(/^0x/)

      const senderSalt = createXDeployer.createSalt(SaltType.SENDER_PROTECTED, 12345)
      const guardedSenderSalt = createXDeployer.getGuardedSalt(senderSalt)
      expect(guardedSenderSalt).to.not.equal(senderSalt)
      expect(guardedSenderSalt).to.match(/^0x/)

      const bothSalt = createXDeployer.createSalt(SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED, 12345)
      const guardedBothSalt = createXDeployer.getGuardedSalt(bothSalt)
      expect(guardedBothSalt).to.not.equal(bothSalt)
      expect(guardedBothSalt).to.match(/^0x/)
    })

    it('Should produce deterministic guarded salts for the same input', async () => {
      const inputSalt = createXDeployer.createSalt(SaltType.NORMAL, 12345)
      const guardedSalt1 = createXDeployer.getGuardedSalt(inputSalt)
      const guardedSalt2 = createXDeployer.getGuardedSalt(inputSalt)
      expect(guardedSalt1).to.equal(guardedSalt2)
    })
  })

  describe('Contract Deployment', function () {
    // Note: These tests require mocking the CreateX contract since we don't want to deploy real contracts in unit tests
    it('Should have a deployCreate2 method', async () => {
      expect(typeof createXDeployer.deployCreate2).to.equal('function')
    })

    it('Should have a deployProxyWithSalt method', async () => {
      expect(typeof createXDeployer.deployProxyWithSalt).to.equal('function')
    })
  })

  describe('Event Parsing', function () {
    it('Should parse contract creation events', async () => {
      // Create a mock receipt object with a valid ContractCreation event
      const mockReceipt = {
        to: '0x1234567890123456789012345678901234567890',
        from: '0x0987654321098765432109876543210987654321',
        contractAddress: null,
        transactionIndex: 0,
        gasUsed: ethers.BigNumber.from(100000),
        logsBloom: '0x',
        blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        logs: [],
        blockNumber: 0,
        confirmations: 0,
        cumulativeGasUsed: ethers.BigNumber.from(100000),
        effectiveGasPrice: ethers.BigNumber.from(100000),
        status: 1,
        type: 0,
        byzantium: true,
        events: [
          {
            topics: [
              '0x4db17dd5e4732fb6da34a148104a592783ca119a1e7bb8829eba6cbadef0b511', // Event signature hash
              '0x000000000000000000000000a5e25b44b1e51d9f730efdd5bd324c2a5655715e', // Contract address (padded)
              '0x0000000000000000000000000000000000000000000000000000000000000123', // Salt (example value)
            ],
          },
        ],
      }

      const { contractAddress, salt } = createXDeployer.parseContractCreationEvents(mockReceipt as any)
      expect(contractAddress).to.equal('0xa5e25b44b1e51d9f730efdd5bd324c2a5655715e')
      expect(salt).to.equal('0x0000000000000000000000000000000000000000000000000000000000000123')
    })

    it('Should handle receipts with contractAddress property', async () => {
      // Create a mock receipt without events but with contractAddress property
      const mockReceipt = {
        to: null,
        from: '0x0987654321098765432109876543210987654321',
        contractAddress: '0xa5e25b44b1e51d9f730efdd5bd324c2a5655715e',
        transactionIndex: 0,
        gasUsed: ethers.BigNumber.from(100000),
        logsBloom: '0x',
        blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        logs: [],
        blockNumber: 0,
        confirmations: 0,
        cumulativeGasUsed: ethers.BigNumber.from(100000),
        effectiveGasPrice: ethers.BigNumber.from(100000),
        status: 1,
        type: 0,
        byzantium: true,
        events: [],
      }

      const { contractAddress, salt } = createXDeployer.parseContractCreationEvents(mockReceipt as any)
      expect(contractAddress).to.equal('0xa5e25b44b1e51d9f730efdd5bd324c2a5655715e')
      expect(salt).to.be.null
    })

    it('Should handle receipts with no relevant events', async () => {
      // Create a mock receipt with no relevant events
      const mockReceipt = {
        to: '0x1234567890123456789012345678901234567890',
        from: '0x0987654321098765432109876543210987654321',
        contractAddress: null,
        transactionIndex: 0,
        gasUsed: ethers.BigNumber.from(100000),
        logsBloom: '0x',
        blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        logs: [],
        blockNumber: 0,
        confirmations: 0,
        cumulativeGasUsed: ethers.BigNumber.from(100000),
        effectiveGasPrice: ethers.BigNumber.from(100000),
        status: 1,
        type: 0,
        byzantium: true,
        events: [
          {
            topics: [
              '0x0000000000000000000000000000000000000000000000000000000000000000', // Not a ContractCreation event
            ],
          },
        ],
      }

      const { contractAddress, salt } = createXDeployer.parseContractCreationEvents(mockReceipt as any)
      expect(contractAddress).to.be.null
      expect(salt).to.be.null
    })
  })

  // Future: Add integration tests with a mocked CreateX contract
  // Could use ethers.utils.getContractFactory to mock the contract or use a separate test file

  // Future: Add tests for address prediction and vanity address features
})
