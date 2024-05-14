import { ethers } from 'hardhat'
import { addressToHexData } from '../evmUtils'
import { DEFAULT_MULTISEND_ADDRESS, getSafeContractAt } from './getSafeContracts'

// TODO: Pull out multiSend encoding and remove `ethers-multisend` dependency
import { MetaTransaction, encodeMulti } from 'ethers-multisend'

export type AddOwnersOptions = {
  multiSendCallOnlyAddress?: string
}

export async function getAddOwnersTransactionData(
  safeAddress: string,
  create2Deployer: string,
  ownerAddresses: string[],
  options: AddOwnersOptions = {}
) {
  let { multiSendCallOnlyAddress } = options
  multiSendCallOnlyAddress = multiSendCallOnlyAddress || DEFAULT_MULTISEND_ADDRESS
  const safeContract = await getSafeContractAt(safeAddress)

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
    })
  )
  // Encode the owner transactions into a single multiSend call
  const encodedMulti = encodeMulti(ownerMultiSendTransactions, multiSendCallOnlyAddress)

  // Now encode the final execTransaction call
  // Assuming you have the necessary details like to, value, operation, etc.
  const to = multiSendCallOnlyAddress // Address of the multiSend contract
  const value = 0
  const operation = 1 // Call operation
  const safeTxGas = 0
  const baseGas = 0
  const gasPrice = 0
  const gasToken = ethers.constants.AddressZero // Use ETH, not a token
  const refundReceiver = ethers.constants.AddressZero // No refund receiver
  const signatures = `0x000000000000000000000000${addressToHexData(
    create2Deployer
  )}000000000000000000000000000000000000000000000000000000000000000001` // Assuming 1 signature

  const finalData = await safeContract.populateTransaction.execTransaction(
    to,
    value,
    encodedMulti.data,
    operation,
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    signatures
  )

  console.log('Final Transaction Data:', finalData)
  return finalData
}
