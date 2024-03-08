import axios from 'axios'

interface Chain {
  name: string
  chainId: number
  shortName: string
  chain: string
  network: string
  networkId: number
  nativeCurrency: { name: string; symbol: string; decimals: number }
  rpc: string[]
  sortedRpcLatency?: { url: string; latency: number | 'Error' }[]
  faucets: string[]
  infoURL: string
  isPrivate: boolean
}

interface ChainOptions {
  // TODO: isPrivate is not a valid property of Chain
  // isPrivate?: boolean;
  chainId: number
}

export async function fetchChainListChains(options?: ChainOptions): Promise<Chain[]> {
  try {
    const response = await axios.get('https://chainid.network/chains.json')
    let chains = response.data

    if (options) {
      // if (options.isPrivate !== undefined) {
      //   chains = chains.filter((chain: any) => chain.isPrivate === options.isPrivate);
      // }
      if (options.chainId !== undefined) {
        chains = chains.filter((chain: any) => chain.chainId === options.chainId)
      }
    }

    return chains
  } catch (error) {
    console.error(error)
    return []
  }
}

export async function measureAndSortByLatency(chains: Chain[]): Promise<Chain[]> {
  for (let chain of chains) {
    const rpcLatencies = await Promise.all(
      chain.rpc.map(async (rpcUrl) => {
        const start = Date.now()
        try {
          await axios.post(
            rpcUrl,
            {
              jsonrpc: '2.0',
              method: 'web3_clientVersion',
              params: [],
              id: 1,
            },
            {
              timeout: 1000, // Set the timeout to 1000 milliseconds
            }
          )
          const latency = Date.now() - start
          console.log(`Latency for chain ${chain.name} on RPC ${rpcUrl} has latency ${latency}ms`)
          return { url: rpcUrl, latency }
        } catch (error) {
          return { url: rpcUrl, latency: 'Error' }
        }
      })
    )

    // Filter out the RPCs that returned an error, then sort by latency
    const sortedRpcLatencies = rpcLatencies
      .filter((rpc) => rpc.latency !== 'Error')
      .sort((a, b) => {
        if (a.latency === 'Error') return 1
        if (b.latency === 'Error') return -1
        return Number(a.latency) - Number(b.latency)
      })

    // Assign the sorted RPCs back to the chain
    chain.sortedRpcLatency = sortedRpcLatencies as { url: string; latency: number }[]
  }

  // Optionally, you can sort chains by the latency of their fastest RPC
  return chains.sort((a, b) => {
    const aLatency = a.sortedRpcLatency?.length ? a.sortedRpcLatency[0].latency : 'Error'
    const bLatency = b.sortedRpcLatency?.length ? b.sortedRpcLatency[0].latency : 'Error'
    if (aLatency === 'Error') return 1
    if (bLatency === 'Error') return -1
    return aLatency - bLatency
  })
}

/*
// Pull the private chains from ChainList and sort by latency.
// Can be used to find the current fastest private chain to deploy to.
fetchChainListChains({ chainId: 56 })
  .then(measureAndSortByLatency)
  .then(chains => console.dir({ chains }, { depth: null }));
*/
