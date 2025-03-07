import { ethers, network } from 'hardhat'
import { Networks } from '../../hardhat'
import { logger } from '../../hardhat/utils'
import { setupFork } from './fork-testing/forkHelper'
import { getErrorMessage } from '../../lib/node/getErrorMessage'
import { Contract } from 'ethers'
import { DeployableNetworks } from '../../scripts/deploy/deploy.config'
import { forkIfHardhat } from '../../scripts/deploy/utils/forkDeployHelper'

type TimeSeriesBlockOptions = {
  forkNetwork: DeployableNetworks
  fromBlock: number
  toBlock: number | 'latest'
  blockInterval?: number
}

interface ContractFunctionCallOptions<C extends Contract, MethodName extends keyof C> {
  contract: C
  functionName: MethodName
  params: Parameters<C[MethodName]>
}

type TimeSeriesData<C extends Contract, MethodName extends keyof C> = Record<number, ReturnType<C[MethodName]>>

export async function getTimeSeriesData<C extends Contract, MethodName extends keyof C>(
  { forkNetwork, fromBlock, toBlock, blockInterval = 1 }: TimeSeriesBlockOptions,
  { contract, functionName, params }: ContractFunctionCallOptions<C, MethodName>,
): Promise<TimeSeriesData<C, MethodName>> {
  const currentNetwork = network.name as Networks
  if (currentNetwork !== 'hardhat') {
    throw new Error('This script must be ran on the hardhat network to allow for forking.')
  }
  const endBlock = toBlock === 'latest' ? await setupFork(forkNetwork, undefined) : toBlock
  logger.log(
    `Getting time series data from block ${fromBlock} to block ${toBlock} (${endBlock}) on network ${currentNetwork}`,
    '📊',
  )
  logger.warn(
    `For this to work, you MUST be connected to an Archive node. Some RPC urls on ChainList work, and some don't.`,
  )

  let timeSeriesOutput: TimeSeriesData<C, MethodName> = {}

  //   TODO: Promises don't seem to work when forking a network
  //   const promises: Promise<boolean>[] = []
  //   for (let currentBlockNumber = fromBlock; currentBlockNumber <= endBlock; currentBlockNumber += blockInterval) {
  //     const currentPromise = new Promise<boolean>(async (resolve, reject) => {
  //       try {
  //         await setupFork(currentNetwork, currentBlockNumber)
  //         const contractReturn = (await contract[functionName](...params)) as ReturnType<C[MethodName]>
  //         timeSeriesOutput = { ...timeSeriesOutput, [currentBlockNumber]: contractReturn }
  //         resolve(true)
  //       } catch (e) {
  //         logger.error(`Error obtaining data at block ${currentBlockNumber}`)
  //         logger.error(getErrorMessage(e))
  //         resolve(false)
  //       }
  //     })
  //     promises.push(currentPromise)
  //   }
  //   await Promise.all(promises)

  for (let currentBlockNumber = fromBlock; currentBlockNumber <= endBlock; currentBlockNumber += blockInterval) {
    try {
      await forkIfHardhat(currentNetwork, forkNetwork, currentBlockNumber)
      const contractReturn = (await contract[functionName](...params)) as ReturnType<C[MethodName]>
      timeSeriesOutput[currentBlockNumber] = contractReturn
    } catch (e) {
      logger.error(`Error obtaining data at block ${currentBlockNumber}`)
      logger.error(getErrorMessage(e))
    }
  }

  // Pull the latest block data after the loop
  try {
    await forkIfHardhat(currentNetwork, forkNetwork, endBlock)
    const contractReturn = (await contract[functionName](...params)) as ReturnType<C[MethodName]>
    timeSeriesOutput[endBlock] = contractReturn
  } catch (e) {
    logger.error(`Error obtaining data at the latest block ${endBlock}`)
    logger.error(getErrorMessage(e))
  }

  // Sort the block numbers to be in ascending order
  let sortedTimeSeriesOutput: TimeSeriesData<C, MethodName> = {}
  const sortedKeys = Object.keys(timeSeriesOutput)
    .map(Number)
    .sort((a, b) => a - b)

  for (const key of sortedKeys) {
    sortedTimeSeriesOutput[key] = timeSeriesOutput[key]
  }

  return sortedTimeSeriesOutput
}
