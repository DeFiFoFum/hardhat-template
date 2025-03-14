import axios from 'axios'
import { getEnv } from '../../hardhat/utils'

/**
 * Defines the configuration for a simulation in Tenderly.
 * - `save`: Whether to save the simulation results.
 * - `save_if_fails`: Whether to save the simulation if it fails.
 * - `simulation_type`: The type of simulation, either 'quick' or 'full'.
 * - `network_id`: The ID of the network for the simulation.
 */
export interface SimulationConfig {
  save?: boolean
  save_if_fails?: boolean
  simulation_type?: 'quick' | 'full'
  network_id: string | number
}

/**
 * Represents an EVM transaction for use in Tenderly simulations.
 * - `from`: The sender's address.
 * - `to`: The recipient's address.
 * - `input`: The input data for the transaction.
 * - `gas`: The gas limit for the transaction (optional).
 * - `gas_price`: The gas price for the transaction.
 * - `value`: The value of the transaction (optional).
 */
export interface TenderlyEVMTransaction {
  from: string
  to: string
  input: string
  gas?: number
  gas_price: number
  value?: number
}

export async function runTenderlySimulation(
  transaction: TenderlyEVMTransaction,
  config: SimulationConfig,
): Promise<void> {
  const [TENDERLY_USER, TENDERLY_PROJECT, TENDERLY_ACCESS_KEY] = [
    getEnv('TENDERLY_USER', true),
    getEnv('TENDERLY_PROJECT', true),
    getEnv('TENDERLY_ACCESS_KEY', true),
  ]

  try {
    const resp = await axios.post(
      `https://api.tenderly.co/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/simulate`,
      // the transaction
      {
        /* Simulation Configuration */
        save: false, // if true simulation is saved and shows up in the dashboard
        save_if_fails: false, // if true, reverting simulations show up in the dashboard
        simulation_type: 'quick', // full or quick (full is default)
        ...config, // Overwrite the defaults above

        /* Standard EVM Transaction object */
        gas: 8000000,
        //   gas_price: 0,
        value: 0,
        ...transaction,
      },
      {
        headers: {
          'X-Access-Key': TENDERLY_ACCESS_KEY as string,
        },
      },
    )

    const transactionResult = resp.data.transaction
    console.log(JSON.stringify(transactionResult, null, 2))
  } catch (error: any) {
    console.error('Error running simulation:')
    console.dir(error.response.data, { depth: 5 })
  }
}
