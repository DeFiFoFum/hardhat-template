import { ethers } from 'hardhat'
import { logger } from '../../hardhat/utils'

/**
 * Calculates the average block time based on the number of blocks apart.
 * @param blocksApart The number of blocks to consider for the average time calculation.
 * @returns The average time in seconds between the blocks.
 */
export async function calculateAverageBlockTime(blocksApart = 10000): Promise<number> {
  const provider = ethers.provider

  // Get the latest block number
  const latestBlockNumber = await provider.getBlockNumber()
  const latestBlock = await provider.getBlock(latestBlockNumber)

  // Make sure we don't underflow if the latest block number is less than `blocksApart`
  const earlierBlockNumber = Math.max(latestBlockNumber - blocksApart, 0)
  const earlierBlock = await provider.getBlock(earlierBlockNumber)

  // Calculate the time difference and the number of blocks
  const timeDiff = latestBlock.timestamp - earlierBlock.timestamp
  const blockDiff = latestBlockNumber - earlierBlockNumber

  // Calculate the average block time
  // Avoid division by zero in the case of looking up the genesis block
  return blockDiff > 0 ? timeDiff / blockDiff : 0
}

/**
 * Finds the block number that is closest to the given target date.
 * @param targetDate The target date for which to find the closest block number.
 * @param averageBlockTime The average time in seconds between blocks.
 * @returns The block number that is closest to the target date.
 */
async function findClosestBlockNumber(targetDate: string, averageBlockTime?: number): Promise<number> {
  if (!averageBlockTime) {
    averageBlockTime = await calculateAverageBlockTime()
  }

  const provider = ethers.provider
  const targetTimestamp = Math.floor(new Date(targetDate).getTime() / 1000)

  // Get the latest block number and its timestamp
  const latestBlockNumber = await provider.getBlockNumber()
  const latestBlock = await provider.getBlock(latestBlockNumber)
  const latestTimestamp = latestBlock.timestamp

  // Calculate the estimated block number using the average block time
  let estimatedBlockNumber = latestBlockNumber + Math.ceil((targetTimestamp - latestTimestamp) / averageBlockTime)

  // Define the range for the binary search based on the estimated block number
  let minBlockNumber = Math.max(0, estimatedBlockNumber - 1000)
  let maxBlockNumber = estimatedBlockNumber + 1000

  // Binary search to find the closest block number to the target timestamp
  while (minBlockNumber <= maxBlockNumber) {
    const midBlockNumber = Math.floor((minBlockNumber + maxBlockNumber) / 2)
    const midBlock = await provider.getBlock(midBlockNumber)
    if (!midBlock) {
      logger.warn(`Block ${midBlockNumber} not found`)
      return minBlockNumber
    }
    const midTimestamp = midBlock.timestamp

    if (midTimestamp < targetTimestamp) {
      minBlockNumber = midBlockNumber + 1
    } else if (midTimestamp > targetTimestamp) {
      maxBlockNumber = midBlockNumber - 1
    } else {
      // Block timestamp matches target timestamp (unlikely, but possible)
      return midBlockNumber
    }
  }

  // The closest block is either minBlockNumber or maxBlockNumber, whichever has the timestamp closest to the target
  const minBlockTimestamp = (await provider.getBlock(minBlockNumber)).timestamp
  const maxBlockTimestamp = (await provider.getBlock(maxBlockNumber)).timestamp

  return Math.abs(targetTimestamp - minBlockTimestamp) <= Math.abs(targetTimestamp - maxBlockTimestamp)
    ? minBlockNumber
    : maxBlockNumber
}

export async function findStartBlockNumbersForYear(
  year: 2022 | 2023 | 2024,
  averageBlockTime?: number,
): Promise<{ [key: number]: number }> {
  const startBlocks: { [key: number]: number } = {}
  const currentYear = new Date().getUTCFullYear()
  const currentMonth = new Date().getUTCMonth() // getUTCMonth() returns 0-11

  for (let month = 1; month <= 13; month++) {
    // Include January of the next year as the 13th entry
    const targetMonth = month <= 12 ? month - 1 : 0 // For month 13, set to January (0) of the next year
    const targetYear = month <= 12 ? year : year + 1

    // If we are looking up a future year or a future month in the current year, assign null
    if (targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth)) {
      continue
    }

    // Construct the target date for the first day of each month
    const targetDate = new Date(Date.UTC(targetYear, targetMonth, 1)).toISOString()

    // Find the estimated block number for the first day of the month
    const blockNumber = await findClosestBlockNumber(targetDate, averageBlockTime)

    startBlocks[month] = blockNumber
  }

  return startBlocks
}

/*
// example:
async function main() {
  // First, calculate the average block time using a known range of blocks
  const averageBlockTime = await calculateAverageBlockTime() // Replace with your implementation

  // Find the closest block number to a target date using the average block time
  //   const targetDate = '2023-01-31T23:59:59Z'
  //   const blockNumber = await findClosestBlockNumber(targetDate, averageBlockTime)
  //   console.log(`Closest block number to ${targetDate}: ${blockNumber}`)

  const year = 2024
  const blockNumbers = await findStartBlockNumbersForYear(year, averageBlockTime)
  console.dir({ blockNumbers })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
*/
