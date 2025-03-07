import { OnChainSimulator } from '../../lib/evm/simulator/OnChainSimulator'
import { getSimulationConfig } from '../../lib/evm/simulator/simulator.config'
import { logger } from '../../lib/node/logger'

async function main() {
  try {
    // Get simulation configuration
    const config = await getSimulationConfig()

    // Create simulator instance
    const simulator = new OnChainSimulator(config.network)

    // Run simulation
    await simulator.simulate(config)

    logger.log('Simulation completed successfully!', '🎉')
  } catch (error) {
    console.error('Simulation failed:', error)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
