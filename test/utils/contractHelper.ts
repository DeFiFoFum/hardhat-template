import { BigNumberish, Contract } from 'ethers'
import { formatBNValueToString } from './bnHelper'

export type SnapshotCall = {
  functionName: string
  functionArgs?: BigNumberish[]
}

/*
// Usage Example: getContractGetterSnapshot
import { ethers } from 'ethers';
import { getContractGetterSnapshot, SnapshotCall } from './utils/contractHelper';

// Assuming you have an instance of a contract
const contract = new ethers.Contract(
  'contract-address',
  ['function getBalance()', 'function getAllowance(address, address)'],
  someProviderOrSigner
);

async function main() {
  // Define the calls you want to make to the contract
  const snapshotCalls: (SnapshotCall | string)[] = [
    'getBalance', // This is a string shorthand for a function with no arguments
    {
      functionName: 'getAllowance',
      functionArgs: ['0xAddress1', '0xAddress2'], // Example addresses as arguments
    },
  ];

  // Use the getContractGetterSnapshot function with await
  const snapshot = await getContractGetterSnapshot(contract, snapshotCalls);

  console.log(snapshot);
}

main().catch(console.error); 
*/

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
export async function getContractGetterSnapshot<C extends Contract>(
  contract: C,
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
