import { BigNumberish, Contract } from 'ethers'
import { formatBNValueToString } from './bnHelper'

export type SnapshotCall = {
  functionName: string
  functionArgs?: BigNumberish[]
}

/**
 * Provide a contract with an array of view functions which contain zero arguments
 *  and return an object of all values.
 *
 * @param {*} contract
 * @param {*} snapshotFunctions Array of SnapshotCall | string matching the names of
 *  functions to call with optional arguments
 * @returns
 */
// TODO: Can use generics to return the proper shape of the object
export async function getContractGetterSnapshot<ContractType extends Contract>(
  contract: ContractType,
  snapshotCalls: (SnapshotCall | string)[]
) {
  let promises = []
  let snapshot = {}

  for (let index = 0; index < snapshotCalls.length; index++) {
    let functionName: string
    let functionArgs: BigNumberish[] | undefined = undefined
    const snapshotCall = snapshotCalls[index]
    if (typeof snapshotCall === 'string') {
      functionName = snapshotCall
    } else {
      functionName = snapshotCall.functionName
      functionArgs = snapshotCall.functionArgs
    }
    // Handle return from both functions below
    const handleValue = (value: any) =>
      (snapshot = {
        ...snapshot,
        [`${index}-${functionName}`]: formatBNValueToString(value),
      })
    // Setup calls
    const promise =
      functionArgs == undefined
        ? contract[functionName]().then(handleValue)
        : contract[functionName](...functionArgs).then(handleValue)
    promises.push(promise)
  }

  await Promise.all(promises)
  return snapshot
}
