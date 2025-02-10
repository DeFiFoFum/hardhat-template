import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'

export type Accounts_ContextManager_Props = {
  signers: {
    deployer: SignerWithAddress
    admin: SignerWithAddress
    alice: SignerWithAddress
    bob: SignerWithAddress
    carol: SignerWithAddress
  }
  nextAccountIndex?: number
}

/**
 * Context manager for managing accounts.
 *
 * Provides a structured way to keep signers consistent across tests.
 */
export class Accounts_ContextManager {
  private _props: Accounts_ContextManager_Props

  constructor(props: Accounts_ContextManager_Props) {
    this._props = props
  }

  public get props(): Accounts_ContextManager_Props {
    return this._props
  }

  static async createWithAccountsArray(accounts: SignerWithAddress[]): Promise<Accounts_ContextManager> {
    const [deployer, owner, alice, bob, carol] = accounts

    const contextManagerProps: Accounts_ContextManager_Props = {
      signers: {
        deployer,
        admin: owner,
        alice,
        bob,
        carol,
      },
    }

    return new Accounts_ContextManager(contextManagerProps)
  }

  async getNextSignersWithAddress(numberOfSigners: number): Promise<SignerWithAddress[]> {
    const DEFAULT_NEXT_ACCOUNT_INDEX = 100
    const nextIndex = this._props.nextAccountIndex || DEFAULT_NEXT_ACCOUNT_INDEX
    this._props.nextAccountIndex = nextIndex + numberOfSigners

    const allSigners = await ethers.getSigners()
    // Make sure we have enough signers
    if (nextIndex + numberOfSigners > allSigners.length) {
      throw new Error(
        `Not enough signers available, update in hardhat.config.ts. Requested index ${
          nextIndex + numberOfSigners
        } but only have ${allSigners.length}`,
      )
    }
    return allSigners.slice(nextIndex, nextIndex + numberOfSigners)
  }
}
