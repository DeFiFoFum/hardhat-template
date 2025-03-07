import { Signer } from 'ethers'
import { ethers } from 'hardhat'
import { GnosisSafeL2, MultiSendCallOnly } from '../../../typechain-types'

import GnosisSafeL2_Artifact from '../../../artifacts-external/GnosisSafeL2.json'
import MultiSendCallOnly_Artifact from '../../../artifacts-external/MultiSendCallOnly.json'

export const DEFAULT_MULTISEND_ADDRESS = '0x40A2aCCbd92BCA938b02010E17A5b8929b49130D'

export async function getSafeContractAt(address: string, signer?: Signer): Promise<GnosisSafeL2> {
  const safeContract = (await ethers.getContractAtFromArtifact(GnosisSafeL2_Artifact, address, signer)) as GnosisSafeL2
  return safeContract
}

export async function getMultiSendCallOnlyContractAt(address: string, signer?: Signer): Promise<MultiSendCallOnly> {
  const multiSendCallOnlyContract = (await ethers.getContractAtFromArtifact(
    MultiSendCallOnly_Artifact,
    address,
    signer,
  )) as MultiSendCallOnly
  return multiSendCallOnlyContract
}

export async function getMultiSendCallOnlyContract(signer?: Signer): Promise<MultiSendCallOnly> {
  return getMultiSendCallOnlyContractAt(DEFAULT_MULTISEND_ADDRESS, signer)
}
