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
  params: Parameters<CF['deploy']>,
): Promise<ReturnType<CF['deploy']>> {
  // Will return undefined if contract artifact doesn't exist
  const Contract = (await _ethers.getContractFactory(contractName).catch(() => undefined)) as CF
  if (!Contract) {
    throw new Error(`dynamicFixture:: Contract ${contractName} not found`)
  }
  const contract = (await Contract.deploy(...params)) as ReturnType<CF['deploy']>
  return contract
}
