import { OnChainSimulationConfig } from '../../lib/evm/simulator/simulation-types'
import { DeployableNetworks, getDeployConfig } from '../deploy/deploy.config'

export async function getSimulationConfig(): Promise<OnChainSimulationConfig> {
  const simulationNetwork: DeployableNetworks = 'bsc'
  const deployConfig = await getDeployConfig(simulationNetwork)
  const fromAddress = deployConfig.accounts.adminAddress

  if (!fromAddress) {
    throw new Error('getSimulationConfig:: from address address found found')
  }

  return {
    network: simulationNetwork,
    transactions: [
      {
        from: fromAddress,
        to: '0x',
        data: '0x',
      },
    ],
  }
}
