import { BigNumber, utils } from 'ethers'
import { Networks, convertToExplorerUrlForNetwork, getTxExplorerUrlForNetwork } from '../../../hardhat.config'
import { unlockSigner } from '../fork-testing/accountHelper'
import { setupFork } from '../fork-testing/forkHelper'
import { EventHandler } from './EventHandler'
import { MultiSendHandler } from './MultiSendHandler'
import { OnChainSimulationConfig, SimulationResult, FormattedReceipt, FormattedLog } from './simulation-types'
import fs from 'fs'
import path from 'path'
import { logger } from '../../node/logger'
import { Log, TransactionReceipt } from '@ethersproject/providers'

export class OnChainSimulator {
  private network: Networks
  private eventHandler: EventHandler
  private multiSendHandler: MultiSendHandler
  private outputDir: string

  constructor(network: Networks) {
    this.network = network
    this.eventHandler = new EventHandler()
    this.multiSendHandler = new MultiSendHandler(network, this.eventHandler)
    this.outputDir = path.join(__dirname, 'simulation-results')
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  private formatBigNumber(bn: BigNumber): string {
    return utils.formatUnits(bn, 'gwei')
  }

  private formatTransactionReceipt(receipt: TransactionReceipt): FormattedReceipt {
    const formattedReceipt: FormattedReceipt = {
      status: receipt.status === 1 ? 'Success' : 'Failed',
      from: receipt.from,
      to: receipt.to,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: `${this.formatBigNumber(receipt.gasUsed)} gwei`,
      effectiveGasPrice: `${this.formatBigNumber(receipt.effectiveGasPrice)} gwei`,
      logs: receipt.logs.map((log: Log): FormattedLog => {
        try {
          return {
            address: log.address,
            contractUrl: convertToExplorerUrlForNetwork(this.network, log.address),
            topics: log.topics,
            data: log.data,
            decodedEvent: this.eventHandler.decodeLog(log),
          }
        } catch (error) {
          logger.error(`Error formatting log: ${error}`)
          return {
            ...log,
            contractUrl: convertToExplorerUrlForNetwork(this.network, log.address),
            decodedEvent: null,
          }
        }
      }),
      explorerUrl: getTxExplorerUrlForNetwork(this.network, receipt.transactionHash),
    }

    return formattedReceipt
  }

  private saveOutput(results: SimulationResult[]) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = path.join(this.outputDir, `simulation-${timestamp}.json`)

    fs.writeFileSync(filename, JSON.stringify(results, null, 2))

    logger.log(`Simulation results saved to ${filename}`, '💾')
  }

  async simulate(config: OnChainSimulationConfig): Promise<SimulationResult[]> {
    logger.log(`Simulating on-chain transactions on network ${config.network}`, '🚀')
    await setupFork(config.network)
    logger.log(`Forked to network ${config.network}`, '🍴')

    const results = await Promise.all(
      config.transactions.map(async (transaction): Promise<SimulationResult> => {
        try {
          // Unlock signer
          if (!transaction.from) throw new Error('Transaction must have a from address')
          const fromSigner = await unlockSigner(transaction.from)

          // Check if this is a MultiSendCallOnly transaction
          if (this.multiSendHandler.isMultiSendTransaction(transaction)) {
            // Delegate to the MultiSendHandler
            return await this.multiSendHandler.handleMultiSendTransaction(transaction, fromSigner)
          }

          // For non-MultiSendCallOnly transactions, use the original approach
          const tx = await fromSigner.sendTransaction(transaction)
          logger.log(`Transaction hash: ${tx.hash}`, '🚀')
          const txReceipt = await tx.wait()

          return {
            receipt: this.formatTransactionReceipt(txReceipt),
            timestamp: new Date().toISOString(),
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error(`Transaction failed: ${errorMessage}`)

          // Return a failed result
          return {
            receipt: {
              status: 'Failed',
              from: transaction.from,
              to: transaction.to,
              transactionHash: 'failed',
              blockNumber: 0,
              gasUsed: '0',
              effectiveGasPrice: '0',
              logs: [],
              explorerUrl: getTxExplorerUrlForNetwork(this.network, 'failed'),
            },
            timestamp: new Date().toISOString(),
          }
        }
      }),
    )

    // Log results
    logger.log('Transaction Details:', '📝')
    console.dir(results, { depth: null })

    // Save results
    this.saveOutput(results)

    return results
  }
}
