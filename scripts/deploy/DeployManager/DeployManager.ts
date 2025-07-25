import { BigNumber, BigNumberish, Contract, ContractFactory, utils } from 'ethers'
import { network, run, ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { FactoryOptions } from 'hardhat/types'
import { Logger } from '../../../lib/node/logger'
import { askYesOrNoQuestion } from '../../../lib/prompts/promptUser'
import path from 'path'
import { DEPLOYMENTS_BASE_DIR } from '../deploy.config'
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy__factory,
} from '../../../typechain-types'
import {
  BaseDeployOptions,
  DeployedContractDetails,
  GasEstimation,
  IDeployManager,
  IDeployManagerFactory,
  InitializerParams,
  UpgradeableDeployOptions,
  UpgradeableDeployResult,
} from './IDeployManager'
import { ISnapshotManager } from './SnapshotManager/ISnapshotManager'
import { FileSystemSnapshotManager } from './SnapshotManager/FileSystemSnapshotManager'
import { MemorySnapshotManager } from './SnapshotManager/MemorySnapshotManager'
import { delayWithLoadingBar } from '../../../lib/cli/CliDelay'

// -----------------------------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------------------------

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
 *
 * - Owner: The external owner/administrator that has the rights to upgrade the proxy by interacting with the ProxyAdmin.
 * - ProxyAdmin: The contract that administers the proxy contract, capable of upgrading it.
 *      The ProxyAdmin CANNOT interact with the implementation contract directly.
 * - TransparentUpgradeableProxy: The proxy contract that delegates calls to the implementation contract.
 * - Implementation Contract (Logic): The contract containing the logic, which can be upgraded.
 */

interface DeployManagerConstructor {
  signer?: SignerWithAddress
  baseDir?: string
  snapshotManager: ISnapshotManager
  gasPriceOverride?: BigNumberish
  delaySecondsBetweenDeployments?: number
}

type CreateDeployManager = Omit<DeployManagerConstructor, 'snapshotManager'> & {
  snapshotManager?: ISnapshotManager
}

/**
 * Version 3.4.0
 * - v3.4.0: Merged features from v3.2 and v3.3 - Added proxy pattern diagram, gas price override prompts,
 *           enhanced logging with file output, and prominent deployment success messages
 * - v3.3.0: Added delay functionality and advanced TypeScript interfaces
 * - v3.2.3: Added support for libraries, file logger, and gas price override validation
 *
 * A class to deploy contracts, verify them and save the deployment details to a file.
 *
 * See docs at top of file for more details.
 */
export class DeployManager implements IDeployManager {
  private signer?: SignerWithAddress
  private baseDir: string
  private gasPriceOverride?: BigNumber
  private maxDeployRetries: number = 20
  private delaySecondsBetweenDeployments: number
  readonly snapshotManager: ISnapshotManager
  private logger: Logger

  /**
   * Private constructor to initialize the DeployManager class.
   *
   * @param props - The constructor properties
   * @param props.signer - Optional signer for transactions
   * @param props.baseDir - Base directory for deployment artifacts (defaults to DEPLOYMENTS_BASE_DIR)
   * @param props.gasPriceOverride - Optional override for gas price
   * @param props.delaySecondsBetweenDeployments - Delay between deployments in seconds
   * @param props.snapshotManager - Manager for deployment snapshots
   */
  private constructor({
    signer,
    baseDir = DEPLOYMENTS_BASE_DIR,
    gasPriceOverride,
    delaySecondsBetweenDeployments,
    snapshotManager,
  }: DeployManagerConstructor) {
    // Create a logger instance with deployment-specific logging
    this.logger = new Logger({
      actor: 'DeployManager',
      logDir: path.join(baseDir, 'logs'),
      logFileName: 'deployment',
      fileExtension: 'log',
      networkName: network.name,
      verbose: true,
    })

    this.logger.log(`Setting up DeployManager. Your simple and friendly contract deployment manager.`, `👋🤓`)
    this.baseDir = baseDir
    this.signer = signer
    if (gasPriceOverride) {
      this.gasPriceOverride = BigNumber.from(gasPriceOverride)
    }
    this.delaySecondsBetweenDeployments = delaySecondsBetweenDeployments || 0
    this.snapshotManager = snapshotManager
    this.logger.log(`Deployment information will be saved in: ${this.baseDir}`, `💾`)
  }

