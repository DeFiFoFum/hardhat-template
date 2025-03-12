import { ethers } from 'hardhat'
import { addressToHexData } from '../evmUtils'
import { DEFAULT_MULTISEND_ADDRESS, getSafeContractAt } from './getSafeContracts'

// TODO: Pull out multiSend encoding and remove `ethers-multisend` dependency
import { MetaTransaction, encodeMulti } from 'ethers-multisend'
import { GnosisSafeL2 } from '../../../typechain-types'

export type SafeOptions = {
  multiSendCallOnlyAddress?: string
}

export type SafeWalletTxEncoder_Props = {
  safeContract: GnosisSafeL2
  signerAddress: string
  multiSendCallOnlyAddress: string
}

/**
 * @dev Currently only supports adding encoding txs for single threshold safes.
 */
export class SafeWalletTxEncoder {
  private _props: SafeWalletTxEncoder_Props

  private constructor(props: SafeWalletTxEncoder_Props) {
    this._props = props
  }

  public get props(): SafeWalletTxEncoder_Props {
    return this._props
  }

  static async create(safeAddress: string, signerAddress: string): Promise<SafeWalletTxEncoder> {
    const safeContract = await getSafeContractAt(safeAddress)
    const multiSendCallOnlyAddress = DEFAULT_MULTISEND_ADDRESS

    const props: SafeWalletTxEncoder_Props = {
      safeContract,
      signerAddress,
      multiSendCallOnlyAddress,
    }

    return new SafeWalletTxEncoder(props)
  }

  public get safeAddress(): string {
    return this.props.safeContract.address
  }

  async getAddOwnersTransactionData(ownerAddresses: string[], options: SafeOptions = {}) {
    const multiSendCallOnlyAddress = options.multiSendCallOnlyAddress || this.props.multiSendCallOnlyAddress
    const safeContract = await getSafeContractAt(this.safeAddress)

    // -------------------------------------------------------------------------------------------------------------------
    // Encode Owner TXs
    // -------------------------------------------------------------------------------------------------------------------

    // Create a tx for each owner to be added
    const ownerMultiSendTransactions = await Promise.all(
      ownerAddresses.map(async (ownerAddress) => {
        const tx = await safeContract.populateTransaction.addOwnerWithThreshold(ownerAddress, 1)

        // NOTE: using MetaTransaction from 'ethers-multisend'
        const mt: MetaTransaction = {
          to: tx.to || '0x',
          value: tx.value?.toString() || '0',
          data: tx.data || '0x',
        }
        return mt
      }),
    )

    // Encode the owner transactions into a single multiSend call
    const encodedMulti = this.encodeMultiSendTransaction(ownerMultiSendTransactions, multiSendCallOnlyAddress)

    // Now encode the final execTransaction call
    const operation = 1 // DelegateCall operation
    const finalData = await this.encodeExecTransaction(
      multiSendCallOnlyAddress,
      0,
      encodedMulti.data,
      operation,
      this.props.signerAddress,
    )

    console.log('Final Transaction Data:', finalData)
    return finalData
  }

  async getRemoveOwnerTransactionData(ownerAddressToRemove: string, newThreshold: number) {
    // Get contract instances
    const safeContract = await getSafeContractAt(this.safeAddress)
    const linkedOwners = await safeContract.getOwners()

    // Find the previous linked owner
    let previousLinkedOwner = linkedOwners[0]
    // Find index of owner to remove
    const ownerIndex = linkedOwners.findIndex((owner) => owner.toLowerCase() === ownerAddressToRemove.toLowerCase())
    if (ownerIndex === -1) {
      throw new Error(`Owner ${ownerAddressToRemove} not found in safe owners`)
    }

    // Get previous owner in linked list
    previousLinkedOwner = ownerIndex === 0 ? linkedOwners[linkedOwners.length - 1] : linkedOwners[ownerIndex - 1]

    // Create transaction to remove owner
    const tx = await safeContract.populateTransaction.removeOwner(
      previousLinkedOwner,
      ownerAddressToRemove,
      newThreshold,
    )

    if (!tx.data) {
      throw new Error(`No tx data found for ${this.safeAddress} and ownerAddressToRemove: ${ownerAddressToRemove}`)
    }

    // Encode the final execTransaction call
    const operation = 0 // Call operation
    const value = 0
    const finalData = await this.encodeExecTransaction(
      this.safeAddress,
      value,
      tx.data,
      operation,
      this.props.signerAddress,
    )

    console.log('Final Transaction Data:', finalData)
    return finalData
  }

  private encodeMultiSendTransaction(transactions: MetaTransaction[], multiSendAddress?: string) {
    const address = multiSendAddress || this.props.multiSendCallOnlyAddress
    return encodeMulti(transactions, address)
  }

  private async encodeExecTransaction(
    to: string,
    value: number,
    data: string,
    operation: number,
    signerAddress: string,
  ) {
    const safeTxGas = 0
    const baseGas = 0
    const gasPrice = 0
    const gasToken = ethers.constants.AddressZero // Use ETH, not a token
    const refundReceiver = ethers.constants.AddressZero // No refund receiver
    const signatures = `0x000000000000000000000000${addressToHexData(
      signerAddress,
    )}000000000000000000000000000000000000000000000000000000000000000001` // Assuming 1 signature

    return this.props.safeContract.populateTransaction.execTransaction(
      to,
      value,
      data,
      operation,
      safeTxGas,
      baseGas,
      gasPrice,
      gasToken,
      refundReceiver,
      signatures,
    )
  }
}
