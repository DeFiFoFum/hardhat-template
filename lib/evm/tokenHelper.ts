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

export type TokenDetails = {
  decimals: number
  symbol: string
  name: string
  totalSupply: string
}

/**
 * Creates a closure to cache the token detail values for token addresses. This
 * function returns an async function that takes a token address and returns
 * the number of decimals for the token. It caches the result to avoid
 * unnecessary calls to the blockchain.
 * @returns {Function} A function that takes a token address and returns a Promise<number> of the token's decimals.
 */
export const getDetailsForTokenAddress = (() => {
  // Cache object to store decimals for token addresses
  const tokenDetailsCache: { [address: string]: TokenDetails } = {}

  /**
   * Given a token address, returns the number of decimals for that token.
   * Caches the value to prevent redundant calls.
   * @param {string} tokenAddress - The address of the token contract.
   * @returns {Promise<number>} A promise that resolves to the number of decimals of the token.
   */
  return async (tokenAddress: string): Promise<TokenDetails> => {
    // Return cached decimals if available
    if (tokenDetailsCache[tokenAddress]) {
      return tokenDetailsCache[tokenAddress]
    }

    try {
      // Create a new contract instance to interact with the token's contract
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          // Minimal ERC-20 Decimals ABI
          'function decimals() view returns (uint8)',
          'function symbol() view returns (string)',
          'function name() view returns (string)',
          'function totalSupply() view returns (uint256)',
        ],
        ethers.provider
      )

      // Call the decimals function of the token contract
      const [decimals, symbol, name, totalSupply] = await Promise.all([
        tokenContract.decimals(),
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.totalSupply(),
      ])

      // Cache the result
      tokenDetailsCache[tokenAddress] = decimals

      return { decimals, symbol, name, totalSupply }
    } catch (error) {
      // Log the error and return a default value of 18 decimals
      logger.warn(`${getDetailsForTokenAddress.name}:: Error pulling token details: ${getErrorMessage(error)}`)
      return { decimals: 18, symbol: 'N/A', name: 'N/A', totalSupply: 'N/A' }
    }
  }
})()
