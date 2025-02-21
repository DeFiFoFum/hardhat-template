import { BigNumber, BigNumberish, Contract, ContractFactory, Signer, utils } from 'ethers'
import { network, run, ethers } from 'hardhat'
import { logger } from '../../../hardhat/utils/logger'
import { DEPLOYMENTS_BASE_DIR } from '../deploy.config'
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy__factory,
} from '../../../typechain-types'
import { FactoryOptions } from 'hardhat/types'
import { ISnapshotManager } from './SnapshotManager/ISnapshotManager'
import { FileSystemSnapshotManager } from './SnapshotManager/FileSystemSnapshotManager'
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

// -----------------------------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------------------------

interface DeployManagerConstructor {
  signer?: Signer
  baseDir?: string
  gasPriceOverride?: BigNumberish
  snapshotManager?: ISnapshotManager
}

/**
 * Version 3.2.0
 * A class to deploy contracts, verify them and save the deployment details to a file.
 *
 * See docs at top of file for more details.
 */
export class DeployManager implements IDeployManager {
  private signer?: Signer
  private baseDir: string
  private gasPriceOverride?: BigNumber
  private maxDeployRetries: number = 20
  readonly snapshotManager: ISnapshotManager

  /**
   * Private constructor to initialize the DeployManager class.
   *
   * @param signer - The signer instance.
   * @param baseDir - The base directory for saving deployment details.
   */
  private constructor({
    signer,
    baseDir = DEPLOYMENTS_BASE_DIR,
    gasPriceOverride,
    snapshotManager,
  }: DeployManagerConstructor) {
    logger.log(`Setting up DeployManager. Your simple and friendly contract deployment manager.`, `👋🤓`)
    this.baseDir = baseDir
    this.signer = signer
    if (gasPriceOverride) {
      this.gasPriceOverride = BigNumber.from(gasPriceOverride)
    }
    this.snapshotManager = snapshotManager || new FileSystemSnapshotManager(baseDir)
    logger.log(`Deployment information will be saved in: ${this.baseDir}`, `💾`)
  }

  /**
   * Creates an instance of the DeployManager class.
   * @param signer - The signer instance.
   * @param baseDir - The base directory for saving deployment details.
   * @returns - A promise that resolves to an instance of the DeployManager class.
   */
  static async create({
    signer,
    baseDir = DEPLOYMENTS_BASE_DIR,
    gasPriceOverride,
    snapshotManager,
  }: DeployManagerConstructor): Promise<DeployManager> {
    const instance = new DeployManager({ signer, baseDir, gasPriceOverride, snapshotManager })
    if (instance.signer) {
      logger.log(`Signer address: ${await instance.signer.getAddress()}`, `🖊️`)
    }
    return instance
  }

  /**
   * Gets the signer instance.
   * @returns - A promise that resolves to a signer instance.
   */
  async getSigner(): Promise<Signer> {
    let signer = this.signer
    if (!signer) {
      // NOTE: Defaults to the first signer if not provided
      signer = (await ethers.getSigners())[0]
    }

    if (!signer) {
      throw new Error(logger.error(`Signer not available, please check your mnemonic/private key.`))
    }
    return signer
  }

