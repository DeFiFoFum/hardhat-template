import { MockToken, MockToken__factory } from '../../typechain-types'
import { DeployManager } from '../../scripts/deploy/DeployManager'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export type Template_ContextManager_Accounts = {
  admin: SignerWithAddress
  deployer: SignerWithAddress
}

export type Template_ContextManager_Props = {
  accounts: Template_ContextManager_Accounts
  tokens: {
    principalToken: MockToken
    payoutToken: MockToken
  }
}

export class Template_ContextManager {
  private _props: Template_ContextManager_Props

  constructor(props: Template_ContextManager_Props) {
    this._props = props
  }

  public get props(): Template_ContextManager_Props {
    return this._props
  }

  static async createWithBondConfig(
    accounts: Template_ContextManager_Accounts,
    principalSupply: string,
    payoutSupply: string,
  ): Promise<Template_ContextManager> {
    const deployManager = await DeployManager.create({ signer: accounts.deployer })

    // Deploy tokens
    const principalToken = await deployManager.deployContract<MockToken__factory>('MockToken', [
      'PrincipalToken',
      'BUY',
      principalSupply,
    ])
    const payoutToken = await deployManager.deployContract<MockToken__factory>('MockToken', [
      'PayoutToken',
      'SELL',
      payoutSupply,
    ])

    const contextManagerProps: Template_ContextManager_Props = {
      accounts,
      tokens: {
        principalToken,
        payoutToken,
      },
    }

    return new Template_ContextManager(contextManagerProps)
  }
}
