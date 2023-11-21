import { ethers } from 'hardhat'
import { BigNumber, Contract } from 'ethers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

type BalanceSnapshot = {
  balance: BigNumber
  blockNumber: number
  timestamp: number
}

type Snapshot = {
  balanceDiff: BigNumber
  blockDiff: number
  timeDiff: number
  snapshots: BalanceSnapshot[]
}

/*
// Updated example usage of createNativeBalanceSnapshotter

// Import the function from the balanceHelper.ts file
import { createNativeBalanceSnapshotter } from './test/utils/balanceHelper'

// Setup ethers and define an array of account addresses
import { ethers } from 'ethers'
const accountAddresses = ['0xAccountAddress1', '0xAccountAddress2']

// Create a snapshotter for the native balance of the addresses
const takeSnapshot = createNativeBalanceSnapshotter(ethers, accountAddresses)

// Take snapshots of the balances at the current block
const initialSnapshots = await takeSnapshot()
console.log('Initial Snapshots:', initialSnapshots)

// ...perform some transactions involving the addresses...

// Take another set of snapshots and compare them with the initial ones
const updatedSnapshots = await takeSnapshot()
console.log('Updated Snapshots:', updatedSnapshots)

// The updatedSnapshots object will contain balanceDiff, blockDiff, timeDiff, 
// and an array of all snapshots taken for each address
*/
export const createNativeBalanceSnapshotter = (
  _ethers: typeof ethers,
  accountAddresses: string[]
): (() => Promise<{
  [address: string]: Snapshot
}>) => {
  const snapshots: { [address: string]: BalanceSnapshot[] } = {}

  return async () => {
    const provider = _ethers.provider
    const blockNumber = await provider.getBlockNumber()
    const block = await provider.getBlock(blockNumber)

    const currentSnapshot: {
      [address: string]: Snapshot
    } = {}

    await Promise.all(
      accountAddresses.map(async (address) => {
        if (!snapshots[address]) {
          snapshots[address] = []
        }

        const balance = await provider.getBalance(address)
        const lastSnapshot = snapshots[address].length > 0 ? snapshots[address][snapshots[address].length - 1] : null
        const newSnapshot: BalanceSnapshot = { balance, blockNumber, timestamp: block.timestamp }

        if (lastSnapshot) {
          const balanceDiff = balance.sub(lastSnapshot.balance)
          const blockDiff = blockNumber - lastSnapshot.blockNumber
          const timeDiff = block.timestamp - lastSnapshot.timestamp

          snapshots[address].push(newSnapshot)

          currentSnapshot[address] = {
            balanceDiff,
            blockDiff,
            timeDiff,
            snapshots: snapshots[address],
          }
        } else {
          snapshots[address].push(newSnapshot)
          currentSnapshot[address] = {
            balanceDiff: BigNumber.from(0),
            blockDiff: 0,
            timeDiff: 0,
            snapshots: snapshots[address],
          }
        }
      })
    )

    return currentSnapshot
  }
}

/*
// Example usage of createERC20BalanceSnapshotter

// Import the function from the balanceHelper.ts file
import { createERC20BalanceSnapshotter } from './test/utils/balanceHelper'

// Setup ethers and define an array of account addresses and token addresses
import { ethers } from 'ethers'
const accountAddresses = ['0xAccountAddress1', '0xAccountAddress2']
const tokenAddresses = ['0xTokenAddress1', '0xTokenAddress2']

// Create a snapshotter for the ERC20 token balances of the addresses
const erc20Snapshotter = createERC20BalanceSnapshotter(ethers, accountAddresses, tokenAddresses)

// Take snapshots of the ERC20 token balances at the current block
const initialERC20Snapshots = await erc20Snapshotter()
console.log('Initial ERC20 Snapshots:', initialERC20Snapshots)

// ...after some transactions involving the addresses and tokens...

// Take another set of snapshots and compare them with the previous ones
const updatedERC20Snapshots = await erc20Snapshotter()
console.log('Updated ERC20 Snapshots:', updatedERC20Snapshots)

// The updatedERC20Snapshots object will contain balanceDiff, blockDiff, timeDiff for each address and token
*/
export const createERC20BalanceSnapshotter = (
  _ethers: typeof ethers,
  accountAddresses: string[] | SignerWithAddress[],
  tokenAddresses: string[]
): (() => Promise<{
  [address: string]: {
    [token: string]: Snapshot
  }
}>) => {
  const snapshots: { [address: string]: { [token: string]: BalanceSnapshot[] } } = {}
  const erc20Abi = ['function balanceOf(address owner) view returns (uint256)']

  const tokenContracts = tokenAddresses.reduce((acc, address) => {
    acc[address] = new _ethers.Contract(address, erc20Abi, _ethers.provider)
    return acc
  }, {} as { [address: string]: Contract })

  return async () => {
    const provider = _ethers.provider
    const blockNumber = await provider.getBlockNumber()
    const block = await provider.getBlock(blockNumber)

    const currentSnapshot: {
      [address: string]: {
        [token: string]: Snapshot
      }
    } = {}

    await Promise.all(
      accountAddresses.map(async (account) => {
        let accountAddress = account as string
        if (typeof account !== 'string') {
          accountAddress = account.address
        }

        if (!currentSnapshot[accountAddress]) {
          currentSnapshot[accountAddress] = {}
        }

        return await Promise.all(
          tokenAddresses.map(async (tokenAddress) => {
            const balance = (await tokenContracts[tokenAddress].balanceOf(accountAddress)) as BigNumber

            if (!snapshots[accountAddress]) {
              snapshots[accountAddress] = {}
            }
            if (!snapshots[accountAddress][tokenAddress]) {
              snapshots[accountAddress][tokenAddress] = []
            }

            const lastSnapshotIndex = snapshots[accountAddress][tokenAddress].length - 1
            const lastSnapshot =
              lastSnapshotIndex >= 0 ? snapshots[accountAddress][tokenAddress][lastSnapshotIndex] : null
            const newSnapshot: BalanceSnapshot = { balance, blockNumber, timestamp: block.timestamp }

            if (lastSnapshot) {
              const balanceDiff = balance.sub(lastSnapshot.balance)
              const blockDiff = blockNumber - lastSnapshot.blockNumber
              const timeDiff = block.timestamp - lastSnapshot.timestamp

              snapshots[accountAddress][tokenAddress].push(newSnapshot)

              currentSnapshot[accountAddress][tokenAddress] = {
                balanceDiff,
                blockDiff,
                timeDiff,
                snapshots: snapshots[accountAddress][tokenAddress],
              }
            } else {
              snapshots[accountAddress][tokenAddress].push(newSnapshot)
              currentSnapshot[accountAddress][tokenAddress] = {
                balanceDiff: _ethers.BigNumber.from(0),
                blockDiff: 0,
                timeDiff: 0,
                snapshots: snapshots[accountAddress][tokenAddress],
              }
            }
          })
        )
      })
    )

    return currentSnapshot
  }
}
