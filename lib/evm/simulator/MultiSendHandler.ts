import { BigNumber, utils } from 'ethers'
import { convertToExplorerUrlForNetwork, getTxExplorerUrlForNetwork, Networks } from '../../../hardhat.config'
import { logger } from '../../node/logger'
import { EventHandler } from '../transactions/EventHandler'
import { SimulationResult, FormattedLog } from './simulation-types'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'

/**
 * Class to handle MultiSendCallOnly transactions
 *
 * MultiSendCallOnly Contract Overview:
 * ------------------------------------
 * The MultiSendCallOnly contract allows batching multiple transactions into a single transaction.
 * It's commonly used in Gnosis Safe and other multi-signature wallets to execute multiple actions
 * in a single transaction, improving gas efficiency and atomicity.
 *
 * Function Signature:
 * function multiSend(bytes memory transactions) public payable
 *
 * Data Encoding Format:
 * ---------------------
 * 1. Function Selector: 0x8d80ff0a (multiSend(bytes))
 *
 * 2. ABI-Encoded Parameters:
 *    - 32 bytes: Offset to the start of the bytes parameter (usually 0x20 = 32)
 *    - 32 bytes: Length of the bytes parameter in bytes
 *    - N bytes: The actual bytes parameter (the batch data)
 *
 * 3. Batch Data Format:
 *    Each transaction in the batch is encoded as follows:
 *    - 1 byte: operation (0 = call, 1 = delegatecall)
 *    - 20 bytes: to (target address)
 *    - 32 bytes: value (amount of ETH to send)
 *    - 32 bytes: dataLength (length of the calldata in bytes)
 *    - N bytes: data (the actual calldata)
 *
 * The batch data is tightly packed with no padding between transactions.
 *
 * Example:
 * --------
 * A batch with 2 transactions might look like:
 * [operation1][to1][value1][dataLength1][data1][operation2][to2][value2][dataLength2][data2]
 *
 * Validation:
 * -----------
 * - Each transaction must have at least 85 bytes (1+20+32+32) for the fixed fields
 * - The data length must match the actual data provided
 * - The total length of all transactions must match the length of the batch data
 */
export class MultiSendHandler {
  // Constants for MultiSendCallOnly detection
  private MULTI_SEND_CALL_ONLY_ADDRESSES = [
    '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D', // Zircuit, Linea
  ]
  private MULTI_SEND_FUNCTION_SELECTOR = '0x8d80ff0a' // multiSend(bytes)

  constructor(private network: Networks, private eventHandler: EventHandler) {}

  /**
   * Check if a transaction is a MultiSendCallOnly transaction
   */
  isMultiSendTransaction(transaction: { to: string; data: string }): boolean {
    const isMultiSendByAddress = this.MULTI_SEND_CALL_ONLY_ADDRESSES.includes(transaction.to)
    const isMultiSendBySelector = transaction.data.startsWith(this.MULTI_SEND_FUNCTION_SELECTOR)
    const isRawBatchData =
      transaction.data.startsWith('0x00') && transaction.to === this.MULTI_SEND_CALL_ONLY_ADDRESSES[0]

    return isMultiSendByAddress || isMultiSendBySelector || isRawBatchData
  }

  /**
   * Extract the raw batch data from an ABI-encoded MultiSend transaction
   */
  extractBatchData(transactionData: string): string {
    let batchData = transactionData

    if (transactionData.startsWith(this.MULTI_SEND_FUNCTION_SELECTOR)) {
      // This is a properly ABI-encoded multiSend(bytes) call
      // Format: 0x8d80ff0a + [32 bytes offset] + [32 bytes length] + [actual batch data]
      logger.log('Detected ABI-encoded multiSend call', '🔧')

      // Remove function selector (first 4 bytes / 10 hex chars including '0x')
      const withoutSelector = '0x' + batchData.substring(10)

      // Extract the offset (first 32 bytes / 64 hex chars)
      const offsetHex = withoutSelector.substring(2, 66)
      const offset = parseInt(offsetHex, 16)
      logger.log(`Data offset: ${offset}`, '🔧')

      // Extract the length (next 32 bytes / 64 hex chars)
      const lengthHex = withoutSelector.substring(66, 130)
      const length = parseInt(lengthHex, 16)
      logger.log(`Data length: ${length} bytes`, '🔧')

      // Extract the actual batch data
      batchData = '0x' + withoutSelector.substring(130)
      logger.log('Extracted raw batch data from ABI encoding', '🔧')
    } else if (transactionData.startsWith('0x00')) {
      // It's already raw batch data
      logger.log('Using raw batch data', '🔧')
    } else {
      logger.log('Assuming data is raw batch format', '🔧')
    }

    return batchData
  }

