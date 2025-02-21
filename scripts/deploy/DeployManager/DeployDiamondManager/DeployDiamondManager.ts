import { ethers } from 'hardhat'
import { DeployManager } from '../DeployManager'
import { logger } from '../../../../hardhat/utils/logger'
import {
  Diamond,
  Diamond__factory,
  DiamondCutFacet,
  DiamondCutFacet__factory,
  DiamondInit,
  DiamondInit__factory,
  IDiamondCut,
} from '../../../../typechain-types'
import { FacetCutAction, getSelectors } from './diamond'

interface DiamondDeploymentResult {
  diamondAddress: string
  facetNameToAddress: { [name: string]: string }
  diamondCut: DiamondCutFacet
  initAddress: string
}

export class DeployDiamondManager {
  private deployManager: DeployManager

  constructor(deployManager: DeployManager) {
    this.deployManager = deployManager
  }

  /**
   * Core deployment method that handles the full diamond deployment process
   */
  async deployDiamondBase(options: {
    owner: string
    facetNames: string[]
    // NOTE: Initializer args may be added in the future
    initializerArgs?: undefined
  }): Promise<DiamondDeploymentResult> {
    logger.logHeader('Deploying Diamond', '💎')
    const { owner, facetNames, initializerArgs } = options

    // Deploy DiamondCutFacet
    const diamondCutFacet = await this.deployDiamondCutFacet()

    // Deploy Diamond
    const diamondAddress = await this.deployCoreDiamond(owner, diamondCutFacet.address)

    // Deploy and add facets
    const { diamondCut, facetNameToAddress } = await this.deployAndAddFacets(diamondAddress, facetNames)

    const diamondInit = await this.deployDiamondInit(initializerArgs)
    await this.initializeDiamond(diamondAddress, diamondInit.address)

    // Verify deployment
    await this.verifyDiamondOwnership(diamondAddress, owner)

    logger.success(`Diamond deployed successfully at ${diamondAddress}`)
    logger.log(`Facet Addresses: ${JSON.stringify(facetNameToAddress, null, 2)}`, '💎')

    return {
      diamondAddress,
      diamondCut,
      facetNameToAddress,
      initAddress: diamondInit.address,
    }
  }

  /**
   * Deploy the DiamondCutFacet contract
   */
  async deployDiamondCutFacet(): Promise<DiamondCutFacet> {
    logger.log('Deploying DiamondCutFacet', '💎')
    const diamondCutFacet = await this.deployManager.deployContract<DiamondCutFacet__factory>('DiamondCutFacet', [])
    return diamondCutFacet
  }

  /**
   * Deploy the core Diamond contract
   */
  async deployCoreDiamond(owner: string, diamondCutAddress: string): Promise<string> {
    logger.log('Deploying Core Diamond', '💎')
    const diamond = await this.deployManager.deployContract<Diamond__factory>('Diamond', [owner, diamondCutAddress])
    return diamond.address
  }

  /**
   * Deploy and add multiple facets to a diamond
   */
  async deployAndAddFacets(
    diamondAddress: string,
    facetNames: string[],
  ): Promise<{ diamondCut: DiamondCutFacet; facetNameToAddress: { [name: string]: string } }> {
    logger.log(`Deploying and adding facets: ${facetNames.join(', ')}`, '💎')
    const facetNameToAddress: { [name: string]: string } = {}
    const cuts: IDiamondCut.FacetCutStruct[] = []

    for (const facetName of facetNames) {
      const Facet = await ethers.getContractFactory(facetName)
      const facet = await this.deployManager.deployContractFromFactory(Facet, [], {
        name: facetName,
      })
      facetNameToAddress[facetName] = facet.address

      cuts.push({
        facetAddress: facet.address,
        action: FacetCutAction.Add,
        functionSelectors: getSelectors(facet).signatures,
      })
    }

    // Add facets to diamond
    const diamondCut = (await ethers.getContractAt('IDiamondCut', diamondAddress)) as IDiamondCut
    logger.log(`Adding ${cuts.length} facets to diamond`, '💎')
    const tx = await diamondCut.diamondCut(cuts, ethers.constants.AddressZero, '0x')
    await tx.wait()
    logger.log('Facets added to diamond', '💎')

    return { diamondCut, facetNameToAddress }
  }

