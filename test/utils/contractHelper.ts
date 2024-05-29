import { BigNumberish, Contract } from 'ethers'
import { formatBNValueToString } from './bnHelper'

export type SnapshotCall<T extends Contract> = {
  functionName: keyof T['functions']
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
 * @param contract The contract instance
 * @param snapshotCalls Array of SnapshotCall | string matching the names of
 *  functions to call with optional arguments
 * @returns An object with the snapshot values, where the keys match the function names
 */
export async function getContractGetterSnapshot<C extends Contract>(
  contract: C,
  snapshotCalls: (SnapshotCall<C> | keyof C['functions'])[]
): Promise<{
  [K in keyof C['functions']]: C['functions'][K] extends (...args: any) => Promise<infer R> ? string : never
}> {
  const promises: Promise<void>[] = []
  const snapshot: Record<string, string> = {}

  for (const snapshotCall of snapshotCalls) {
    let functionName: keyof C['functions']
    let functionArgs: BigNumberish[] | undefined = undefined

    if (typeof snapshotCall === 'string') {
      functionName = snapshotCall
    } else if (typeof snapshotCall === 'object' && 'functionName' in snapshotCall) {
      functionName = snapshotCall.functionName
      functionArgs = snapshotCall.functionArgs
    } else {
      throw new Error('Invalid snapshot call')
    }

    // Handle return from both functions below
    const handleValue = (value: any) => {
      snapshot[functionName as string] = formatBNValueToString(value)
    }

    // Setup calls
    const promise =
      functionArgs === undefined
        ? contract[functionName]().then(handleValue)
        : contract[functionName](...functionArgs).then(handleValue)
    promises.push(promise)
  }

  await Promise.all(promises)
  return snapshot as {
    [K in keyof C['functions']]: C['functions'][K] extends (...args: any) => Promise<infer R> ? string : never
  }
}
