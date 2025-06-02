import { ContractFactory, ContractReceipt } from 'ethers'
import { ethers } from 'hardhat'
import { logger } from '../../../hardhat/utils'
import { CreateX } from '../../../typechain-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { getErrorMessage } from '../../node/getErrorMessage'
import { SupportedNamedProxyContractNames } from '../proxy/namedProxy.config'

export const DEFAULT_CREATE_X_CONTRACT_ADDRESS = '0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed'

/**
 * Salt protection types
 */
export enum SaltType {
  NORMAL = 'NORMAL', // No special protection
  CROSS_CHAIN_PROTECTED = 'CROSS_CHAIN_PROTECTED', // Prevents cross-chain redeployment
  SENDER_PROTECTED = 'SENDER_PROTECTED', // Only this sender can deploy
  SENDER_AND_CROSS_CHAIN_PROTECTED = 'SENDER_AND_CROSS_CHAIN_PROTECTED', // Both protections
}

/**
 * XDeployer is a utility class to deploy contracts using the Create2 pattern.
 *
 * Key Concepts:
 * - INPUT SALT: What you pass to deployCreate2() - used for vanity address generation
 * - GUARDED SALT: What CreateX computes internally - used for actual address calculation
 *
 * For detailed explanation of how salt transformation works, see the CREATE2_GUIDE.md
 * This is crucial for understanding vanity address generation with CreateX.
 *
 * Credit to @pcaversaccio for the XDeployer implementation and contract deployments.
 * https://github.com/pcaversaccio/xdeployer
 *
 * ┌────────────────────────────────────────────────────────────────────────────────┐
 * │                                                                                │
 * │                    CREATE2 SALT HANDLING IN CREATEX                            │
 * │                                                                                │
 * │  INPUT SALT                    GUARDED SALT                 CREATE2 ADDRESS    │
 * │  ──────────                    ────────────                 ───────────────    │
 * │  What you provide              What CreateX computes         Final Address     │
 * │  to the contract               internally via _guard()                         │
 * │                                                                                │
 * │  ┌─────────────────┐           ┌──────────────┐            ┌─────────────┐     │
 * │  │ 20 bytes        │     ┌────>│              │            │             │     │
 * │  │ (address/zeros) │     │     │  Computed    │ ──────────>│  Contract   │     │
 * │  ├─────────────────┤     │     │    Hash      │            │  Address    │     │
 * │  │ 1 byte (flag)   │     │     │              │            │             │     │
 * │  ├─────────────────┤     │     └──────────────┘            └─────────────┘     │
 * │  │ 11 bytes random │ ────┘                                                     │
 * │  └─────────────────┘          ** Depends on protection type **                 │
 * │                                                                                │
 * │  Protection Types:                                                             │
 * │  - NORMAL:                     Just uses your salt directly                    │
 * │  - SENDER_PROTECTED:           Hashes your salt with sender address            │
 * │  - CROSS_CHAIN_PROTECTED:      Hashes your salt with chain ID                  │
 * │  - SENDER_AND_CROSS_CHAIN:     Hashes with both chain ID and sender            │
 * │                                                                                │
 * │                                                                                │
 * │  Terms:                                                                        │
 * │  - Input Salt: The salt value you pass to deployCreate2()                      │
 * │  - Guarded Salt: The salt after CreateX applies its _guard() function          │
 * │                                                                                │
 * │  Important: Vanity address generation must account for how CreateX modifies    │
 * │  the salt internally, otherwise computed addresses will be incorrect.          │
 * │                                                                                │
 * └────────────────────────────────────────────────────────────────────────────────┘
 */
export class CreateXDeployer {
  ethers: typeof ethers
  createX: CreateX
  deployer: SignerWithAddress

  private constructor(_ethers: typeof ethers, _deployer: SignerWithAddress, createX: CreateX) {
    this.ethers = _ethers
    this.deployer = _deployer
    this.createX = createX
  }

  static async create(_ethers: typeof ethers, _deployer: SignerWithAddress, createXOverride?: CreateX) {
    const createX = createXOverride || (await _ethers.getContractAt('CreateX', DEFAULT_CREATE_X_CONTRACT_ADDRESS))
    return new CreateXDeployer(_ethers, _deployer, createX)
  }

