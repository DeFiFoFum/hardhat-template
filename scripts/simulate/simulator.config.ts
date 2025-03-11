import { OnChainSimulationConfig } from '../../lib/evm/simulator/simulation-types'
import { DeployableNetworks, getDeployConfig } from '../deploy/deploy.config'

/**
 * Helper function to clean chain prefixes from addresses in a SimulationConfig
 * Converts addresses like "zircuit-mainnet:0xabc..." to "0xabc..."
 */
export function cleanConfigAddresses(config: OnChainSimulationConfig): OnChainSimulationConfig {
  return {
    ...config,
    transactions: config.transactions.map((tx) => ({
      ...tx,
      from: tx.from.includes(':') ? tx.from.split(':')[1] : tx.from,
      to: tx.to.includes(':') ? tx.to.split(':')[1] : tx.to,
    })),
  }
}

export async function getSimulationConfig(): Promise<OnChainSimulationConfig> {
  const simulationNetwork: DeployableNetworks = 'bsc'
  const deployConfig = await getDeployConfig(simulationNetwork)
  const fromAddress = deployConfig.accounts.adminAddress

  if (!fromAddress) {
    throw new Error('getSimulationConfig:: from address address found found')
  }

  const simulationConfig = cleanConfigAddresses({
    network: simulationNetwork,
    transactions: [
      {
        from: fromAddress,
        to: '0x',
        data: '0x',
      },
    ],
  })
  return simulationConfig
}
