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

    // Run simulation
    const results = await simulator.simulate(config)

    // Display formatted transaction results
    const eventHandler = new EventHandler()
    const formattedEvents = eventHandler.formatTransactionResults(results)
    console.dir(formattedEvents, { depth: null, colors: true })

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
