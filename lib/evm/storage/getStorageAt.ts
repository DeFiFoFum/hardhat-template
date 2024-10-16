import { geRpcUrlForNetwork, Networks } from '../../../hardhat.config'

export function convertStorageValueToAddress(storageValue: string): string {
  return '0x' + storageValue.slice(26)
}

export async function getStorageAtNetwork(
  contractAddress: string,
  slot: string,
  networkName: Networks
): Promise<string> {
  const rpcUrl = geRpcUrlForNetwork(networkName)

  if (!rpcUrl) {
    throw new Error('getStorageAtNetwork:: Network not found')
  }

  return getStorageAt(contractAddress, slot, rpcUrl)
}

export async function getStorageAt(contractAddress: string, slot: string, rpcUrl: string): Promise<string> {
  const data = JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getStorageAt',
    params: [contractAddress, slot, 'latest'],
    id: 1,
  })

  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  }).then((res) => res.json())

  if (!response.result) {
    throw new Error('getStorageAt:: Failed to get the storage from the network')
  }

  return response.result as string
}