  /**
   * Decodes MultiSendCallOnly transaction data into individual transactions
   */
  decodeMultiSendCallOnlyData(data: string): Array<{ operation: number; to: string; value: string; data: string }> {
    // Remove '0x' prefix if present
    const hexData = data.startsWith('0x') ? data.substring(2) : data

    const transactions: Array<{ operation: number; to: string; value: string; data: string }> = []
    let currentPos = 0

    // Minimum transaction size: 1 byte operation + 20 bytes address + 32 bytes value + 32 bytes data length = 85 bytes = 170 hex chars
    const MIN_TX_SIZE = 170

    while (currentPos + MIN_TX_SIZE <= hexData.length) {
      // Extract operation (1 byte)
      let operation = 0
      try {
        if (currentPos + 2 <= hexData.length) {
          operation = parseInt(hexData.substring(currentPos, currentPos + 2), 16)
          if (isNaN(operation) || operation > 1) {
            logger.warn(
              `Invalid operation value: ${hexData.substring(currentPos, currentPos + 2)}, using 0 (call) instead`,
            )
            operation = 0
          }
        } else {
          logger.warn(`Not enough data to extract operation, using 0 (call) instead`)
        }
      } catch (error) {
        logger.warn(`Could not parse operation, using 0 (call) instead`)
      }
      currentPos += 2

      // Extract to address (20 bytes)
      let to = '0x0000000000000000000000000000000000000000' // Default to zero address
      try {
        if (currentPos + 40 <= hexData.length) {
          to = '0x' + hexData.substring(currentPos, currentPos + 40)
          // Validate that it's a proper address format
          if (!to.match(/^0x[0-9a-fA-F]{40}$/)) {
            logger.warn(`Invalid address format: ${to}, using zero address instead`)
            to = '0x0000000000000000000000000000000000000000'
          }
        } else {
          logger.warn(`Not enough data to extract address, using zero address instead`)
        }
      } catch (error) {
        logger.warn(`Could not parse address, using zero address instead`)
      }
      currentPos += 40

      // Extract value (32 bytes)
      const valueHex = hexData.substring(currentPos, currentPos + 64)
      let value = '0'
      try {
        if (valueHex && valueHex !== '0000000000000000000000000000000000000000000000000000000000000000') {
          value = utils.formatUnits(BigNumber.from('0x' + valueHex), 'wei')
        }
      } catch (error) {
        logger.warn(`Could not parse value: 0x${valueHex}, using 0 instead`)
      }
      currentPos += 64

      // Extract data length (32 bytes)
      const dataLengthHex = hexData.substring(currentPos, currentPos + 64)
      let dataLength = 0
      try {
        dataLength = parseInt(dataLengthHex, 16)
        if (isNaN(dataLength)) {
          logger.warn(`Invalid data length: 0x${dataLengthHex}, using 0 instead`)
          dataLength = 0
        }
      } catch (error) {
        logger.warn(`Could not parse data length: 0x${dataLengthHex}, using 0 instead`)
      }
      currentPos += 64

      // Extract data (variable length)
      let txData = '0x'
      if (dataLength > 0 && currentPos + dataLength * 2 <= hexData.length) {
        txData = '0x' + hexData.substring(currentPos, currentPos + dataLength * 2)
        currentPos += dataLength * 2
      } else if (dataLength > 0) {
        logger.warn(`Data length ${dataLength} exceeds remaining data length, truncating`)
        txData = '0x' + hexData.substring(currentPos)
        currentPos = hexData.length
      }

      transactions.push({
        operation,
        to,
        value,
        data: txData,
      })
    }

    return transactions
  }

