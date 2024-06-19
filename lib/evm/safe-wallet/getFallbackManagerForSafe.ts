import { Networks } from '../../../hardhat'
import { geRpcUrlForNetwork } from '../../../hardhat.config'

const FALLBACK_HANDLER_STORAGE_SLOT = '0x6c9a6c4a39284e37ed1cf53d337577d14212a4870fb976a4366c693b939918d5'

export async function getFallbackManagerForSafe(networkName: Networks, address: string) {
  const networkUrl = geRpcUrlForNetwork(networkName)

  if (!networkUrl) {
    throw new Error('getFallbackManagerForSafe:: Network not found')
  }

  const data = JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_getStorageAt',
    params: [address, FALLBACK_HANDLER_STORAGE_SLOT, 'latest'],
    id: 1,
  })

  const response = await fetch(networkUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  }).then((res) => res.json())

  if (!response.result) {
    throw new Error('Failed to get the storage from the network')
  }

  const fallbackManagerAddress = '0x' + response.result.slice(26)

  return { fallbackManagerAddress }
}
