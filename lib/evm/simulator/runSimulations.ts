import { logger } from '../../node/logger'
import { OnChainSimulator } from './OnChainSimulator'
import { getSimulationConfig } from './simulator.config'

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
