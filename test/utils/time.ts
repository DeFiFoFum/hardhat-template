import { ethers } from 'hardhat'

/**
 * Increase the block height by mining blocks
 * @param numBlocks Number of blocks to mine
 */
export async function mineBlocks(numBlocks: number) {
  for (let index = 0; index < numBlocks; index++) {
    await ethers.provider.send('evm_mine', [])
  }
}

/**
 * Increase the chain timestamp by a number of seconds
 * @param seconds Number of seconds to increase
 */
export async function increaseTime(seconds: number) {
  await ethers.provider.send('evm_increaseTime', [seconds])
  await mineBlocks(1)
}
