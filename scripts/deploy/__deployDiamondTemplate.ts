import hre, { ethers, network } from 'hardhat'
import { DeployManager } from './DeployManager/DeployManager'
import { DeployDiamondManager } from './DeployManager/DeployDiamondManager/DeployDiamondManager'
import { logger } from '../../hardhat/utils/logger'
import { getDeployConfig, DeployableNetworks, saveDeploymentOutput } from './deploy.config'
import { forkIfHardhat } from './utils/forkDeployHelper'

/**
 * Configuration for diamond deployment
 * Customize these values for your specific diamond implementation
 */
const config = {
  // Core facets that should be included in every diamond
  coreFacets: ['DiamondLoupeFacet', 'OwnershipFacet'],

  // Additional facets specific to your diamond
  customFacets: [
    // Add your custom facets here
    // e.g. 'StorageFacet', 'ActionFacet', etc.
  ],

  // Arguments for diamond initialization
  // Remove if no initialization is needed
  initializerArgs: [
    // Add initialization arguments here
    // These will be passed to the DiamondInit.init() function
  ],
}

async function main() {
  try {
    logger.logHeader('Starting Diamond Deployment', '💎')

    // Network Setup and Configuration
    const initialNetwork = network.name as DeployableNetworks
    const currentNetwork = await forkIfHardhat(initialNetwork, 'hardhat')
    logger.log(`Deploying on network: ${currentNetwork}`, '🌐')

    // Setup managers
    const [deployer] = await ethers.getSigners()
    const deployManager = await DeployManager.create({ signer: deployer })
    const deployDiamondManager = new DeployDiamondManager(deployManager)

    // Get deployment configuration
    const deploymentVariables = await getDeployConfig(currentNetwork, {
      accountOverrides: {},
      contractOverrides: {},
    })
    logger.log(`Deploying with account: ${deployer.address}`, '👤')

    // Combine all facets
    const allFacets = [...config.coreFacets, ...config.customFacets]

    // Deploy diamond with all facets
    const { diamondAddress, facetNameToAddress } = await deployDiamondManager.deployDiamondBase({
      owner: deployer.address,
      facetNames: allFacets,
      initializerArgs: undefined,
    })

    // Log deployment details
    logger.success('Diamond Deployment Complete!')
    logger.log(`Diamond address: ${diamondAddress}`, '📍')
    logger.log('Facet Addresses:', '📋')
    for (const [name, address] of Object.entries(facetNameToAddress)) {
      logger.log(`  ${name}: ${address}`, '📄')
    }

    // Save deployment output
    const output = {
      deployedContracts: {
        diamondAddress,
        facetNameToAddress,
      },
      deploymentVariables,
      deployer: deployer.address,
    }

    try {
      await saveDeploymentOutput(initialNetwork, output, true, true)
    } catch (e) {
      logger.error(`Error saving deployment output to file: ${e}`)
    }

    // Verify contracts
    logger.log('Verifying contracts...', '🔍')
    await deployManager.verifyContracts()
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Deployment failed: ${error.message}`, error)
    } else {
      const wrappedError = new Error(String(error))
      logger.error(`Deployment failed: ${wrappedError.message}`, wrappedError)
    }
    throw error
  }
}

// Execute deployment
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}

// Export for testing
export default main