  getBytes32SaltFromNumber(saltNumber: number) {
    const hexValue = this.ethers.utils.hexlify(saltNumber)
    // Pad the hexadecimal string to 32 bytes (64 characters + '0x' prefix)
    const paddedHexString = ethers.utils.hexZeroPad(hexValue, 32)
    return paddedHexString
  }

  /**
   * Calculates the init code hash for a contract with constructor arguments
   * @param bytecodeWithArgs Complete bytecode with constructor arguments
   * @returns The keccak256 hash of the bytecode
   */
  calculateInitCodeHash(bytecodeWithArgs: string): string {
    return this.ethers.utils.keccak256(bytecodeWithArgs)
  }

  /**
   * Prepares the bytecode and its hash for the vanity address generator
   * @param proxyContractName The name of the proxy contract
   * @returns Object with complete bytecode and its hash
   */
  async getProxyBytecodeWithConstructorArgs(
    proxyContractName: SupportedNamedProxyContractNames,
  ): Promise<{ bytecode: string; bytecodeHash: string; constructorArgs: string[] }> {
    let factory: ContractFactory
    try {
      factory = await this.ethers.getContractFactory(proxyContractName)
    } catch (e) {
      const errorMessage = getErrorMessage(e)
      logger.error(
        `CreateXDeployer.prepareTransparentProxyBytecodeWithConstructorArgs:: Error getting contract factory: ${errorMessage}`,
      )
      throw e
    }
    const bytecodeBase = factory.bytecode.startsWith('0x') ? factory.bytecode.slice(2) : factory.bytecode

    // Use provided addresses or defaults
    const logic = this.createX.address
    const admin = this.deployer.address

    logger.log(
      `CreateXDeployer.prepareTransparentProxyBytecodeWithConstructorArgs:: Using logic=${logic} and admin=${admin}`,
      '⚙️',
    )

    // Encode constructor arguments using ethers ABI encoder
    const constructorArgs = [logic, admin, '0x']
    const encodedArgs = this.ethers.utils.defaultAbiCoder
      .encode(['address', 'address', 'bytes'], constructorArgs)
      .slice(2) // remove 0x prefix

    // Combine bytecode with encoded constructor arguments
    const bytecodeWithArgs = '0x' + bytecodeBase + encodedArgs
    const bytecodeHash = this.calculateInitCodeHash(bytecodeWithArgs)

    return {
      bytecode: bytecodeWithArgs,
      bytecodeHash,
      constructorArgs,
    }
  }

  async deployCreate2<CF extends ContractFactory>(
    contractName: string,
    params: Parameters<CF['deploy']>,
    inputSalt: string,
  ): Promise<{ newContractAddress: string; newContractSalt: string; inputSalt: string }> {
    const initCode = (await this.ethers.getContractFactory(contractName)).getDeployTransaction(...params).data

    logger.log(`CreateXDeployer.deployCreate2:: Deploying contract ${contractName} with salt ${inputSalt}`, '🚀')

    if (!initCode) {
      throw new Error('CreateXDeployer.deployCreate2:: Could not get initCode')
    }

    const deployTx = await this.createX.connect(this.deployer)['deployCreate2(bytes32,bytes)'](inputSalt, initCode)
    const deployReceipt = await deployTx.wait()

    let [newContractAddress, newContractSalt] = [null, null]
    for (const event of deployReceipt.events || []) {
      try {
        const parsedEvent = this.createX.interface.parseLog(event)
        if (parsedEvent.name === 'ContractCreation') {
          newContractAddress = parsedEvent.args.newContract
          newContractSalt = parsedEvent.args.salt
        }
      } catch (e) {
        const errorMessage = getErrorMessage(e)
        // NOTE: parseLog will throw on events which it doesn't recognize
        logger.error(`CreateXDeployer.deployCreate2:: Error parsing event: ${errorMessage}`)
      }
    }

    logger.log(
      `CreateXDeployer.deployCreate2:: Contract deployed at address: ${newContractAddress} with salt ${newContractSalt}`,
      '🚀',
    )
    if (!newContractAddress || !newContractSalt) {
      throw new Error('CreateXDeployer.deployCreate2:: Could not get newContractAddress or newContractSalt')
    }
    return { newContractAddress, newContractSalt, inputSalt }
  }

