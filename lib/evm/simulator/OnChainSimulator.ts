import { BigNumber, utils } from 'ethers'
import { Networks, convertToExplorerUrlForNetwork, getTxExplorerUrlForNetwork } from '../../../hardhat.config'
import { unlockSigner } from '../fork-testing/accountHelper'
import { setupFork } from '../fork-testing/forkHelper'
import { EventDecoder } from './EventDecoder'
import { SimulationConfig, SimulationResult, FormattedReceipt, FormattedLog } from './simulation-types'
import fs from 'fs'
import path from 'path'
import { logger } from '../../node/logger'

export class OnChainSimulator {
  private network: Networks
  private eventDecoder: EventDecoder
  private outputDir: string

  constructor(network: Networks) {
    this.network = network
    this.eventDecoder = new EventDecoder()
    this.outputDir = path.join(__dirname, 'simulation-results')
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  private formatBigNumber(bn: BigNumber): string {
    return utils.formatUnits(bn, 'gwei')
  }

  private formatTransactionReceipt(receipt: any): FormattedReceipt {
    const formattedReceipt: FormattedReceipt = {
      status: receipt.status === 1 ? 'Success' : 'Failed',
      from: receipt.from,
      to: receipt.to,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: `${this.formatBigNumber(receipt.gasUsed)} gwei`,
      effectiveGasPrice: `${this.formatBigNumber(receipt.effectiveGasPrice)} gwei`,
      logs: receipt.logs.map((log: any): FormattedLog => {
        try {
          return {
            address: log.address,
            contractUrl: convertToExplorerUrlForNetwork(this.network, log.address),
            topics: log.topics,
            data: log.data,
            decodedEvent: this.eventDecoder.decodeLog(log),
          }
        } catch (error) {
          logger.error(`Error formatting log: ${error}`)
          return log
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

  async simulate(config: SimulationConfig): Promise<SimulationResult[]> {
    logger.log(`Simulating on-chain transactions on network ${config.network}`, '🚀')
    await setupFork(config.network)
    logger.log(`Forked to network ${config.network}`, '🍴')

    const results = await Promise.all(
      config.transactions.map(async (transaction): Promise<SimulationResult> => {
        // Unlock signer
        if (!transaction.from) throw new Error('Transaction must have a from address')
        const fromSigner = await unlockSigner(transaction.from)

        // Send tx
        const tx = await fromSigner.sendTransaction(transaction)
        logger.log(`Transaction hash: ${tx.hash}`, '🚀')
        const txReceipt = await tx.wait()

        return {
          receipt: this.formatTransactionReceipt(txReceipt),
          timestamp: new Date().toISOString(),
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
