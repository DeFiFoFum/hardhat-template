// https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-etherscan#using-programmatically

import { ContractFactory } from 'ethers'
import { network, run } from 'hardhat'
import { logger } from '../../hardhat/utils/logger'
import fs from 'fs'

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

export class DeployManager {
  baseDir: string
  contracts: {
    name: string
    address: string
    encodedConstructorArgs: string
    constructorArguments: any[]
  }[] = []

  constructor(baseDir = __dirname + `/../../deployments`) {
    logger.log(`Setting up DeployManager. Your simple and friendly contract deployment, uhhh, manager.`, `👋🤓`)
    this.baseDir = baseDir
    logger.log(`Deployment information will be saved in: ${baseDir}`, `💾`)
  }

  async deployContractFromFactory<C extends ContractFactory>(
    contract: C,
    params: Parameters<C['deploy']>,
    name = 'Contract' // TODO: Provide better fallback naming
  ): Promise<ReturnType<C['deploy']>> {
    logger.log(`Deploying ${name}`, `🚀`)

    // TODO: Can pass signer await contract.connect(signer).deploy
    const contractInstance = await contract.deploy(...params)
    let encodedConstructorArgs = ''
    try {
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    } catch {
      params.pop()
      encodedConstructorArgs = contractInstance.interface.encodeDeploy(params)
    }
    await contractInstance.deployed()

    logger.success(`Deployed ${name} at ${contractInstance.address}`)
    // Save deployment details
    const deployDetails = {
      name: name,
      address: contractInstance.address,
      encodedConstructorArgs,
      constructorArguments: params,
    }

    this.contracts.push(deployDetails)
    this.saveContractsToFile()

    return contractInstance as ReturnType<C['deploy']>
  }

  async verifyContracts() {
    for (const contract of this.contracts) {
      logger.log(`Verifying ${contract.name} at ${contract.address}`, `➡️`)
      try {
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

  saveContractsToFile() {
    logger.log(`Saving contract details to file.`, `➡️`)

    const paramsString = JSON.stringify(this.contracts, null, 2) // The 'null, 2' arguments add indentation for readability
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
