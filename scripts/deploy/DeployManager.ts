// https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-etherscan#using-programmatically
import { BigNumber, BigNumberish, Contract, ContractFactory, Signer, utils } from 'ethers'
import { network, run, ethers } from 'hardhat'
import { logger } from '../../hardhat/utils/logger'
import fs from 'fs'
import { DEPLOYMENTS_BASE_DIR } from './deploy.config'
import {
  ProxyAdmin,
  ProxyAdmin__factory,
  TransparentUpgradeableProxy,
  TransparentUpgradeableProxy__factory,
} from '../../typechain-types'

/*
This is a TypeScript class called `DeployManager` that is used to deploy contracts, verify them and save the deployment details to a file. The class has the following methods:

- `deployContractFromFactory`: This method deploys a contract from a given ContractFactory instance by calling its `deploy` method with the provided parameters. It then saves the deployment details to an array of objects called `contracts` and calls the `saveContractsToFile` method to save the details to a file.
- `verifyContracts`: This method verifies all the contracts in the `contracts` array by calling the Hardhat `verify:verify` task with the contract's address and constructor arguments.
- `saveContractsToFile`: This method saves the deployment details of all the contracts in the `contracts` array to a JavaScript file with a name that includes the current date and network name.

The `DeployManager` class imports the following modules:

- `ethers`: A library for interacting with Ethereum.
- `hardhat`: A development environment for building, testing, and deploying smart contracts.
- `logger`: A custom logger module for logging messages to the console.
- `fs`: A Node.js module for working with the file system.

The class also defines a property called `baseDir` which is set to the current directory by default, and an array of objects called `contracts` which stores the deployment details of all the contracts deployed using this class.
*/

// -----------------------------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------------------------

interface DeployedContractDetails {
  name: string
  address: string
  encodedConstructorArgs: string
  constructorArguments: any[]
  verificationCommand: string
}

interface ContractFromFactoryOptions {
  name?: string
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
 *
 * - Owner: The external owner/administrator that has the rights to upgrade the proxy by interacting with the ProxyAdmin.
 * - ProxyAdmin: The contract that administers the proxy contract, capable of upgrading it.
 *      The ProxyAdmin CANNOT interact with the implementation contract directly.
 * - TransparentUpgradeableProxy: The proxy contract that delegates calls to the implementation contract.
 * - Implementation Contract (Logic): The contract containing the logic, which can be upgraded.
 */
interface UpgradeableContractFromFactoryOptions extends ContractFromFactoryOptions {
  // Used to skip initializer when deploying upgradeable contracts
  skipInitialization?: boolean
  // Skip deploying proxy admin and use existing one
  proxyAdminAddress?: string
  // Proxy admin owner (Only used if proxyAdminAddress is not provided)
  proxyAdminOwner?: string
}

type UpgradeableContractFromFactoryOptions_SkipInitialize = Omit<
  UpgradeableContractFromFactoryOptions,
  'skipInitialization'
>

/**
 * A class to deploy contracts, verify them and save the deployment details to a file.
 *
 * See docs at top of file for more details.
 */
export class DeployManager {
  private signer?: Signer
  baseDir: string
  deployedContracts: DeployedContractDetails[] = []

  /**
   * Private constructor to initialize the DeployManager class.
   *
   * @param signer - The signer instance.
   * @param baseDir - The base directory for saving deployment details.
   */
  private constructor(signer?: Signer, baseDir = DEPLOYMENTS_BASE_DIR) {
    logger.log(`Setting up DeployManager. Your simple and friendly contract deployment, uhhh, manager.`, `👋🤓`)
    this.baseDir = baseDir
    this.signer = signer ? signer : undefined
    logger.log(`Deployment information will be saved in: ${baseDir}`, `💾`)
  }

  /**
   * Creates an instance of the DeployManager class.
   * @param signer - The signer instance.
   * @param baseDir - The base directory for saving deployment details.
   * @returns - A promise that resolves to an instance of the DeployManager class.
   */
  static async create(signer?: Signer, baseDir = DEPLOYMENTS_BASE_DIR): Promise<DeployManager> {
    const instance = new DeployManager(signer, baseDir)
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
    if (!this.signer) {
      // NOTE: Defaults to the first signer if not provided
      return (await ethers.getSigners())[0]
    }
    return this.signer
  }

  /**
   * Sets the signer instance.
   * @param signer - The signer instance.
   */
  setSigner(signer: Signer) {
    this.signer = signer
  }