  static async create({
    signer,
    baseDir = DEPLOYMENTS_BASE_DIR,
    gasPriceOverride,
    delaySecondsBetweenDeployments,
    snapshotManager,
  }: CreateDeployManager): Promise<DeployManager> {
    if (gasPriceOverride) {
      if (
        !(await askYesOrNoQuestion(
          `Are you sure you want to use a gas price override of ${gasPriceOverride} for network ${network.name}?`,
        ))
      ) {
        throw new Error('Gas price override not confirmed')
      }
    }
    const snapshotManagerInstance = snapshotManager || (await FileSystemSnapshotManager.create(baseDir))
    const instance = new DeployManager({
      signer,
      baseDir,
      gasPriceOverride,
      snapshotManager: snapshotManagerInstance,
      delaySecondsBetweenDeployments,
    })
    if (instance.signer) {
      instance.logger.log(`Signer address: ${await instance.signer.getAddress()}`, `🖊️`)
    }
    return instance
  }

  static async createWithMemorySnapshotManager({
    signer,
    baseDir = DEPLOYMENTS_BASE_DIR,
    gasPriceOverride,
  }: DeployManagerConstructor): Promise<DeployManager> {
    const snapshotManager = new MemorySnapshotManager()
    return DeployManager.create({ signer, baseDir, gasPriceOverride, snapshotManager })
  }

  /**
   * Gets the signer instance.
   * @returns - A promise that resolves to a signer instance.
   */
  async getSigner(): Promise<SignerWithAddress> {
    let signer = this.signer
    if (!signer) {
      // NOTE: Defaults to the first signer if not provided
      signer = (await ethers.getSigners())[0]
    }

    if (!signer) {
      throw new Error(`Signer not available, please check your mnemonic/private key.`)
    }
    return signer
  }

  /**
   * Sets the signer instance.
   * @param signer - The signer instance.
   */
  setSigner(signer: SignerWithAddress) {
    this.signer = signer
  }

  /**
   * More accurately manage nonces for the signer.
   * @returns Next nonce for the signer
   */
  private async getNextNonce(): Promise<number> {
    const signer = await this.getSigner()
    return await signer.getTransactionCount('pending')
  }

  /**
   * Sets the number of retries to attempt for deployments for errors related to nonces and gas prices.
   * @param retires - The number of retries to attempt
   */
  setMaxDeployRetries(retires: number) {
    this.maxDeployRetries = retires
  }