  /**
   * Deploy the DiamondInit contract for initialization
   */
  async deployDiamondInit(initializerArgs: undefined): Promise<DiamondInit> {
    logger.log('Deploying DiamondInit', '💎')
    const diamondInit = await this.deployManager.deployContract<DiamondInit__factory>('DiamondInit', [])
    // NOTE: Initializer args may be added in the future
    return diamondInit
  }

  /**
   * Initialize a diamond with provided arguments
   */
  private async initializeDiamond(diamondAddress: string, initAddress: string /*initArgs: BytesLike*/): Promise<void> {
    logger.log('Initializing diamond', '💎')
    const diamondInit = await ethers.getContractAt('DiamondInit', initAddress)
    // Encode the init function call with the provided arguments
    // NOTE: Initializer args may be added in the future
    const encodedInitData = diamondInit.interface.encodeFunctionData('init')

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    const tx = await diamondCut.diamondCut([], initAddress, encodedInitData)
    await tx.wait()
  }

  /**
   * Remove facets from a diamond
   */
  async removeFacets(diamondAddress: string, facetNames: string[]): Promise<void> {
    logger.log(`Removing facets: ${facetNames.join(', ')}`, '💎')
    const cuts: IDiamondCut.FacetCutStruct[] = []

    for (const facetName of facetNames) {
      const Facet = await ethers.getContractFactory(facetName)
      const facet = Facet.attach(ethers.constants.AddressZero)

      cuts.push({
        facetAddress: ethers.constants.AddressZero,
        action: FacetCutAction.Remove,
        functionSelectors: getSelectors(facet).signatures,
      })
    }

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    const tx = await diamondCut.diamondCut(cuts, ethers.constants.AddressZero, '0x')
    await tx.wait()
  }

  /**
   * Replace facets in a diamond with new versions
   */
  async replaceFacets(diamondAddress: string, facetNames: string[]): Promise<{ [name: string]: string }> {
    logger.log(`Replacing facets: ${facetNames.join(', ')}`, '💎')
    const facetNameToAddress: { [name: string]: string } = {}
    const cuts: IDiamondCut.FacetCutStruct[] = []

    for (const facetName of facetNames) {
      const Facet = await ethers.getContractFactory(facetName)
      const facet = await this.deployManager.deployContractFromFactory(Facet, [], {
        name: `${facetName}V2`,
      })
      facetNameToAddress[facetName] = facet.address

      cuts.push({
        facetAddress: facet.address,
        action: FacetCutAction.Replace,
        functionSelectors: getSelectors(facet).signatures,
      })
    }

    const diamondCut = await ethers.getContractAt('IDiamondCut', diamondAddress)
    const tx = await diamondCut.diamondCut(cuts, ethers.constants.AddressZero, '0x')
    await tx.wait()

    return facetNameToAddress
  }

  /**
   * Verify the diamond deployment
   */
  private async verifyDiamondOwnership(diamondAddress: string, expectedOwner: string): Promise<void> {
    logger.log('Verifying diamond deployment', '🔍')
    const diamond = await ethers.getContractAt('OwnershipFacet', diamondAddress)

    // Basic verification - could be expanded based on requirements
    try {
      const owner = await (diamond as any).owner()
      if (!owner) {
        throw new Error('Diamond verification failed: no owner set')
      }
      if (owner != expectedOwner) {
        throw new Error(`Diamond verification failed: expected owner ${expectedOwner}, got ${owner}`)
      }
    } catch (error) {
      throw new Error(`Diamond verification failed: ${error}`)
    }
  }
}
