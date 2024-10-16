import { PopulatedTransaction } from '@ethersproject/contracts'
import AccessControlEncoder from './AccessControlEncoder'
import { BigNumber, utils, BytesLike } from 'ethers'
import { ADDRESS_0, BYTES_32_0 } from '../constants'
import { ethers } from 'hardhat'
import { TimelockControllerEnumerable } from '../../../typechain-types'

const abiCoder = utils.defaultAbiCoder
const keccak256 = utils.keccak256

type ROLE = 'TIMELOCK_ADMIN_ROLE' | 'PROPOSER_ROLE' | 'EXECUTOR_ROLE'

interface RoleInput {
  role: ROLE
  account: string
}

interface SingleOperation {
  target: string
  value?: string | BigNumber
  data: string
  predecessor?: BytesLike
  salt?: BytesLike
  from?: string
}

interface BatchOperation {
  targets: string[]
  values: Array<string | BigNumber>
  datas: string[]
  predecessor?: BytesLike
  salt?: BytesLike
  from?: string
}

interface EncodeReturn {
  populatedTx: PopulatedTransaction
  data: string
  operationId: string
}

export interface BatchEncodeReturn {
  scheduleBatchEncoded: PopulatedTransaction
  executeBatchEncoded: PopulatedTransaction
  cancelBatchEncoded: PopulatedTransaction
  operationId: string
}

export default class TimelockEncoder {
  timelockContract!: TimelockControllerEnumerable // definite assignment assertion
  accessControlEncoder!: AccessControlEncoder

  private constructor() {
    // Constructor is now private to force use of the factory method
  }

  static async create(address = ADDRESS_0): Promise<TimelockEncoder> {
    const encoder = new TimelockEncoder()
    encoder.timelockContract = await ethers.getContractAt('TimelockControllerEnumerable', address)
    encoder.accessControlEncoder = await AccessControlEncoder.create(address)
    return encoder
  }

  /**
   * Access Control
   */
  async encodeGrantRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlEncoder.encodeGrantRole({ role: keccak256(role), account })
  }

  async encodeRevokeRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlEncoder.encodeRevokeRole({ role: keccak256(role), account })
  }

  async encodeRenounceRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlEncoder.encodeRenounceRole({ role: keccak256(role), account })
  }

  async encodeCancelOperation(operationId: string): Promise<PopulatedTransaction> {
    return await this.timelockContract.populateTransaction.cancel(operationId)
  }

  /**
   * Timelock functions
   */
  async encodeUpdateDelay(delay: string | number): Promise<PopulatedTransaction> {
    return await this.timelockContract.populateTransaction.updateDelay(delay)
  }

  /**
   * Single TX handling
   */
  async encodeTxsForSingleOperation(
    { target, value = '0', data, predecessor = BYTES_32_0, salt = BYTES_32_0, from = '0x' }: SingleOperation,
    delay: string | number
  ): Promise<{
    scheduleEncoded: PopulatedTransaction
    executeEncoded: PopulatedTransaction
    cancelEncoded: PopulatedTransaction
    operationId: string
  }> {
    const { populatedTx: scheduleEncoded, operationId } = await this.encodeSchedule(
      { target, value, data, predecessor, salt, from },
      delay
    )
    const { populatedTx: executeEncoded } = await this.encodeExecute({ target, value, data, predecessor, salt, from })
    const cancelEncoded = await this.encodeCancelOperation(operationId)

    return { scheduleEncoded, executeEncoded, cancelEncoded, operationId }
  }

  async hashOperation({
    target,
    value = '0',
    data,
    predecessor = BYTES_32_0,
    salt = BYTES_32_0,
    from = '0x',
  }: SingleOperation): Promise<string> {
    const abiEncoded = abiCoder.encode(
      ['address', 'uint256', 'bytes', 'bytes32', 'bytes32'],
      [target, value, data, predecessor, salt]
    )
    const operationId = keccak256(abiEncoded)
    return operationId
  }

  async encodeSchedule(
    { target, value = '0', data, predecessor = BYTES_32_0, salt = BYTES_32_0, from = '0x' }: SingleOperation,
    delay: string | number
  ): Promise<EncodeReturn> {
    const populatedTx = await this.timelockContract.populateTransaction.schedule(
      target,
      value,
      data,
      predecessor,
      salt,
      delay
    )
    populatedTx.from = from
    const operationId = await this.hashOperation({ target, value, data, predecessor, salt })
    return {
      populatedTx,
      data: populatedTx.data || '0x',
      operationId,
    }
  }

  async encodeExecute({
    target,
    value = '0',
    data,
    predecessor = BYTES_32_0,
    salt = BYTES_32_0,
    from = '0x',
  }: SingleOperation): Promise<EncodeReturn> {
    const populatedTx = await this.timelockContract.populateTransaction.execute(target, value, data, predecessor, salt)
    populatedTx.from = from
    const operationId = await this.hashOperation({ target, value, data, predecessor, salt })
    return {
      populatedTx,
      data: populatedTx.data || '0x',
      operationId,
    }
  }

  /**
   * Batch TX handling
   */
  async encodeTxsForBatchOperation(
    { targets, values, datas, predecessor = BYTES_32_0, salt = BYTES_32_0, from = '0x' }: BatchOperation,
    delay: string | number
  ): Promise<BatchEncodeReturn> {
    const { populatedTx: scheduleBatchEncoded, operationId } = await this.encodeScheduleBatch(
      { targets, values, datas, predecessor, salt, from },
      delay
    )
    const { populatedTx: executeBatchEncoded } = await this.encodeExecuteBatch({
      targets,
      values,
      datas,
      predecessor,
      salt,
      from,
    })
    const cancelBatchEncoded = await this.encodeCancelOperation(operationId)

    return { scheduleBatchEncoded, executeBatchEncoded, cancelBatchEncoded, operationId }
  }

  async hashOperationBatch({
    targets,
    values,
    datas,
    predecessor = BYTES_32_0,
    salt = BYTES_32_0,
  }: BatchOperation): Promise<string> {
    const abiEncoded = abiCoder.encode(
      ['address[]', 'uint256[]', 'bytes[]', 'bytes32', 'bytes32'],
      [targets, values, datas, predecessor, salt]
    )
    const operationId = keccak256(abiEncoded)
    return operationId
  }

  async encodeScheduleBatch(
    { targets, values, datas, predecessor = BYTES_32_0, salt = BYTES_32_0, from = '0x' }: BatchOperation,
    delay: string | number
  ): Promise<EncodeReturn> {
    const populatedTx = await this.timelockContract.populateTransaction.scheduleBatch(
      targets,
      values,
      datas,
      predecessor,
      salt,
      delay
    )
    populatedTx.from = from
    const operationId = await this.hashOperationBatch({ targets, values, datas, predecessor, salt })
    return {
      populatedTx,
      data: populatedTx.data || '0x',
      operationId,
    }
  }

  async encodeExecuteBatch({
    targets,
    values,
    datas,
    predecessor = BYTES_32_0,
    salt = BYTES_32_0,
    from = '0x',
  }: BatchOperation): Promise<EncodeReturn> {
    const populatedTx = await this.timelockContract.populateTransaction.executeBatch(
      targets,
      values,
      datas,
      predecessor,
      salt
    )
    populatedTx.from = from
    const operationId = await this.hashOperationBatch({ targets, values, datas, predecessor, salt })
    return {
      populatedTx,
      data: populatedTx.data || '0x',
      operationId,
    }
  }
}