  /**
   * Deploy a proxy contract using a specific salt (vanity address deployment)
   * @param proxyContractName The name of the proxy contract
   * @param inputSalt The specific salt to use (from vanity address generation)
   * @param expectedAddress The expected address of the deployed contract
   * @returns The deployed contract details
   */
  async deployProxyWithSalt(
    proxyContractName: SupportedNamedProxyContractNames,
    inputSalt: string,
    expectedAddress?: string,
  ): Promise<{
    proxyAddress: string
    deployedSalt: string
    tx: any
    computedAddress: string
    constructorArgs: string[]
  }> {
    logger.log(`CreateXDeployer.deployProxyWithSalt:: Deploying ${proxyContractName} with salt ${inputSalt}`, '🚀')
    // Verify the salt is valid for the current signer
    if (!this.validateSalt(inputSalt)) {
      logger.error(
        `CreateXDeployer.deployProxyWithSalt:: Invalid salt ${inputSalt} for signer ${this.deployer.address}. 
          If using sender protection, first 20 bytes of salt must match deployer address.`,
      )
      throw new Error('CreateXDeployer.deployProxyWithSalt:: Invalid salt for current signer')
    }

    const { bytecode, bytecodeHash, constructorArgs } = await this.getProxyBytecodeWithConstructorArgs(
      proxyContractName,
    )

    // // Calculate the expected CREATE2 address before deployment
    // const initCodeHash = this.calculateInitCodeHash(this.ethers.utils.hexlify(initCode))
    const computedAddress = this.computeCreate2Address(inputSalt, bytecodeHash)
    if (expectedAddress && computedAddress.toLowerCase() !== expectedAddress.toLowerCase()) {
      throw new Error(
        `CreateXDeployer.deployProxyWithSalt:: Address mismatch! Expected ${expectedAddress} but got ${computedAddress}. 
          This indicates the salt was modified by CreateX's guarding mechanism or there's a calculation error.`,
      )
    }
    logger.log(
      `CreateXDeployer.deployProxyWithSalt:: Expected address: ${computedAddress} with salt ${inputSalt}`,
      '📍',
    )

    // Deploy using the specific salt
    const deployTx = await this.createX.connect(this.deployer)['deployCreate2(bytes32,bytes)'](inputSalt, bytecode)
    const receipt = await deployTx.wait()

    // Parse events to get deployed contract address and salt using our helper
    const { contractAddress: proxyAddress, salt: deployedSalt } = this.parseContractCreationEvents(receipt)

    if (!proxyAddress) {
      throw new Error('CreateXDeployer.deployProxyWithSalt:: Could not get contract address from events or receipt')
    }

    // Verify the deployed address matches the pre-computed address
    if (proxyAddress.toLowerCase() !== computedAddress.toLowerCase()) {
      logger.error(
        `CreateXDeployer.deployProxyWithSalt:: Address mismatch! Expected ${computedAddress} but got ${proxyAddress}. 
          This indicates the salt was modified by CreateX's guarding mechanism.`,
      )
    }

    logger.log(`CreateXDeployer.deployProxyWithSalt:: Proxy deployed at address: ${proxyAddress}`, '🚀')
    if (deployedSalt) {
      logger.log(`CreateXDeployer.deployProxyWithSalt:: Salt used by CreateX: ${deployedSalt}`, '🧂')
    } else {
      logger.log(`CreateXDeployer.deployProxyWithSalt:: Salt used by CreateX could not be extracted from events`, '⚠️')
    }

    return {
      proxyAddress,
      deployedSalt: deployedSalt || inputSalt, // Fallback to input salt if we couldn't extract it
      tx: deployTx,
      computedAddress,
      constructorArgs,
    }
  }