  private async delay(secondsOverride?: number): Promise<void> {
    const seconds = secondsOverride || this.delaySecondsBetweenDeployments
    if (seconds > 0) {
      this.logger.log(`Delaying deployments for ${seconds} seconds to help with RPC consistency...`, `⏳`)
      await delayWithLoadingBar(seconds)
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Deployments
  // -----------------------------------------------------------------------------------------------

  /**
   * Deploys a contract from name.
   * @param contractName - The name of the contract.
   * @param params - The parameters for the contract's deploy method.
   * @param factoryOptions - The factory options for the contract.
   * @returns - A promise that resolves to the deployed contract instance.
   */
  async deployContract<CF extends ContractFactory>(
    contractName: string,
    params: Parameters<CF['deploy']>,
    factoryOptions?: FactoryOptions,
  ): Promise<ReturnType<CF['deploy']>> {
    const factory = (await ethers.getContractFactory(contractName, factoryOptions)) as CF
    return this.deployContractFromFactory(factory, params, { name: contractName })
  }

  /**
   * Deploys a contract from a contract factory.
   * @param contractFactory - The contract factory instance.
   * @param params - The parameters for the contract's deploy method.
   * @param options - The deployment options.
   */
  // TODO: Pull in updates from DeployManager (VE)
  async deployContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    params: Parameters<CF['deploy']>,
    { name = 'Contract', estimateGas = true, gasPriceOverride }: BaseDeployOptions = {},
  ): Promise<ReturnType<CF['deploy']>> {
    // Get next contract name and check if it exists
    const { snapshotName, existingContract } = this.snapshotManager.getNextContract(name)
    if (existingContract) {
      this.logger.log(`Reusing previously deployed ${name} at ${existingContract.address}`, '♻️')
      return contractFactory.attach(existingContract.address) as ReturnType<CF['deploy']>
    }

    this.logger.logHeader(`Deploying ${name}`, `🚀`)
    const balanceBefore = await this.signer?.getBalance()
    const balanceBeforeInEther = utils.formatEther(balanceBefore || 0)
    this.logger.log(`Balance before deployment: ${balanceBeforeInEther} ETH`, `💰`)

    let encodedConstructorArgs = ''
    let contractInstance: Awaited<ReturnType<CF['deploy']>> | undefined = undefined
    let deployAttempt = 0
    let gasEstimate: GasEstimation | null = null

    const currentGasPrice = gasPriceOverride
      ? BigNumber.from(gasPriceOverride)
      : this.gasPriceOverride
      ? this.gasPriceOverride
      : await (await this.getSigner()).getGasPrice()
    const adjustedGasPrice = currentGasPrice.mul(110).div(100) // Increase by 10%

    if (estimateGas) {
      try {
        this.logger.log(`Estimating gas cost for deployment...`, `⛽`)
        const estimatedGas = await ethers.provider.estimateGas(contractFactory.getDeployTransaction(...params))
        const ethCost = ethers.utils.formatEther(adjustedGasPrice.mul(estimatedGas))
        gasEstimate = {
          gasLimit: estimatedGas.toString(),
          gasPriceWei: adjustedGasPrice.toString(),
          gasPriceGei: ethers.utils.formatUnits(adjustedGasPrice, 'gwei'),
          ethCost,
        }
        this.logger.log(`Estimated gas cost for deployment: ${estimatedGas.toString()}`, `⛽`)
        this.logger.log(
          `Estimated gas price: ${ethers.utils.formatUnits(adjustedGasPrice.toString(), 'gwei')} gwei`,
          `⛽`,
        )
        this.logger.log(`Estimated cost: ${ethCost} ETH`, `⛽`)
      } catch (error) {
        this.logger.error(`Failed to estimate gas cost: ${error}`)
      }
    }

    // Check if the last parameter is an options object and merge with nonce
    const lastParam = params[params.length - 1]
    const isOptionsObject = typeof lastParam === 'object' && lastParam !== null && !Array.isArray(lastParam)
    const deployOptions = isOptionsObject ? lastParam : {}

    // Retry deployment if nonce is already used
    while (deployAttempt < this.maxDeployRetries) {
      try {
        const nextNonce = await this.getNextNonce()
        const mergedOptions = { ...deployOptions, nonce: nextNonce }
        params = (isOptionsObject ? params.slice(0, -1).concat(mergedOptions) : params) as Parameters<CF['deploy']>
        this.logger.log(`Attempting to deploy ${name} with nonce: ${nextNonce}`, `🚀`)
        contractInstance = (await contractFactory.connect(await this.getSigner()).deploy(...params, {
          gasPrice: adjustedGasPrice,
        })) as Awaited<ReturnType<CF['deploy']>>
        await contractInstance.deployed()
        this.logger.success(`Deployed ${name} at ${contractInstance.address}`)
        break // Break out of loop if successful
      } catch (error: any) {
        // Handling Nonce errors here:
        if (error.code === 'NONCE_EXPIRED' || error.message.includes('already known')) {
          const seconds = 1
          deployAttempt++
          this.logger.warn(
            `${deployAttempt}/${this.maxDeployRetries}: Nonce already used, retrying with a new nonce in ${seconds} seconds...`,
          )
          // Optionally, wait for a short period before retrying
          await new Promise((resolve) => setTimeout(resolve, seconds * 1000))
        } else {
          throw error
        }
      }
    }

    if (!contractInstance) {
      throw new Error(`Failed to deploy ${name} after ${deployAttempt} attempts.`)
    }

    try {
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    } catch {
      params.pop()
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    }

    const deployedContractDetails: DeployedContractDetails = {
      name, // Original name for verification
      snapshotName, // Unique name from getNextContract
      address: contractInstance.address,
      encodedConstructorArgs,
      constructorArguments: params,
      verificationCommand: '',
      gasEstimate,
    }

    try {
      deployedContractDetails.verificationCommand = this.getVerificationCommand(deployedContractDetails)
    } catch (e: any) {
      console.error(
        `Failed to generate verification command for deployedContractDetails: ${deployedContractDetails} with error: ${e}`,
      )
    }

    // Save to snapshot
    this.snapshotManager.saveContract(deployedContractDetails)

    // Add prominent logging of the contract address
    this.logger.logHeader(`${name} Deployed Successfully`, `✅`)
    this.logger.log(`Deployment Address: ${contractInstance.address}`, `🏠`)
    this.logger.log(`Network: ${network.name}`, `🌐`)

    await this.delay()
    return contractInstance
  }

  // -----------------------------------------------------------------------------------------------
  // Upgradeable Deployments
  // -----------------------------------------------------------------------------------------------

  /**
   * Deploys an upgradeable contract by name.
   * @param contractName - The name of the contract.
   * @param initializerParams - The parameters for initializing the contract.
   * @param options - The deployment options.
   * @param factoryOptions - The factory options for the contract.
   */
  // TODO: These functions don't seem to be using all of the options. (i.e., seems to be able to pass a ContractFactory and Implementation)
  async deployUpgradeableContract<CF extends ContractFactory>(
    contractName: string,
    initializerParams: Parameters<ReturnType<CF['attach']>['initialize']>,
    options: UpgradeableDeployOptions = {},
    factoryOptions: FactoryOptions = {},
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>> {
    const factory = (await ethers.getContractFactory(contractName, factoryOptions)) as CF
    // NOTE: initializerParams as any, TS complaining even though it's typed in the options
    return this.deployUpgradeableContractFromFactory(factory, initializerParams as any, {
      name: contractName,
      ...options,
    })
  }

  /**
   * Deploys an upgradeable contract by name, skipping initialization.
   * @param contractName - The name of the contract.
   * @param options - The deployment options.
   */
  async deployUpgradeableContract_SkipInitialize<CF extends ContractFactory>(
    contractName: string,
    options: Omit<UpgradeableDeployOptions, 'skipInitialization'> = {},
    factoryOptions: FactoryOptions = {},
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>> {
    const factory = (await ethers.getContractFactory(contractName, factoryOptions)) as CF
    return this.deployUpgradeableContractFromFactory(factory, [], {
      name: contractName,
      skipInitialization: true,
      ...options,
    })
  }

  /**
   * Deploys an upgradeable contract from a contract factory.
   * @param contractFactory - The contract factory instance.
   * @param initializerParams - The parameters for initializing the contract.
   * @param options - The deployment options.
   */
  async deployUpgradeableContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    initializerParams: InitializerParams<CF>,
    options: UpgradeableDeployOptions,
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>> {
    const { name: implementationName = 'Contract', skipInitialization = false } = options
    let { proxyAdminOwner, proxyAdminAddress } = options

    this.logger.log(`Deploying upgradeable ${implementationName}`, `🚀`)
    const implementation = await this.deployContractFromFactory(contractFactory, [] as any, {
      name: implementationName,
    })

    // Deploy the ProxyAdmin if not provided
    let proxyAdmin
    if (!proxyAdminAddress) {
      proxyAdminOwner = proxyAdminOwner ? proxyAdminOwner : await (await this.getSigner()).getAddress()
      this.logger.warn(
        `deployUpgradeableContract:: Proxy Admin not passed. Deploying ProxyAdmin with owner: ${proxyAdminOwner}`,
      )
      proxyAdmin = await this.deployProxyAdmin(proxyAdminOwner)
      proxyAdminAddress = proxyAdmin.address
    } else {
      proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as ProxyAdmin
      if (proxyAdminOwner) {
        this.logger.warn(
          `deployUpgradeableContract:: Proxy Admin passed. ProxyAdminOwner: ${proxyAdminOwner} will NOT be used`,
        )
      }
    }

    let initializerData = '0x'
    if (skipInitialization) {
      this.logger.log(`deployUpgradeableContract:: skipInitialization == true, skipping initialization`, '⚠️')
    } else {
      // Encode the initializer function call
      initializerData = contractFactory.interface.encodeFunctionData('initialize', initializerParams)
    }

    const transparentProxy = await this.deployTransparentProxy(
      implementation.address,
      proxyAdminAddress as string,
      initializerData,
      implementationName,
    )
    // Return the proxy contract as an instance of the implementation contract
    const implementationThroughProxy = (await contractFactory.attach(transparentProxy.address)) as ReturnType<
      CF['attach']
    >

    // Add prominent logging of the deployments
    this.logger.logHeader(`Transparent Proxy Deployed Successfully`, `✅`)
    this.logger.log(`Contract: ${implementationName}`, `📝`)
    this.logger.log(`Proxy Address: ${transparentProxy.address}`, `🏠`)
    this.logger.log(`Implementation Address: ${implementation.address}`, `🏢`)
    this.logger.log(`ProxyAdmin Address: ${proxyAdminAddress}`, `🔑`)
    this.logger.log(`Network: ${network.name}`, `🌐`)

    return {
      implementationThroughProxy,
      proxyAdmin,
      proxyAdminOwner: proxyAdminOwner || '',
      transparentProxy,
      implementation,
      initialized: skipInitialization,
    }
  }

  // -----------------------------------------------------------------------------------------------
  // Proxy + ProxyAdmin Deployments
  // -----------------------------------------------------------------------------------------------

  /**
   * Deploys a ProxyAdmin contract.
   * @param adminAddress - The address of the admin.
   * @returns - A promise that resolves to the deployed ProxyAdmin contract instance.
   */
  async deployProxyAdmin(adminAddress: string): Promise<ProxyAdmin> {
    this.logger.log(`Deploying Proxy Admin`, `🚀`)
    const ProxyAdminFactory = (await ethers.getContractFactory('ProxyAdmin')) as ProxyAdmin__factory
    // NOTE: in OZv5, the adminAddress is passed in as the constructor argument, but I prefer the OZv4 version because of the helper read functions
    // The ProxyAdmin contract in this repo has been updated to use the constructor argument for the admin address to be able to do CREATE2 deployments
    const proxyAdmin = await this.deployContractFromFactory(ProxyAdminFactory, [adminAddress], { name: 'ProxyAdmin' })

    // Add prominent logging of the ProxyAdmin deployment
    this.logger.logHeader(`ProxyAdmin Deployed Successfully`, `✅`)
    this.logger.log(`ProxyAdmin Address: ${proxyAdmin.address}`, `🔑`)
    this.logger.log(`Admin Owner: ${adminAddress}`, `👤`)
    this.logger.log(`Network: ${network.name}`, `🌐`)

    return proxyAdmin
  }

  /**
   * Deploys a TransparentUpgradeableProxy contract.
   * @param implementationAddress - The address of the implementation contract.
   * @param proxyAdminAddress - The address of the ProxyAdmin contract.
   * @param initializerData - The data for initializing the contract.
   * @returns - A promise that resolves to the deployed TransparentUpgradeableProxy contract instance.
   */
  async deployTransparentProxy(
    implementationAddress: string,
    proxyAdminAddress: string,
    initializerData: string,
    implementationContractName: string,
  ): Promise<TransparentUpgradeableProxy> {
    try {
      const namedProxyName = `${implementationContractName}Proxy`
      this.logger.log(`Checking for named proxy: ${namedProxyName}`, `🔍`)
      const NamedProxyFactory = (await ethers.getContractFactory(
        namedProxyName,
      )) as TransparentUpgradeableProxy__factory
      this.logger.log(`Found named proxy contract: ${namedProxyName}`, `✅`)
      const namedProxy = await this.deployContractFromFactory(
        NamedProxyFactory,
        [implementationAddress, proxyAdminAddress, initializerData],
        { name: namedProxyName },
      )
      return namedProxy
    } catch (error) {
      this.logger.log(`No named proxy found for ${implementationContractName}, using TransparentUpgradeableProxy`, `i️`)
    }

    this.logger.log(`Deploying Transparent Proxy`, `🚀`)
    const TransparentUpgradeableProxyFactory = (await ethers.getContractFactory(
      'TransparentUpgradeableProxy',
      this.signer,
    )) as TransparentUpgradeableProxy__factory
    const transparentProxy = await this.deployContractFromFactory(
      TransparentUpgradeableProxyFactory,
      [implementationAddress, proxyAdminAddress, initializerData],
      { name: 'TransparentUpgradeableProxy' },
    )

    // Add prominent logging of the proxy deployment
    this.logger.logHeader(`TransparentProxy Deployed Successfully`, `✅`)
    this.logger.log(`Implementation: ${implementationContractName}`, `📝`)
    this.logger.log(`Proxy Address: ${transparentProxy.address}`, `🏠`)
    this.logger.log(`Implementation Address: ${implementationAddress}`, `🏢`)
    this.logger.log(`ProxyAdmin Address: ${proxyAdminAddress}`, `🔑`)
    this.logger.log(`Network: ${network.name}`, `🌐`)

    return transparentProxy
  }

  // -----------------------------------------------------------------------------------------------
  // Verification
  // -----------------------------------------------------------------------------------------------

  /**
   * Verifies all the contracts in the deployedContracts array without compiling.
   */

  async verifyContract(snapshotName: string): Promise<void> {
    if (network.name === 'hardhat' || this.snapshotManager.isContractVerified(snapshotName)) {
      return
    }

    const contract = this.snapshotManager.getContract(snapshotName)
    if (!contract) return

    this.logger.logHeader(`Verifying ${snapshotName} at ${contract.address}`, ` 🔍`)
    try {
      await run('verify:verify', {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      })
      this.snapshotManager.markContractVerified(snapshotName)
      this.logger.success(`Verified ${snapshotName} at ${contract.address}`)
    } catch (error) {
      this.logger.error(`Failed trying to verify ${snapshotName} at ${contract.address}: ${error}`)
    }
  }

  async verifyContracts(): Promise<void> {
    if (network.name === 'hardhat') {
      this.logger.log('Skipping contract verification on hardhat network.', '⚠️')
      return
    }

    const contracts = this.snapshotManager.getAllContracts()
    for (const [name] of Object.entries(contracts)) {
      await this.verifyContract(name)
    }
  }

  /**
   * Returns the verification command for a smart contract deployment.
   * @param contractDetails - The contract details object.
   * @returns - The verification command string.
   */
  getVerificationCommand(contractDetails: DeployedContractDetails): string {
    const { address, constructorArguments } = contractDetails
    const constructorArgsString = constructorArguments.map((arg) => `'${arg.toString()}'`).join(' ')
    return `npx hardhat verify --network ${network.name} ${address} ${constructorArgsString}`
  }
}