  // -----------------------------------------------------------------------------------------------
  // Deployments
  // -----------------------------------------------------------------------------------------------

  /**
   * Deploys a contract from name.
   * @param contractName - The name of the contract.
   * @param params - The parameters for the contract's deploy method.
   * @returns - A promise that resolves to the deployed contract instance.
   */
  async deployContract<CF extends ContractFactory>(
    contractName: string,
    params: Parameters<CF['deploy']>,
    options: {} = {}
  ): Promise<ReturnType<CF['deploy']>> {
    const factory = (await ethers.getContractFactory(contractName)) as CF
    return this.deployContractFromFactory(factory, params, { name: contractName })
  }

  /**
   * Deploys an upgradeable contract by name.
   * @param contractName - The name of the contract.
   * @param initializerParams - The parameters for initializing the contract.
   * @param options - The deployment options.
   */
  async deployContractFromFactory<CF extends ContractFactory>(
    contractFactory: CF,
    params: Parameters<CF['deploy']>, // NOTE: For upgradeable proxy
    {
      name = 'Contract', // Default contract name if not provided
    }: ContractFromFactoryOptions = {}
  ): Promise<ReturnType<CF['deploy']>> {
    logger.logHeader(`Deploying ${name}`, `🚀`)
    // Get the balance of the account before deployment
    const balanceBefore = await this.signer?.getBalance()
    const balanceBeforeInEther = utils.formatEther(balanceBefore || 0)
    logger.log(`Balance before deployment: ${balanceBeforeInEther} ETH`, `💰`)
    // Deploy contract with signer if available
    let encodedConstructorArgs = ''
    const contractInstance = await contractFactory.connect(await this.getSigner()).deploy(...params)
    try {
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    } catch {
      // NOTE: The encode fails when the deploy options are passed in. So we pop the last element and try again.
      params.pop()
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    }
    await contractInstance.deployed()

    logger.success(`Deployed ${name} at ${contractInstance.address}`)
    // Save deployment details
    const deployedContractDetails: DeployedContractDetails = {
      name: name,
      address: contractInstance.address,
      encodedConstructorArgs,
      constructorArguments: params,
      verificationCommand: '',
    }

    try {
      deployedContractDetails.verificationCommand = this.getVerificationCommand(deployedContractDetails)
    } catch (e: any) {
      console.error(
        `Failed to generate verification command for deployedContractDetails: ${deployedContractDetails} with error: ${e}`
      )
    }

    this.deployedContracts.push(deployedContractDetails)
    this.saveContractsToFile()

    return contractInstance as ReturnType<CF['deploy']>
  }

  // -----------------------------------------------------------------------------------------------
  // Upgradeable Deployments
  // -----------------------------------------------------------------------------------------------

  /**
   * Deploys an upgradeable contract by name.
   * @param contractName - The name of the contract.
   * @param initializerParams - The parameters for initializing the contract.
   * @param options - The deployment options.
   */
  async deployUpgradeableContract<CF extends ContractFactory>(
    contractName: string,
    // NOTE: The main deploy method passes in constructors, but this passes in initializer params after deployment
    initializerParams: Parameters<ReturnType<CF['attach']>['initialize']>,
    options: UpgradeableContractFromFactoryOptions = {}
  ): Promise<{
    implementationThroughProxy: ReturnType<CF['attach']> // Returns the interface of the implementation, at the proxy address.
    proxyAdmin: ProxyAdmin
    transparentProxy: TransparentUpgradeableProxy
    implementation: ReturnType<CF['deploy']>
  }> {
    const factory = (await ethers.getContractFactory(contractName)) as CF
    return this.deployUpgradeableContractFromFactory(factory, initializerParams, { name: contractName, ...options })
  }