  /**
   * Computes the CREATE2 address where a contract will be deployed
   * Takes into account the CreateX factory address
   *
   * @param inputSalt The INPUT salt (what you provide to CreateX)
   * @param initCodeHash The hash of the contract bytecode
   * @returns The computed contract address
   */
  computeCreate2Address(inputSalt: string, initCodeHash: string): string {
    logger.log(`CreateXDeployer.computeCreate2Address:: Input salt: ${inputSalt}`, '🔍')
    logger.log(`CreateXDeployer.computeCreate2Address:: InitCodeHash: ${initCodeHash}`, '🔍')
    logger.log(`CreateXDeployer.computeCreate2Address:: CreateX address: ${this.createX.address}`, '🔍')

    // For compatibility with CreateX contract's _guard function, which may modify the salt
    // If salt has deployer in first 20 bytes or other protections, we need to compute how CreateX will modify it
    const guardedSalt = this.getGuardedSalt(inputSalt)

    const create2Input = this.ethers.utils.solidityPack(
      ['bytes1', 'address', 'bytes32', 'bytes32'],
      ['0xff', this.createX.address, guardedSalt, initCodeHash],
    )

    logger.log(`CreateXDeployer.computeCreate2Address:: Packed data: ${create2Input}`, '🔍')

    const create2Hash = this.ethers.utils.keccak256(create2Input)
    logger.log(`CreateXDeployer.computeCreate2Address:: Hash: ${create2Hash}`, '🔍')

    const address = this.ethers.utils.getAddress('0x' + create2Hash.slice(26))
    logger.log(`CreateXDeployer.computeCreate2Address:: Computed address: ${address}`, '🔍')

    return address
  }

  //------------------------------------------------------------------------------------------------
  // Salt Helper Functions
  //------------------------------------------------------------------------------------------------

  /**
   * Create a salt with the specified protection type based on CreateX.sol's _guard function
   *
   * CreateX.sol uses the first 20 bytes of salt for sender address protection:
   * - If first 20 bytes match msg.sender: only that specific sender can use this salt
   * - If first 20 bytes are all 0x00: any sender can use this salt
   *
   * The 21st byte (index 20) is used for cross-chain protection:
   * - If 0x01: ENABLES cross-chain protection, which PREVENTS deployment on multiple chains
   * - If 0x00: DISABLES cross-chain protection, which ALLOWS deployment on multiple chains
   */
  createSalt(type: SaltType, randomValue: string | number, deployer?: string): string {
    const entropy = typeof randomValue === 'number' ? this.getBytes32SaltFromNumber(randomValue) : randomValue

    const senderAddr = deployer || this.deployer.address || '0x0000000000000000000000000000000000000000'

    // Format the salt based on protection type
    let result: Uint8Array
    switch (type) {
      case SaltType.NORMAL:
        // No special protection, just return the entropy
        return entropy

      case SaltType.CROSS_CHAIN_PROTECTED:
        // Zero address + 0x01 flag + entropy
        result = new Uint8Array(32)
        // First 20 bytes = zero address
        result.set(this.ethers.utils.arrayify('0x0000000000000000000000000000000000000000'), 0)
        // 21st byte (index 20) = 0x01 (cross-chain protection flag)
        result.set([0x01], 20)
        // Last 11 bytes = entropy
        result.set(this.ethers.utils.arrayify(entropy).slice(-11), 21)
        break

      case SaltType.SENDER_PROTECTED:
        // Sender address + 0x00 flag + entropy
        result = new Uint8Array(32)
        // First 20 bytes = sender address
        result.set(this.ethers.utils.arrayify(senderAddr), 0)
        // 21st byte (index 20) = 0x00 (no cross-chain protection)
        result.set([0x00], 20)
        // Last 11 bytes = entropy
        result.set(this.ethers.utils.arrayify(entropy).slice(-11), 21)
        break

      case SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED:
        // Sender address + 0x01 flag + entropy
        result = new Uint8Array(32)
        // First 20 bytes = sender address
        result.set(this.ethers.utils.arrayify(senderAddr), 0)
        // 21st byte (index 20) = 0x01 (cross-chain protection enabled)
        result.set([0x01], 20)
        // Last 11 bytes = entropy
        result.set(this.ethers.utils.arrayify(entropy).slice(-11), 21)
        break
    }

    return this.ethers.utils.hexlify(result)
  }

  /**
   * Get the protection type of a salt based on CreateX.sol's _parseSalt function
   */
  getSaltType(inputSalt: string): SaltType {
    const bytes = this.ethers.utils.arrayify(inputSalt)
    if (bytes.length !== 32) return SaltType.NORMAL

    const addrBytes = bytes.slice(0, 20)
    const flag = bytes[20]

    const isZeroAddr = addrBytes.every((b) => b === 0)
    const hasCrossChainProtection = flag === 0x01

    if (isZeroAddr && hasCrossChainProtection) return SaltType.CROSS_CHAIN_PROTECTED
    if (isZeroAddr) return SaltType.NORMAL
    if (hasCrossChainProtection) return SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED
    logger.log(`CreateXDeployer.getSaltType:: Salt type: SaltType.SENDER_PROTECTED ${SaltType.SENDER_PROTECTED}`, '🔍')
    return SaltType.SENDER_PROTECTED
  }

