import hre from 'hardhat'
import {
  AccessControlEnumerable,
  AccessControlEnumerable__factory,
  Ownable,
  Ownable__factory,
} from '../../typechain-types'
import { BytesLike } from 'ethers'

/**
 * Returns owners for array of contract addresses.
 *
 * @param ownableAddresses
 * @returns
 */
export async function getOwnersForAddresses(ownableAddresses: string[]) {
  const ownableContracts = []
  for (const ownableAddress of ownableAddresses) {
    ownableContracts.push(Ownable__factory.connect(ownableAddress, hre.ethers.provider))
  }
  return await getOwnersForContracts(ownableContracts)
}

export async function getOwnersForContracts<C extends Ownable>(ownableContracts: C[]) {
  const owners = {} as Record<C['address'], string>
  for (const ownableContract of ownableContracts) {
    const currentOwner = await ownableContract.owner()
    owners[ownableContract.address as C['address']] = currentOwner
  }
  return owners
}

export async function getRoleMembersForAddresses(accessControlEnumerable: string[], roles: string[]) {
  const accessControlContracts = []
  for (const accessControlAddress of accessControlEnumerable) {
    accessControlContracts.push(AccessControlEnumerable__factory.connect(accessControlAddress, hre.ethers.provider))
  }
  return await getRoleMembersForContracts(accessControlContracts, roles)
}

/**
 * Provide an AccessControlEnumerable contract along with the public variable names of the roles
 * to find all addresses with those roles.
 *
 * @param accessControlEnumerable Contract which supports the AccessControlEnumerable interface
 * @param roles Name of public role variable to pull from contract
 * @returns
 */
export async function getRoleMembersForContracts<C extends AccessControlEnumerable, Role extends string>(
  accessControlEnumerableArray: C[],
  roles: Role[]
) {
  const finalOutput = {} as Record<C['address'], Record<Role, string[]>>
  for (const accessControlEnumerable of accessControlEnumerableArray) {
    const roleOutput = {} as Record<Role, string[]>
    for await (const role of roles) {
      // Check if the function exists on the contract
      if (typeof (accessControlEnumerable as any)[role] === 'function') {
        const roleSignature = (await (accessControlEnumerable as any)[role]()) as BytesLike
        const currentCount = await accessControlEnumerable.getRoleMemberCount(roleSignature)
        const rolePromises = []
        for (let roleIndex = 0; roleIndex < currentCount.toNumber(); roleIndex++) {
          rolePromises.push(accessControlEnumerable.getRoleMember(roleSignature, roleIndex))
        }
        roleOutput[role] = await Promise.all(rolePromises)
      } else {
        console.error(`Role ${role} does not exist on contract ${accessControlEnumerable.address}`)
      }
    }
    finalOutput[accessControlEnumerable.address as C['address']] = roleOutput
  }
  return finalOutput
}
