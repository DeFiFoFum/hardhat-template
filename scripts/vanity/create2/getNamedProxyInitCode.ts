import { ethers } from 'hardhat'
import { logger } from '../../../hardhat/utils'
import { CREATE2_DEPLOYER } from '../../deploy/CREATE2'
import { CreateXDeployer } from '../../../lib/evm/create2/CreateXDeployer'
import fs from 'fs'
import path from 'path'
import {
  formatNamedProxyContractName,
  SupportedNamedProxyContractNames,
} from '../../../lib/evm/proxy/namedProxy.config'

async function getNamedProxyInitCode(contractName: SupportedNamedProxyContractNames) {
  const proxyContractName = await formatNamedProxyContractName(contractName)

  logger.logHeader(`Getting ${proxyContractName} init code`, '🍭')
  logger.log(`Using Create2Deployer Address: ${CREATE2_DEPLOYER}`, '🏭')

  // -------------------------------------------------------------------------------------------------------------------
  // Network Setup and Configuration
  // -------------------------------------------------------------------------------------------------------------------

  // const initialNetwork = network.name as DeployableNetworks
  // // Only fork after we've verified the addresses match
  // const currentNetwork = await forkIfHardhat(initialNetwork, 'base') // Fork if on hardhat network

  const [deployer] = await ethers.getSigners()
  if (deployer.address !== CREATE2_DEPLOYER) {
    throw new Error(`Deployer ${deployer.address} MUST be the CREATE2 Deployer: ${CREATE2_DEPLOYER}`)
  }
  const createXDeployer = await CreateXDeployer.create(ethers, deployer)
  const { bytecode, bytecodeHash } = await createXDeployer.getProxyBytecodeWithConstructorArgs(proxyContractName)

  const output = {
    contractName: proxyContractName,
    deployerAddress: deployer.address,
    createXAddress: createXDeployer.createX.address,
    bytecode,
    bytecodeHash,
  }

  const outputPath = path.join(__dirname, `${proxyContractName}-bytecode.json`)
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
  logger.log(`Saved init code output to ${outputPath}`, '💾')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
getNamedProxyInitCode('LockUpgradeableProxy').catch((error) => {
  console.error(error)
  process.exitCode = 1
})
