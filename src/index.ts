/**
 * The src/ directory is where files can be written, built and published as an npm package to support
 *  the smart contracts developed in this repo.
 */
const moduleState = undefined
export { moduleState }

// Logger
import { logger } from '../hardhat/utils'
if (process.env.DEVELOPMENT !== 'true') {
  // If not in development, silence the logger
  logger.setSilent(true)
}
export { logger }
