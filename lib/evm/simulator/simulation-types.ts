import { DeployableNetworks } from '../../../scripts/deploy/deploy.config'
import { BigNumber } from 'ethers'

export interface SimulationConfig {
  network: DeployableNetworks
  transactions: SimulationTransaction[]
}

export interface SimulationTransaction {
  from: string
  to: string
  data: string
  value?: BigNumber
}

export interface DecodedEvent {
  name: string
  args: any
}

export interface FormattedLog {
  address: string
  contractUrl: string
  topics: string[]
  data: string
  decodedEvent: DecodedEvent | null
}

export interface FormattedReceipt {
  status: string
  from: string
  to: string
  transactionHash: string
  blockNumber: number
  gasUsed: string
  effectiveGasPrice: string
  logs: FormattedLog[]
  explorerUrl: string
}

export interface SimulationResult {
  receipt: FormattedReceipt
  timestamp: string
}
