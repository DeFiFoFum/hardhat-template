import { ethers } from 'hardhat'
import { BytesLike, PopulatedTransaction, BigNumber } from 'ethers'

interface Transaction {
  to: string
  value?: string | number | bigint | BigNumber
  data: BytesLike
}

const DEFAULT_MULTI_SEND_ADDRESS = '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D' // MultiSendCallOnly contract

/**
 * MultiSendEncoder - Encodes multiple transactions for use with Safe Wallet's MultiSendCallOnly contract
 *
 * This encoder takes an array of transactions and encodes them according to the format required by
 * the MultiSendCallOnly contract. The encoded data can then be used to execute multiple transactions
 * in a single transaction through Safe Wallet.
 *
 * @see https://github.com/safe-global/safe-contracts/blob/main/contracts/libraries/MultiSendCallOnly.sol
 */
export default class MultiSendEncoder {
  /**
   * Create a new MultiSendEncoder
   * @param multiSendAddress The address of the MultiSendCallOnly contract
   * @returns A new MultiSendEncoder instance
   */
  static create(multiSendAddress = DEFAULT_MULTI_SEND_ADDRESS): MultiSendEncoder {
    return new MultiSendEncoder(multiSendAddress)
  }

  private constructor(private multiSendAddress: string) {
    // Constructor is private to force use of the factory method
  }

  /**
   * Encode multiple transactions for use with MultiSendCallOnly
   *
   * @param transactions Array of transactions to encode
   * @returns Populated transaction ready to be sent to Safe Wallet
   */
  encodeMultiSend(transactions: Transaction[] | PopulatedTransaction[]): PopulatedTransaction {
    // Encode each transaction according to the MultiSendCallOnly format
    const encodedTransactions = this.encodeTransactions(transactions)

    // Create a populated transaction to the MultiSendCallOnly contract
    const multiSendInterface = new ethers.utils.Interface(['function multiSend(bytes transactions) payable'])

    const data = multiSendInterface.encodeFunctionData('multiSend', [encodedTransactions])

    return {
      to: this.multiSendAddress,
      data,
      value: ethers.BigNumber.from(0),
    }
  }

  /**
   * Encode an array of transactions according to the MultiSendCallOnly format
   *
   * Each transaction is encoded as packed bytes of:
   * - operation (uint8(0) for call) - 1 byte
   * - to address - 20 bytes
   * - value (uint256) - 32 bytes
   * - data length (uint256) - 32 bytes
   * - data (bytes)
   *
   * @param transactions Array of transactions to encode
   * @returns Encoded transactions as bytes
   */
  private encodeTransactions(transactions: Transaction[] | PopulatedTransaction[]): string {
    let encodedTransactions = '0x'

    for (const tx of transactions) {
      if (!tx.data) {
        throw new Error('MultiSendEncoder::encodeTransactions:: Transaction data is required')
      }

      // Convert value to BigNumber if it's not already
      const value = ethers.BigNumber.from(tx.value || 0)

      // Convert data to hex string if it's not already
      const data = ethers.utils.hexlify(tx.data)

      // Remove '0x' prefix from data for encoding
      const dataWithoutPrefix = data.startsWith('0x') ? data.slice(2) : data

      // Calculate data length
      const dataLength = ethers.utils.hexDataLength(data)

      // Encode transaction components
      const encodedTx = ethers.utils.solidityPack(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [
          0, // operation (0 for call)
          tx.to, // to address
          value, // value
          dataLength, // data length
          '0x' + dataWithoutPrefix, // data
        ],
      )

      // Remove '0x' prefix from encoded transaction
      encodedTransactions += encodedTx.slice(2)
    }

    return encodedTransactions
  }

  /**
   * Get the address of the MultiSendCallOnly contract
   * @returns The address of the MultiSendCallOnly contract
   */
  getMultiSendAddress(): string {
    return this.multiSendAddress
  }
}
