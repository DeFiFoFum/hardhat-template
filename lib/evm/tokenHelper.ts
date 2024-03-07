import { ethers } from 'hardhat'
import { getErrorMessage } from '../node/getErrorMessage'
import { logger } from '../../hardhat/utils'

/**
 * Creates a closure to cache the decimals values for token addresses. This
 * function returns an async function that takes a token address and returns
 * the number of decimals for the token. It caches the result to avoid
 * unnecessary calls to the blockchain.
 * @returns {Function} A function that takes a token address and returns a Promise<number> of the token's decimals.
 */
export const getDecimalsForTokenAddress = (() => {
  // Cache object to store decimals for token addresses
  const tokenDecimalsCache: { [address: string]: number } = {}

  /**
   * Given a token address, returns the number of decimals for that token.
   * Caches the value to prevent redundant calls.
   * @param {string} tokenAddress - The address of the token contract.
   * @returns {Promise<number>} A promise that resolves to the number of decimals of the token.
   */
  return async (tokenAddress: string): Promise<number> => {
    // Return cached decimals if available
    if (tokenDecimalsCache[tokenAddress]) {
      return tokenDecimalsCache[tokenAddress]
    }

    try {
      // Create a new contract instance to interact with the token's contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          // Minimal ERC-20 Decimals ABI
          'function decimals() view returns (uint8)',
        ],
        ethers.provider
      )

      // Call the decimals function of the token contract
      const decimals = await tokenContract.decimals()

      // Cache the result
      tokenDecimalsCache[tokenAddress] = decimals

      return decimals
    } catch (error) {
      // Log the error and return a default value of 18 decimals
      logger.warn(`getDecimalsForToken:: Error pulling token decimals: ${getErrorMessage(error)}`)
      return 18
    }
  }
})()
