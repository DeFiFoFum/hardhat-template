import { DeployableNetworks, getDeployConfig } from '../../../scripts/deploy/deploy.config'
import { SimulationConfig } from './simulation-types'

export async function getSimulationConfig(): Promise<SimulationConfig> {
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
