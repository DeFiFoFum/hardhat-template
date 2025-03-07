import { EventHandler } from '../../lib/evm/simulator/EventHandler'
import { OnChainSimulator } from '../../lib/evm/simulator/OnChainSimulator'
import { logger } from '../../lib/node/logger'
import { getSimulationConfig } from './simulator.config'

async function main() {
  try {
    // Get simulation configuration
    const config = await getSimulationConfig()

    // Create simulator instance
    const simulator = new OnChainSimulator(config.network)

    // Create event handler for formatting results
    const eventHandler = new EventHandler()

    // Run simulation
    const results = await simulator.simulate(config)

    // Display formatted transaction results
    eventHandler.formatTransactionResults(results)

    logger.log('\nSimulation completed successfully!', '🎉')
  } catch (error) {
    console.error('Simulation failed:', error)
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
