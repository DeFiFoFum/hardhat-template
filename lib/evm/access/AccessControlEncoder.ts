import { ethers } from 'hardhat'
import { AccessControlEnumerable } from '../../../typechain-types'
import { ADDRESS_0 } from '../constants'
import { BytesLike, PopulatedTransaction } from 'ethers'

export interface RoleAssignment {
  role: BytesLike
  account: string
}

export class AccessControlEncoder {
  private constructor(private accessControlContract: AccessControlEnumerable) {
    // Constructor is private to force use of the factory method
  }

  static async create(address = ADDRESS_0): Promise<AccessControlEncoder> {
    const accessControlContract = await ethers.getContractAt('AccessControlEnumerable', address)
    return new AccessControlEncoder(accessControlContract)
  }

  async encodeGrantRole({ role, account }: RoleAssignment): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.grantRole(role, account)
  }

  async encodeRevokeRole({ role, account }: RoleAssignment): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.revokeRole(role, account)
  }

  async encodeRenounceRole({ role, account }: RoleAssignment): Promise<PopulatedTransaction> {
    return await this.accessControlContract.populateTransaction.renounceRole(role, account)
  }
}
