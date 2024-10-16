import { ethers } from 'hardhat'
import { BytesLike, PopulatedTransaction } from 'ethers'
import { ADDRESS_0 } from '../constants'
import { AccessControlEnumerable } from '../../../typechain-types'

interface RoleInput {
  role: BytesLike
  account: string
}

export default class AccessControlEncoder {
  accessControlContract!: AccessControlEnumerable

  private constructor() {
    // Constructor is now private to force use of the factory method
  }

  static async create(address = ADDRESS_0): Promise<AccessControlEncoder> {
    const encoder = new AccessControlEncoder()
    encoder.accessControlContract = await ethers.getContractAt('AccessControlEnumerable', address)
    return encoder
  }

  async encodeGrantRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.grantRole(role, account)
  }

  async encodeRevokeRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.revokeRole(role, account)
  }

  async encodeRenounceRole({ role, account }: RoleInput): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.renounceRole(role, account)
  }
}
