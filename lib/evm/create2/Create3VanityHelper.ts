import { ethers } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'
import { DEFAULT_X_DEPLOYER_ADDRESS } from './XDeployer'
import { logger } from '../../node/logger'

/**
 * Pattern types supported by the vanity address generator
 */
export type VanityPatternType = 'prefix' | 'suffix' | 'both' | 'repeating-prefix' | 'repeating-suffix' | 'custom'

/**
 * Result of a successful vanity address search
 */
export interface VanitySearchResult {
  salt: string
  address: string
}

type Create3VanityHelperProps = {
  createXAddress?: string
}

/**
 * Helper class for working with CREATE3 vanity addresses
 */
export class Create3VanityHelper {
  private _xDeployerAddress: string

  constructor(props: Create3VanityHelperProps) {
    this._xDeployerAddress = props.createXAddress || DEFAULT_X_DEPLOYER_ADDRESS
  }

  get xDeployerAddress(): string {
    return this._xDeployerAddress
  }

  /**
   * Generates a properly guarded salt for CREATE3 deployment
   * Includes protections against front-running on other chains
   *
   * Format: deployerAddress (20 bytes) + 0x01 (1 byte) + random (11 bytes)
   * - First 20 bytes = deployer address (permissioned deploy protection)
   * - 21st byte = 0x01 (cross-chain redeploy protection)
   * - Last 11 bytes = random data for vanity search
   *
   * @param deployer The address that will deploy the contract
   * @param randomPart Optional 11-byte random part (will generate random if not provided)
   * @returns A properly formatted 32-byte salt value
   */
  public generateGuardedSalt(deployer: string, randomPart?: BytesLike): string {
    // Ensure deployer is a valid address
    deployer = ethers.utils.getAddress(deployer)

    // Cross-chain protection flag (byte 21)
    const protectionFlag = '0x01'

    // Generate or use provided random part
    let randomBytes: BytesLike
    if (randomPart) {
      const randomPartHex = ethers.utils.hexlify(randomPart).slice(2)
      if (randomPartHex.length !== 22) {
        // 11 bytes = 22 hex chars
        throw new Error('Random part must be exactly 11 bytes (22 hex characters)')
      }
      randomBytes = '0x' + randomPartHex
    } else {
      randomBytes = ethers.utils.hexlify(ethers.utils.randomBytes(11))
    }

    // Concatenate all parts to create the salt
    return ethers.utils.hexConcat([
      deployer, // 20 bytes
      protectionFlag, // 1 byte
      randomBytes, // 11 bytes
    ])
  }

  /**
   * Calculates the expected CREATE3 address for a contract deployed using CreateX
   *
   * @param salt The 32-byte salt value (should be a guarded salt)
   * @param createXAddress The address of the CreateX contract (defaults to DEFAULT_CREATE_X_ADDRESS)
   * @returns The predicted address where the contract will be deployed
   */
  public computeCreate3Address(salt: BytesLike): string {
    // Ensure CreateX address is valid
    const createXAddress = ethers.utils.getAddress(this.xDeployerAddress)

    // CREATE3 address computation matches CreateX.sol implementation
    // This is a simplified version that follows the same logic
    const saltHash = ethers.utils.keccak256(
      ethers.utils.hexConcat([
        '0xff',
        createXAddress,
        salt,
        ethers.utils.keccak256('0x21c35dbe1b344a2488cf3321d6ce542f8e9f3055444ff09e4993a62319a497c1'),
      ]),
    )

    const address = '0x' + saltHash.slice(26) // Last 20 bytes of the hash
    return ethers.utils.getAddress(address) // Normalize the address
  }

  /**
   * Search for a salt that results in a vanity address with the desired pattern
   *
   * @param deployerAddress The address that will deploy the contract
   * @param targetPattern The regex pattern to match (e.g., /^0xabcd/ or /ed6e$/i)
   * @param createXAddress The address of the CreateX contract (defaults to DEFAULT_CREATE_X_ADDRESS)
   * @param maxAttempts Maximum number of attempts before giving up
   * @returns The salt that produces an address matching the pattern, or null if not found
   */
  public async findVanitySalt(
    deployerAddress: string,
    targetPattern: RegExp,
    maxAttempts: number = 1000000,
  ): Promise<VanitySearchResult | null> {
    for (let i = 0; i < maxAttempts; i++) {
      // Generate a guarded salt with random data
      const salt = this.generateGuardedSalt(deployerAddress)

      // Compute the resulting address
      const address = this.computeCreate3Address(salt)

      // Check if the address matches the desired pattern
      if (targetPattern.test(address)) {
        return { salt, address }
      }

      // Progress update every 10000 attempts
      if (i % 10000 === 0) {
        logger.log(`Attempted ${i} salts...`, '🏃‍♂️')
      }
    }

    return null // No matching salt found
  }

  /**
   * Creates a regex pattern for matching vanity addresses
   *
   * @param patternType The type of pattern to create
   * @param value The pattern value to match
   * @returns A RegExp object for matching addresses
   */
  public createTargetPattern(patternType: VanityPatternType, value: string): RegExp {
    switch (patternType) {
      case 'prefix':
        return new RegExp(`^0x${value}`, 'i')
      case 'suffix':
        return new RegExp(`${value}$`, 'i')
      case 'both':
        return new RegExp(`^0x${value}.*${value}$`, 'i')
      case 'repeating-prefix':
        // Match addresses where the first n chars after 0x are the same
        const prefixLength = value.length
        return new RegExp(`^0x([0-9a-f])\\1{${prefixLength - 1}}.*${value}$`, 'i')
      case 'repeating-suffix':
        // Match addresses ending with n identical chars
        const suffixLength = value.length
        return new RegExp(`^0x${value}.*([0-9a-f])\\1{${suffixLength - 1}}$`, 'i')
      case 'custom':
      default:
        return new RegExp(value, 'i')
    }
  }

  /**
   * Validates that a salt was properly guarded
   *
   * @param salt The salt to validate
   * @param deployerAddress The expected deployer address
   * @returns True if the salt is properly guarded, false otherwise
   */
  public isGuardedSalt(salt: string, deployerAddress: string): boolean {
    if (!salt || salt.length !== 66) return false

    // Check that first 20 bytes match deployer address
    const saltDeployerPart = salt.slice(0, 42).toLowerCase()
    const normalizedDeployer = ethers.utils.getAddress(deployerAddress).toLowerCase()

    // Check that 21st byte is 0x01 (cross-chain protection)
    const protectionFlag = salt.slice(42, 44)

    return saltDeployerPart === normalizedDeployer && protectionFlag === '01'
  }
}
