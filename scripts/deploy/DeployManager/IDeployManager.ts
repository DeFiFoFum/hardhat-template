import { BigNumber, BigNumberish, Contract, ContractFactory, Signer } from 'ethers'
import { FactoryOptions } from 'hardhat/types'
import { ProxyAdmin, TransparentUpgradeableProxy } from '../../../typechain-types'

// -----------------------------------------------------------------------------------------------
// Common Types
// -----------------------------------------------------------------------------------------------

export interface GasEstimation {
  gasLimit: string
  gasPriceWei: string
  gasPriceGei: string
  ethCost: string
}

export interface DeployedContractDetails {
  name: string
  snapshotName: string
  address: string
  encodedConstructorArgs: string
  constructorArguments: any[]
  verificationCommand: string
  gasEstimate: GasEstimation | null
}

// -----------------------------------------------------------------------------------------------
// Options Interfaces
// -----------------------------------------------------------------------------------------------

export interface BaseDeployOptions {
  name?: string
  estimateGas?: boolean
  gasPriceOverride?: BigNumber
}

/**
 * Extended diagram of the Proxy Pattern used for upgradeable contracts including the admin of the ProxyAdmin:
 *
 *  +-------+                      +----------------+           +-------------------+           +-------------------+
 *  |       |                      |                |           |                   |           |                   |
 *  | Owner |                      |  ProxyAdmin    |           |  Transparent      |           |  Implementation   |
 *  |       +--------------------->|                |  admin    |  UpgradeableProxy |  delegate |  Contract (Logic) |
 *  |       |                      |                +---------->+                   +---------->+                   |
 *  +-------+                      |                |           |                   |           |                   |
 *                                 +----------------+           +-------------------+           +-------------------+
 */
export interface UpgradeableDeployOptions extends BaseDeployOptions {
  // Used to skip initializer when deploying upgradeable contracts
  skipInitialization?: boolean
  // Skip deploying proxy admin and use existing one
  proxyAdminAddress?: string
  // Proxy admin owner (Only used if proxyAdminAddress is not provided)
  proxyAdminOwner?: string
}

export interface UpgradeableDeployResult<T extends Contract, I extends Contract = Contract> {
  implementationThroughProxy: T
  proxyAdmin: ProxyAdmin
  proxyAdminOwner: string
  transparentProxy: TransparentUpgradeableProxy
  implementation: I
  initialized: boolean
}

export type InitializerParams<CF extends ContractFactory> = Parameters<ReturnType<CF['attach']>['initialize']> | []

// -----------------------------------------------------------------------------------------------
// Main Interface
// -----------------------------------------------------------------------------------------------

export interface IDeployManager {
  // Signer Management
  getSigner(): Promise<Signer>
  setSigner(signer: Signer): void
  setMaxDeployRetries(retries: number): void

  // Basic Contract Deployment
  deployContract<CF extends ContractFactory>(
    contractName: string,
    params: Parameters<CF['deploy']>,
    factoryOptions?: FactoryOptions,
  ): Promise<ReturnType<CF['deploy']>>

  deployContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    params: Parameters<CF['deploy']>,
    options?: BaseDeployOptions,
  ): Promise<ReturnType<CF['deploy']>>

  // Upgradeable Contract Deployment
  deployUpgradeableContract<CF extends ContractFactory>(
    contractName: string,
    initializerParams: Parameters<ReturnType<CF['attach']>['initialize']>,
    options?: UpgradeableDeployOptions,
    factoryOptions?: FactoryOptions,
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>>

  deployUpgradeableContract_SkipInitialize<CF extends ContractFactory>(
    contractName: string,
    options?: Omit<UpgradeableDeployOptions, 'skipInitialization'>,
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>>

  deployUpgradeableContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    initializerParams: InitializerParams<CF>,
    options: UpgradeableDeployOptions,
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>>

  // Proxy Related Deployments
  deployProxyAdmin(adminAddress: string): Promise<ProxyAdmin>

  deployTransparentProxy(
    implementationAddress: string,
    proxyAdminAddress: string,
    initializerData: string,
    implementationContractName: string,
  ): Promise<TransparentUpgradeableProxy>

  // Verification
  verifyContracts(): Promise<void>
  verifyContract(snapshotName: string): Promise<void>
  getVerificationCommand(contractDetails: DeployedContractDetails): string
}

// -----------------------------------------------------------------------------------------------
// Factory Interface
// -----------------------------------------------------------------------------------------------

export interface IDeployManagerFactory {
  create(options: { signer?: Signer; baseDir?: string; gasPriceOverride?: BigNumberish }): Promise<IDeployManager>
}