  /**
   * Deploys an upgradeable contract by name, skipping initialization.
   * @param contractName - The name of the contract.
   * @param options - The deployment options.
   */
  async deployUpgradeableContract_SkipInitialize<CF extends ContractFactory>(
    contractName: string,
    options: UpgradeableContractFromFactoryOptions_SkipInitialize = {}
  ): Promise<{
    implementationThroughProxy: ReturnType<CF['attach']> // Returns the interface of the implementation, at the proxy address.
    proxyAdmin: ProxyAdmin
    transparentProxy: TransparentUpgradeableProxy
    implementation: ReturnType<CF['deploy']>
  }> {
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
  async deployUpgradeableContractFromFactory<
    CF extends ContractFactory,
    O extends UpgradeableContractFromFactoryOptions
  >(
    contractFactory: CF,
    initializerParams: O['skipInitialization'] extends true ? [] : Parameters<ReturnType<CF['attach']>['initialize']>,
    options: O
  ): Promise<{
    implementationThroughProxy: ReturnType<CF['attach']>
    proxyAdmin: ProxyAdmin
    proxyAdminOwner: string
    transparentProxy: TransparentUpgradeableProxy
    implementation: ReturnType<CF['deploy']>
    initialized: boolean
  }> {
    const { name = 'Contract', skipInitialization = false } = options
    let { proxyAdminOwner, proxyAdminAddress } = options
    logger.log(`Deploying upgradeable ${name}`, `🚀`)

    // Deploy the logic/implementation contract
    // NOTE: Assumes that no constructor arguments are passed in
    const implementation = await this.deployContractFromFactory(contractFactory, [] as any, {
      name,
    })

    // Deploy the ProxyAdmin if not provided
    let proxyAdmin
    if (!proxyAdminAddress) {
      proxyAdminOwner = proxyAdminOwner ? proxyAdminOwner : await (await this.getSigner()).getAddress()
      logger.log(
        `deployUpgradeableContract:: Proxy Admin not passed. Deploying ProxyAdmin with owner: ${proxyAdminOwner}`,
        '⚠️'
      )
      proxyAdmin = await this.deployProxyAdmin(proxyAdminOwner)
      proxyAdminAddress = proxyAdmin.address
    } else {
      proxyAdmin = (await ethers.getContractAt('ProxyAdmin', proxyAdminAddress)) as ProxyAdmin
      if (proxyAdminOwner) {
        logger.log(
          `deployUpgradeableContract:: Proxy Admin passed. ProxyAdminOwner: ${proxyAdminOwner} will NOT be used`,
          '⚠️'
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

    // Deploy the TransparentUpgradeableProxy contract
    const transparentProxy = await this.deployTransparentProxy(
      implementation.address,
      proxyAdminAddress,
      initializerData
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
    const proxyAdmin = await this.deployContractFromFactory(ProxyAdminFactory, [], { name: 'ProxyAdmin' })
    // NOTE: in OZv5, the adminAddress is passed in as the constructor argument, but I prefer the OZv4 version because of the helper read functions
    await proxyAdmin.transferOwnership(adminAddress)
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
    initializerData: string
  ): Promise<TransparentUpgradeableProxy> {
    logger.log(`Deploying Transparent Proxy`, `🚀`)
    const TransparentUpgradeableProxyFactory = (await ethers.getContractFactory(
      'TransparentUpgradeableProxy',
      this.signer
    )) as TransparentUpgradeableProxy__factory
    const transparentProxy = await this.deployContractFromFactory(
      TransparentUpgradeableProxyFactory,
      [implementationAddress, proxyAdminAddress, initializerData],
      {
        name: 'TransparentUpgradeableProxy',
      }
    )

    return transparentProxy
  }

  // -----------------------------------------------------------------------------------------------
  // Verification
  // -----------------------------------------------------------------------------------------------

  /**
   * Verifies all the contracts in the deployedContracts array.
   */
  async verifyContracts() {
    for (const contract of this.deployedContracts) {
      logger.logHeader(`Verifying ${contract.name} at ${contract.address}`, ` 🔍`)
      try {
        // https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-etherscan#using-programmatically
        await run('verify:verify', {
          address: contract.address,
          constructorArguments: contract.constructorArguments,
        })
        logger.success(`Verified ${contract.name} at ${contract.address}`)
      } catch (error) {
        logger.error(`Failed trying to verify ${contract.name} at ${contract.address}: ${error}`)
      }
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
    const verificationCommand = `npx hardhat verify --network ${network.name} ${address} ${constructorArgsString}`
    return verificationCommand
  }

  /**
   * Saves contract details to the deploy directory.
   */
  saveContractsToFile() {
    logger.log(`Saving contract details to file.`, `💾`)

    const paramsString = JSON.stringify(this.deployedContracts, null, 2) // The 'null, 2' arguments add indentation for readability
    // Write the string to a file
    const dateString = new Date().toISOString().slice(0, 10).replace(/-/g, '') // e.g. 20230330
    const networkName = network.name

    const filePath = this.baseDir + `/${dateString}-${networkName}-deployment.js`
    try {
      fs.writeFileSync(filePath, `module.exports = ${paramsString};`)
      logger.success(`Contract details saved to ${filePath}!`)
    } catch (error) {
      logger.error(`Failed saving contract details to file: ${error}`)
    }
  }
}