  /**
   * Applies the same salt guarding logic as the CreateX contract's _guard function
   * This is crucial for pre-computing the correct CREATE2 address
   *
   * This transforms the INPUT salt into the GUARDED salt that's actually used for address calculation.
   * The exact transformation depends on the protection type embedded in the salt.
   *
   * @param inputSalt The INPUT salt (what you provide to CreateX)
   * @returns The GUARDED salt (what CreateX actually uses for address calculation)
   */
  getGuardedSalt(inputSalt: string): string {
    const saltType = this.getSaltType(inputSalt)
    const deployer = this.deployer.address

    logger.log(`CreateXDeployer.getSaltType:: Salt type: ${saltType} ${SaltType[saltType]}`, '🔍')
    logger.log(`CreateXDeployer.getGuardedSalt:: Input salt: ${inputSalt}`, '🔍')
    logger.log(`CreateXDeployer.getGuardedSalt:: Deployer: ${deployer}`, '🔍')

    // Hardhat's default chainId is 31337
    let chainId = 31337
    try {
      // If we're running in a real network, use the actual chainId
      chainId = this.ethers.provider.network.chainId
    } catch (e) {}

    logger.log(`CreateXDeployer.getGuardedSalt:: ChainId: ${chainId}`, '🔍')

    // Apply the same logic as CreateX._guard function
    let guardedSalt: string

    switch (saltType) {
      case SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED:
        // CreateX uses: keccak256(abi.encode(msg.sender, block.chainid, salt))
        guardedSalt = this.ethers.utils.keccak256(
          this.ethers.utils.defaultAbiCoder.encode(['address', 'uint256', 'bytes32'], [deployer, chainId, inputSalt]),
        )
        logger.log(
          `CreateXDeployer.getGuardedSalt:: SENDER_AND_CROSS_CHAIN_PROTECTED encoded: ${this.ethers.utils.defaultAbiCoder.encode(
            ['address', 'uint256', 'bytes32'],
            [deployer, chainId, inputSalt],
          )}`,
          '🔍',
        )
        break

      case SaltType.SENDER_PROTECTED:
        // But if the first 20 bytes of salt are already the sender address, we need to handle differently
        // The contract uses _efficientHash({a: bytes32(uint256(uint160(msg.sender))), b: salt})
        // which packs the address as bytes32 (padded with zeros) and then the salt

        // Convert deployer address to bytes32 (padded with zeros to the left)
        const paddedDeployer = this.ethers.utils.hexZeroPad(deployer, 32)

        // Create the packed data as would be done in _efficientHash
        // This mimics the concatenation of two bytes32 values in memory
        const packedData = paddedDeployer.slice(2) + inputSalt.slice(2) // Remove '0x' from both strings

        guardedSalt = this.ethers.utils.keccak256('0x' + packedData)
        logger.log(`CreateXDeployer.getGuardedSalt:: SENDER_PROTECTED paddedDeployer: ${paddedDeployer}`, '🔍')
        logger.log(`CreateXDeployer.getGuardedSalt:: SENDER_PROTECTED packedData: 0x${packedData}`, '🔍')
        break

      case SaltType.CROSS_CHAIN_PROTECTED:
        // CreateX uses: keccak256(abi.encodePacked(block.chainid, salt))
        guardedSalt = this.ethers.utils.keccak256(
          this.ethers.utils.solidityPack(['uint256', 'bytes32'], [chainId, inputSalt]),
        )
        logger.log(
          `CreateXDeployer.getGuardedSalt:: CROSS_CHAIN_PROTECTED packed: ${this.ethers.utils.solidityPack(
            ['uint256', 'bytes32'],
            [chainId, inputSalt],
          )}`,
          '🔍',
        )
        break

      default:
        // For random salts, CreateX hashes the salt to prevent bypassing protections
        // For generated salts (_generateSalt), it returns the salt unchanged
        // We'll assume this is a user-provided salt and hash it
        guardedSalt = this.ethers.utils.keccak256(this.ethers.utils.defaultAbiCoder.encode(['bytes32'], [inputSalt]))
        logger.log(
          `CreateXDeployer.getGuardedSalt:: DEFAULT encoded: ${this.ethers.utils.defaultAbiCoder.encode(
            ['bytes32'],
            [inputSalt],
          )}`,
          '🔍',
        )
        break
    }

    logger.log(`CreateXDeployer.getGuardedSalt:: Guarded salt: ${guardedSalt}`, '🔍')
    return guardedSalt
  }