  /**
   * Sets the signer instance.
   * @param signer - The signer instance.
   */
  setSigner(signer: Signer) {
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
  async deployContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    params: Parameters<CF['deploy']>,
    { name = 'Contract', estimateGas = true, gasPriceOverride }: BaseDeployOptions = {},
  ): Promise<ReturnType<CF['deploy']>> {
    // Get next contract name and check if it exists
    const { snapshotName, existingContract } = this.snapshotManager.getNextContract(name)
    if (existingContract) {
      logger.log(`Reusing previously deployed ${name} at ${existingContract.address}`, '♻️')
      return contractFactory.attach(existingContract.address) as ReturnType<CF['deploy']>
    }

    logger.logHeader(`Deploying ${name}`, `🚀`)
    const balanceBefore = await this.signer?.getBalance()
    const balanceBeforeInEther = utils.formatEther(balanceBefore || 0)
    logger.log(`Balance before deployment: ${balanceBeforeInEther} ETH`, `💰`)

    let encodedConstructorArgs = ''
    let contractInstance: Awaited<ReturnType<CF['deploy']>> | undefined = undefined
    let deployAttempt = 0
    let gasEstimate: GasEstimation | null = null

    if (estimateGas) {
      try {
        logger.log(`Estimating gas cost for deployment...`, `⛽`)
        const currentGasPrice = gasPriceOverride
          ? BigNumber.from(gasPriceOverride)
          : this.gasPriceOverride
          ? this.gasPriceOverride
          : await (await this.getSigner()).getGasPrice()
        const increasedGasPrice = currentGasPrice.mul(110).div(100) // Increase by 10%
        const estimatedGas = await ethers.provider.estimateGas(contractFactory.getDeployTransaction(...params))
        const ethCost = ethers.utils.formatEther(increasedGasPrice.mul(estimatedGas))
        gasEstimate = {
          gasLimit: estimatedGas.toString(),
          gasPriceWei: increasedGasPrice.toString(),
          gasPriceGei: ethers.utils.formatUnits(increasedGasPrice, 'gwei'),
          ethCost,
        }
        logger.log(`Estimated gas cost for deployment: ${estimatedGas.toString()}`, `⛽`)
        logger.log(`Estimated gas price: ${ethers.utils.formatUnits(increasedGasPrice.toString(), 'gwei')} gwei`, `⛽`)
        logger.log(`Estimated cost: ${ethCost} ETH`, `⛽`)
      } catch (error) {
        logger.error(`Failed to estimate gas cost: ${error}`)
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
        logger.log(`Attempting to deploy ${name} with nonce: ${nextNonce}`, `🚀`)
        contractInstance = (await contractFactory.connect(await this.getSigner()).deploy(...params)) as Awaited<
          ReturnType<CF['deploy']>
        >
        await contractInstance.deployed()
        logger.success(`Deployed ${name} at ${contractInstance.address}`)
        break // Break out of loop if successful
      } catch (error: any) {
        // Handling Nonce errors here:
        if (error.code === 'NONCE_EXPIRED' || error.message.includes('already known')) {
          const seconds = 1
          deployAttempt++
          logger.warn(
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
  ): Promise<UpgradeableDeployResult<ReturnType<CF['attach']>, Awaited<ReturnType<CF['deploy']>>>> {
    const factory = (await ethers.getContractFactory(contractName)) as CF
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

    logger.log(`Deploying upgradeable ${implementationName}`, `🚀`)
    const implementation = await this.deployContractFromFactory(contractFactory, [] as any, {
      name: implementationName,
    })

    // Deploy the ProxyAdmin if not provided
    let proxyAdmin
    if (!proxyAdminAddress) {
      proxyAdminOwner = proxyAdminOwner ? proxyAdminOwner : await (await this.getSigner()).getAddress()
      logger.warn(
        `deployUpgradeableContract:: Proxy Admin not passed. Deploying ProxyAdmin with owner: ${proxyAdminOwner}`,
      )
      proxyAdmin = await this.deployProxyAdmin(proxyAdminOwner)
      proxyAdminAddress = proxyAdmin.address
    } else {
      proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as ProxyAdmin
      if (proxyAdminOwner) {
        logger.warn(
          `deployUpgradeableContract:: Proxy Admin passed. ProxyAdminOwner: ${proxyAdminOwner} will NOT be used`,
        )
      }
    }

    let initializerData = '0x'
    if (skipInitialization) {
      logger.log(`deployUpgradeableContract:: skipInitialization == true, skipping initialization`, '⚠️')
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
    logger.log(`Deploying Proxy Admin`, `🚀`)
    const ProxyAdminFactory = (await ethers.getContractFactory('ProxyAdmin')) as ProxyAdmin__factory
    // NOTE: in OZv5, the adminAddress is passed in as the constructor argument, but I prefer the OZv4 version because of the helper read functions
    // The ProxyAdmin contract in this repo has been updated to use the constructor argument for the admin address to be able to do CREATE2 deployments
    const proxyAdmin = await this.deployContractFromFactory(ProxyAdminFactory, [adminAddress], { name: 'ProxyAdmin' })
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
      logger.log(`Checking for named proxy: ${namedProxyName}`, `🔍`)
      const NamedProxyFactory = (await ethers.getContractFactory(
        namedProxyName,
      )) as TransparentUpgradeableProxy__factory
      logger.log(`Found named proxy contract: ${namedProxyName}`, `✅`)
      const namedProxy = await this.deployContractFromFactory(
        NamedProxyFactory,
        [implementationAddress, proxyAdminAddress, initializerData],
        { name: namedProxyName },
      )
      return namedProxy
    } catch (error) {
      logger.log(`No named proxy found for ${implementationContractName}, using TransparentUpgradeableProxy`, `i️`)
    }

    logger.log(`Deploying Transparent Proxy`, `🚀`)
    const TransparentUpgradeableProxyFactory = (await ethers.getContractFactory(
      'TransparentUpgradeableProxy',
      this.signer,
    )) as TransparentUpgradeableProxy__factory
    const transparentProxy = await this.deployContractFromFactory(
      TransparentUpgradeableProxyFactory,
      [implementationAddress, proxyAdminAddress, initializerData],
      { name: 'TransparentUpgradeableProxy' },
    )

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

    logger.logHeader(`Verifying ${name} at ${contract.address}`, ` 🔍`)
    try {
      await run('verify:verify', {
        address: contract.address,
        constructorArguments: contract.constructorArguments,
      })
      this.snapshotManager.markContractVerified(snapshotName)
      logger.success(`Verified ${snapshotName} at ${contract.address}`)
    } catch (error) {
      logger.error(`Failed trying to verify ${snapshotName} at ${contract.address}: ${error}`)
    }
  }

  async verifyContracts(): Promise<void> {
    if (network.name === 'hardhat') {
      logger.log('Skipping contract verification on hardhat network.', '⚠️')
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
