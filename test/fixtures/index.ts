import { ethers } from 'hardhat'
import { ContractFactory } from 'ethers'

/**
 * Example of a configurable fixture.
 *
 * @param _ethers
 * @returns
 */
export async function dynamicFixture<CF extends ContractFactory>(
  _ethers: typeof ethers,
  contractName: string,
  params: Parameters<CF['deploy']>
) {
  // Will return undefined if contract artifact doesn't exist
  const Contract = (await _ethers.getContractFactory(contractName).catch(() => undefined)) as CF
  const contract = Contract ? await Contract.deploy(params) : undefined

  return { contract }
}
