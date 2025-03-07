import { Networks } from '../../hardhat'
import { getErrorMessage } from '../node/getErrorMessage'
import { getUnixTimestampAndNextDay } from '../node/dateHelper'
import { RequestQueue } from './RequestQueue'

// Usage with the RequestQueue class
const coinGeckoRequestPerMinute = 30
const requestQueue = new RequestQueue(coinGeckoRequestPerMinute)

interface CoinGeckoPlatform {
  id: string
  chain_identifier: number
  name: string
  shortname: string
  native_coin_id: string
}

export type CoinGeckoNetworks = Extract<Networks, 'bsc' /*| 'bscTestnet'*/>

// https://www.coingecko.com/api/documentation
// curl -X 'GET' \ 'https://api.coingecko.com/api/v3/asset_platforms' \ -H 'accept: application/json'
const coinGeckoPlatforms: Record<CoinGeckoNetworks, CoinGeckoPlatform> = {
  bsc: {
    id: 'binance-smart-chain',
    chain_identifier: 56,
    name: 'BNB Smart Chain',
    shortname: 'BSC',
    native_coin_id: 'binancecoin',
  },
  // polygon: {
  //   id: 'polygon-pos',
  //   chain_identifier: 137,
  //   name: 'Polygon POS',
  //   shortname: 'MATIC',
  //   native_coin_id: 'matic-network',
  // },
  //   mainnet: {
  //     id: 'ethereum',
  //     chain_identifier: 1,
  //     name: 'Ethereum',
  //     shortname: 'Ethereum',
  //     native_coin_id: 'ethereum',
  //   },
  //   arbitrum: {
  //     id: 'arbitrum-one',
  //     chain_identifier: 42161,
  //     name: 'Arbitrum One',
  //     shortname: 'Arbitrum',
  //     native_coin_id: 'ethereum',
  //   },
  //   linea: {
  //     id: 'linea',
  //     chain_identifier: 59144,
  //     name: 'Linea',
  //     shortname: '',
  //     native_coin_id: 'ethereum',
  //   },
}

export const getPlatformInfoForNetwork = (network: CoinGeckoNetworks) => coinGeckoPlatforms[network]
export const getPlatformIdForNetwork = (network: CoinGeckoNetworks) => coinGeckoPlatforms[network].id

export const getCoinInfoForTokenContractOnNetwork = (network: CoinGeckoNetworks, contractAddress: string) => {
  const platform = getPlatformInfoForNetwork(network)
  return new Promise((resolve, reject) => {
    const requestFunction = async () => {
      const request = `https://api.coingecko.com/api/v3/coins/${platform.id}/contract/${contractAddress}`
      try {
        const coinInfoResponse = await fetch(request)
        resolve(await coinInfoResponse.json())
      } catch (e) {
        console.error(getErrorMessage(e))
        reject(new Error(`Failed to fetch coin info for token contract ${contractAddress} on network ${network}`))
      }
    }

    requestQueue.enqueue(requestFunction)
  })
}

export const getUsdPriceForTokenContractOnNetwork = (
  network: CoinGeckoNetworks,
  contractAddress: string,
  dateStringOrTimestamp: string | number,
  vsCurrency = 'usd',
): Promise<number> => {
  return new Promise((resolve, reject) => {
    const requestFunction = async () => {
      const [startTimestamp, endTimestamp] = getUnixTimestampAndNextDay(dateStringOrTimestamp)
      const request = `https://api.coingecko.com/api/v3/coins/${coinGeckoPlatforms[network].id}/contract/${contractAddress}/market_chart/range?vs_currency=${vsCurrency}&from=${startTimestamp}&to=${endTimestamp}`
      try {
        const priceResponse = await fetch(request)
        // NOTE: prices returns an array of arrays, where the first value is the timestamp and the second is the price
        const tokenPrice = ((await priceResponse.json()) as any).prices[0][1]
        resolve(tokenPrice)
      } catch (e) {
        console.error(getErrorMessage(e))
        reject(new Error(`Failed to fetch price for token contract ${contractAddress} on network ${network}`))
      }
    }

    requestQueue.enqueue(requestFunction)
  })
}

// examples:
// getUsdPriceForTokenContractOnNetwork('polygon', `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`, 1706800470).then(
//   (res) => {
//     console.log(res)
//     process.exit(0)
//   }
// )
// getCoinInfoForTokenContractOnNetwork('polygon', `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270`).then((res) => {
//   console.log(res)
//   process.exit(0)
// })