  /**
   * Check if a salt is valid for the current signer
   *
   * This verifies that if the salt has sender protection, the first 20 bytes
   * match the deployer address.
   *
   * @param inputSalt The INPUT salt to validate
   * @returns Whether the salt is valid for the current signer
   */
  validateSalt(inputSalt: string): boolean {
    const type = this.getSaltType(inputSalt)
    if (type !== SaltType.SENDER_PROTECTED && type !== SaltType.SENDER_AND_CROSS_CHAIN_PROTECTED) {
      return true // Salt doesn't require sender validation
    }

    if (!this.deployer) {
      return false // Salt requires a signer but none is set
    }

    const embeddedAddr = '0x' + Buffer.from(this.ethers.utils.arrayify(inputSalt).slice(0, 20)).toString('hex')
    return embeddedAddr.toLowerCase() === this.deployer.address.toLowerCase()
  }

  /**
   * Parse transaction events and extract contract creation information
   *
   * This function attempts to extract the newly deployed contract address and
   * the salt used for deployment from transaction events. It handles multiple event
   * formats and provides fallback mechanisms when parsing fails.
   *
   * @param receipt The transaction receipt containing events
   * @returns Object with the contract address and salt (if found)
   */
  parseContractCreationEvents(receipt: ContractReceipt): { contractAddress: string | null; salt: string | null } {
    let contractAddress: string | null = null
    let salt: string | null = null

    // Try to find contract creation events
    for (const event of receipt.events || []) {
      try {
        // First try using the contract's interface to parse the event
        const parsedEvent = this.createX.interface.parseLog(event)
        if (parsedEvent.name === 'ContractCreation') {
          contractAddress = parsedEvent.args.newContract
          // Salt might be undefined if using the event signature without salt
          if (parsedEvent.args.salt) {
            salt = parsedEvent.args.salt
          }
          // If we found both address and salt, we can stop searching
          if (contractAddress && salt) break
        }
      } catch (e) {
        const errorMessage = getErrorMessage(e)
        // If the interface parsing fails, try to extract data directly from event topics
        logger.log(`CreateXDeployer.parseContractCreationEvents:: Event parsing error: ${errorMessage}`, '🔍')

        // Check if this could be a contract creation event based on the topics
        if (event.topics && event.topics.length >= 2) {
          try {
            // Extract the address from the second topic (it's padded to 32 bytes)
            const addressHex = '0x' + event.topics[1].slice(26).toLowerCase()
            if (ethers.utils.isAddress(addressHex)) {
              logger.log(
                `CreateXDeployer.parseContractCreationEvents:: Extracted address from event topic: ${addressHex}`,
                '🔍',
              )
              contractAddress = addressHex

              // If there's a third topic, it might be the salt
              if (event.topics.length >= 3) {
                salt = event.topics[2]
                logger.log(
                  `CreateXDeployer.parseContractCreationEvents:: Extracted salt from event topic: ${salt}`,
                  '🔍',
                )
              }

              // If we found both address and salt, we can stop searching
              if (contractAddress && salt) break
            }
          } catch (topicError) {
            const errorMessage = getErrorMessage(topicError)
            logger.log(
              `CreateXDeployer.parseContractCreationEvents:: Error extracting data from event topic: ${errorMessage}`,
              '🔍',
            )
          }
        }
      }
    }

    // If we still couldn't find the address, check for contractAddress in the receipt
    if (!contractAddress && receipt.contractAddress) {
      logger.log(
        `CreateXDeployer.parseContractCreationEvents:: Using contractAddress from receipt: ${receipt.contractAddress}`,
        '🔍',
      )
      contractAddress = receipt.contractAddress
    }

    return { contractAddress, salt }
  }
}
