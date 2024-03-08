import Moralis from 'moralis'
import { EvmChain, EvmEvent, GetContractEventsRequest } from '@moralisweb3/common-evm-utils'
import { getEnv, logger } from '../../hardhat/utils'
import { DeployableNetworks } from '../../scripts/deploy/deploy.config'
import { getErrorMessage } from '../node/getErrorMessage'

type MoralisEventData<T> = {
  transaction_hash: string
  address: string
  block_timestamp: string
  block_number: string
  block_hash: string
  data: T
}

export class MoralisService {
  private static instance: MoralisService
  private static apiKey: string
  private started = false

  constructor(apiKey?: string) {
    MoralisService.apiKey = apiKey || getEnv('MORALIS_API_KEY', true)
  }

  public static getInstance(apiKey?: string): MoralisService {
    if (!MoralisService.instance) {
      MoralisService.instance = new MoralisService(apiKey)
    }
    return MoralisService.instance
  }

  async start() {
    if (this.started) {
      return
    }
    await Moralis.start({ apiKey: MoralisService.apiKey })
    this.started = true
  }

  getEvmChain(network: DeployableNetworks): EvmChain {
    if (network === 'bsc') {
      return EvmChain.BSC
    } else {
      throw new Error(`MoralisService.getEvmChain:: Unsupported network: ${network}`)
    }
  }

  async getContractEvents(request: GetContractEventsRequest) {
    await this.start()
    return Moralis.EvmApi.events.getContractEvents(request)
  }

  /**
   * Retrieves all contract events based on the provided request parameters.
   * This function will paginate through all available events if necessary.
   *
   * @param {GetContractEventsRequest} request - The request parameters to retrieve contract events.
   * @returns {Promise<MoralisEventData[]>} A promise that resolves to an array of Moralis event data.
   */
  async getAllContractEvents<T>(request: GetContractEventsRequest) {
    await this.start()
    let allEvents: MoralisEventData<T>[] = []

    let response = await this.getContractEvents(request)
    allEvents = allEvents.concat(response.toJSON().result as unknown as MoralisEventData<T>)

    while (response.hasNext()) {
      // Work through pagination to gather all events for this time frame
      try {
        response = await response.next()
        allEvents = allEvents.concat(response.toJSON().result as unknown as MoralisEventData<T>)
      } catch (error) {
        logger.error(getErrorMessage(error))
        break
      }
    }

    return allEvents
  }
}