  /**
   * Handle a MultiSendCallOnly transaction
   */
  async handleMultiSendTransaction(
    transaction: { from: string; to: string; data: string },
    fromSigner: SignerWithAddress,
  ): Promise<SimulationResult> {
    logger.log('Detected MultiSendCallOnly transaction, decoding batch...', '🔍')

    // Extract the batch data
    const batchData = this.extractBatchData(transaction.data)

    // Decode the batched transactions
    const decodedTxs = this.decodeMultiSendCallOnlyData(batchData)
    logger.log(`Decoded ${decodedTxs.length} transactions from batch`, '📊')

    // Log each transaction for debugging
    decodedTxs.forEach((tx, index) => {
      logger.log(`Transaction ${index + 1}:`, '📄')
      logger.log(`  Operation: ${tx.operation === 0 ? 'Call' : 'DelegateCall'}`, '📄')
      logger.log(`  To: ${tx.to}`, '📄')
      logger.log(`  Value: ${tx.value}`, '📄')
      logger.log(`  Data length: ${tx.data.length / 2 - 1} bytes`, '📄')

      // Try to identify the function being called
      if (tx.data.length >= 10) {
        // At least function selector (4 bytes + '0x')
        const functionSelector = tx.data.substring(0, 10)
        logger.log(`  Function selector: ${functionSelector}`, '📄')
      }
    })

    // Execute each transaction individually
    const results = []
    const allLogs: FormattedLog[] = []
    let blockNumber = await ethers.provider.getBlockNumber()

    for (const tx of decodedTxs) {
      try {
        // Only execute regular calls (operation = 0)
        if (tx.operation === 0) {
          const result = await fromSigner.sendTransaction({
            to: tx.to,
            value: tx.value,
            data: tx.data,
          })
          logger.log(`Individual transaction to ${tx.to} succeeded`, '✅')

          // Wait for the transaction receipt to get logs
          const receipt = await result.wait()

          // Format and collect logs
          const formattedLogs = receipt.logs.map((log: any): FormattedLog => {
            try {
              const decodedEvent = this.eventHandler.decodeLog(log)

              // Log the decoded event if available
              if (decodedEvent && decodedEvent.description) {
                logger.log(`  Event: ${decodedEvent.description}`, '📝')
              }

              return {
                address: log.address,
                contractUrl: convertToExplorerUrlForNetwork(this.network, log.address),
                topics: log.topics,
                data: log.data,
                decodedEvent,
              }
            } catch (error) {
              logger.error(`Error formatting log: ${error}`)
              return {
                address: log.address,
                contractUrl: convertToExplorerUrlForNetwork(this.network, log.address),
                topics: log.topics,
                data: log.data,
                decodedEvent: null,
              }
            }
          })

          // Add logs to the collection
          allLogs.push(...formattedLogs)

          // Store the result
          results.push(result)

          // Update block number
          blockNumber = receipt.blockNumber
        } else {
          logger.warn(`Skipping delegatecall operation to ${tx.to} (not supported in simulation)`)
        }
      } catch (txError) {
        const errorMessage = txError instanceof Error ? txError.message : String(txError)
        logger.error(`Individual transaction to ${tx.to} failed: ${errorMessage}`)
        throw new Error(`Batch transaction failed at index ${results.length}: ${errorMessage}`)
      }
    }

    // Return a success result for the batch with all collected logs
    return {
      receipt: {
        status: 'Success',
        from: transaction.from,
        to: transaction.to,
        transactionHash: 'batch-simulated',
        blockNumber,
        gasUsed: 'simulated',
        effectiveGasPrice: 'simulated',
        logs: allLogs,
        explorerUrl: getTxExplorerUrlForNetwork(this.network, 'batch-simulated'),
      },
      timestamp: new Date().toISOString(),
    }
  }
}
