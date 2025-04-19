import { ethers } from 'ethers'
import { BytesLike } from '@ethersproject/bytes'
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads'
import { cpus } from 'os'
import { Create3VanityHelper, VanityPatternType } from './Create3VanityHelper'
import { DEFAULT_X_DEPLOYER_ADDRESS } from './XDeployer'
import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-ethers'
import fs from 'fs'
import path from 'path'

import { logger } from '../../node/logger'
import { CREATE2_DEPLOYER } from '../../../scripts/deploy/CREATE2/create2.config'

// Default patterns to search for
const DEFAULT_PATTERNS = [
  //   { type: 'prefix', value: 'ed6e' },  // 0xED6E...
  //   { type: 'suffix', value: 'ed6e' },  // ...ED6E
  { type: 'both', value: 'ed6e' }, // 0xED6E...ED6E
  { type: 'repeating-prefix', value: 'ed6e' }, // 0xAAAA...ED6E
  { type: 'repeating-suffix', value: 'ed6e' }, // 0xED6E...AAAA
] as const

interface AddressSearchParams {
  startId: number
  endId: number
  deployerAddress: string
  createXAddress: string
  patterns: Array<{ type: VanityPatternType; value: string }>
}

// Worker function to search for address - modified to check all patterns at once
function searchRange(
  params: AddressSearchParams,
): Array<{ salt: string; address: string; pattern: { type: VanityPatternType; value: string } }> {
  const { startId, endId, deployerAddress, createXAddress, patterns } = params
  const vanityHelper = new Create3VanityHelper({ createXAddress })
  const results: Array<{ salt: string; address: string; pattern: { type: VanityPatternType; value: string } }> = []

  // Prepare all regex patterns in advance
  const compiledPatterns = patterns.map((patternInfo) => ({
    pattern: vanityHelper.createTargetPattern(patternInfo.type, patternInfo.value),
    info: patternInfo,
  }))

  for (let i = startId; i <= endId; i++) {
    // Create a deterministic "random" part based on iteration
    const randomHex = ethers.utils.hexZeroPad(ethers.utils.hexlify(i), 11).slice(2)
    const randomPart = `0x${randomHex}`

    // Generate a guarded salt with this random part
    const salt = vanityHelper.generateGuardedSalt(deployerAddress, randomPart)

    // Compute the resulting CREATE3 address
    const address = vanityHelper.computeCreate3Address(salt)

    // Check if the address matches ANY of the desired patterns
    for (const { pattern, info } of compiledPatterns) {
      if (pattern.test(address)) {
        results.push({ salt, address, pattern: info })
      }
    }

    // Progress update every 1M iterations
    if (i % 1_000_000 === 0 && parentPort) {
      parentPort.postMessage({ type: 'progress', value: i })
    }
  }

  return results
}

// Modify the multiple address search to use the new batch approach
async function findVanityAddresses(
  deployerAddress: string,
  patterns: Array<{ type: VanityPatternType; value: string }>,
  createXAddress: string,
  maxAttempts: number = 1_000_000,
  numWorkers = cpus().length,
): Promise<Array<{ salt: string; address: string; pattern: { type: VanityPatternType; value: string } }>> {
  const attemptsPerWorker = Math.ceil(maxAttempts / numWorkers)

  logger.log(`Starting vanity address search for ${patterns.length} patterns`, '🔍')
  logger.log(`Using ${numWorkers} workers with ${attemptsPerWorker} attempts each`, '⚙️')
  logger.log(`Deployer address: ${deployerAddress}`, '👤')
  logger.log(`CreateX address: ${createXAddress}`, '📝')

  const workers: Promise<
    Array<{ salt: string; address: string; pattern: { type: VanityPatternType; value: string } }>
  >[] = []

  for (let i = 0; i < numWorkers; i++) {
    const startId = i * attemptsPerWorker
    const endId = Math.min((i + 1) * attemptsPerWorker - 1, maxAttempts - 1)

    workers.push(
      new Promise((resolve, reject) => {
        const worker = new Worker(__filename, {
          workerData: {
            startId,
            endId,
            deployerAddress,
            createXAddress,
            patterns,
          },
        })

        worker.on('message', (msg) => {
          if (msg.type === 'progress') {
            logger.log(`Worker ${i}: Processed ${msg.value} salts`, '🏃‍♂️')
          } else if (msg.type === 'result') {
            resolve(msg.value)
          }
        })

        worker.on('error', reject)
        worker.on('exit', () => resolve([]))
      }),
    )
  }

  // Wait for all workers to complete
  const results = await Promise.all(workers)

  // Flatten all results
  const allResults = results.flat()

  return allResults
}

// Function to ensure output directory exists
function ensureOutputDirExists(outputPath: string): void {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    logger.log(`Created output directory: ${dir}`, '📁')
  }
}

// Replace findMultipleVanityAddresses with a simpler function using the new batch approach
async function findMultipleVanityAddresses(
  deployerAddress: string,
  patterns: Array<{ type: VanityPatternType; value: string }>,
  createXAddress: string,
  maxAttempts: number = 1_000_000,
  outputFile?: string,
): Promise<Array<{ salt: string; address: string; pattern: { type: VanityPatternType; value: string } }>> {
  logger.log(`Searching for matches across ${patterns.length} different vanity patterns`, '🔍')

  const results = await findVanityAddresses(deployerAddress, patterns, createXAddress, maxAttempts)

  // Group results by pattern type
  const resultsByPattern = patterns.map((pattern) => {
    const matches = results.filter((r) => r.pattern.type === pattern.type && r.pattern.value === pattern.value)
    return {
      pattern,
      matches,
      found: matches.length > 0,
    }
  })

  for (const { pattern, matches, found } of resultsByPattern) {
    if (found) {
      logger.success(`Found ${matches.length} matches for pattern: ${pattern.type} - ${pattern.value}`)
      for (const match of matches) {
        logger.log(`  Address: ${match.address}`, '📍')
        logger.log(`  Salt: ${match.salt}`, '🧂')
      }
    } else {
      logger.error(`No matches found for pattern: ${pattern.type} - ${pattern.value}`)
    }
  }

  // Output results
  logger.log(`\nFound ${results.length} total matches across ${patterns.length} patterns`, '📊')

  if (results.length > 0) {
    // Display a table of results
    console.table(
      results.map((r) => ({
        Pattern: `${r.pattern.type}:${r.pattern.value}`,
        Address: r.address,
        Salt: r.salt,
      })),
    )

    // Save to file if requested
    if (outputFile) {
      ensureOutputDirExists(outputFile)
      fs.writeFileSync(
        outputFile,
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            deployer: deployerAddress,
            createX: createXAddress,
            results,
          },
          null,
          2,
        ),
      )
      logger.success(`Results saved to ${outputFile}`)
    }
  }

  return results
}

if (isMainThread) {
  // Define the Hardhat task
  task('generate-vanity-addresses', 'Generate CREATE3 vanity addresses for contract deployment')
    .addParam('deployer', 'The address that will deploy the contracts')
    .addOptionalParam('createx', 'The address of the CreateX contract')
    .addOptionalParam('patterns', 'JSON string of patterns to search for')
    .addOptionalParam('attempts', 'Maximum attempts per pattern', '1000000')
    .addOptionalParam('output', 'Output file path to save results')
    .setAction(async (taskArgs, hre) => {
      const deployerAddress = taskArgs.deployer
      const createXAddress = taskArgs.createx || (await getDefaultCreateXAddress(hre))
      const maxAttempts = parseInt(taskArgs.attempts, 10)

      // Default to an "output" subdirectory
      const defaultOutputDir = path.join(__dirname, 'output')
      let outputFile = taskArgs.output

      if (!outputFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        outputFile = path.join(defaultOutputDir, `vanity-addresses-${timestamp}.json`)
      } else if (!path.isAbsolute(outputFile) && !outputFile.includes(path.sep)) {
        // If just a filename was provided
        outputFile = path.join(defaultOutputDir, outputFile)
      }

      let patterns: Array<{ type: VanityPatternType; value: string }>

      if (taskArgs.patterns) {
        try {
          patterns = JSON.parse(taskArgs.patterns)
        } catch (e) {
          logger.error('Failed to parse patterns JSON:', e as Error)
          return
        }
      } else {
        patterns = [...DEFAULT_PATTERNS]
      }

      const results = await findMultipleVanityAddresses(
        deployerAddress,
        patterns,
        createXAddress,
        maxAttempts,
        outputFile,
      )

      return results
    })

  // Helper function to get the default CreateX address from the network
  async function getDefaultCreateXAddress(hre: any): Promise<string> {
    try {
      // Try to get the CreateX contract from deployments
      const createX = await hre.ethers.getContract('CreateX')
      return createX.address
    } catch (e) {
      logger.log('Could not find deployed CreateX contract, using default address', '⚠️')
      return DEFAULT_X_DEPLOYER_ADDRESS
    }
  }

  // Parse command line arguments when running directly
  async function main() {
    if (require.main !== module) {
      return
    }

    // Simple command line parsing
    const args = process.argv.slice(2)
    let deployerAddress: string | undefined = CREATE2_DEPLOYER
    let createXAddress: string | undefined
    let patternsFile: string | undefined
    // NOTE: 16 chars = 4.3 Billion combinations
    let maxAttempts = 1_000_000_000
    // Default to an "output" subdirectory
    const defaultOutputDir = path.join(__dirname, 'output')
    let outputFile = path.join(defaultOutputDir, 'vanity-addresses.json')

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg === '--deployer' && i + 1 < args.length) {
        deployerAddress = args[++i]
      } else if (arg === '--createx' && i + 1 < args.length) {
        createXAddress = args[++i]
      } else if (arg === '--patterns-file' && i + 1 < args.length) {
        patternsFile = args[++i]
      } else if (arg === '--attempts' && i + 1 < args.length) {
        maxAttempts = parseInt(args[++i], 10)
      } else if (arg === '--output' && i + 1 < args.length) {
        outputFile = args[++i]
        // If a relative path is provided without directory information,
        // put it in the default output directory
        if (!path.isAbsolute(outputFile) && !outputFile.includes(path.sep)) {
          outputFile = path.join(defaultOutputDir, outputFile)
        }
      } else if (arg === '--help') {
        logger.log(
          `
Usage: node ${path.basename(__filename)} [options]

Options:
  --deployer <address>    The address that will deploy the contracts (required)
  --createx <address>     The address of the CreateX contract (optional)
  --patterns-file <file>  JSON file containing patterns to search for (optional)
  --attempts <number>     Maximum attempts per pattern (default: 1000000)
  --output <file>         Output file path to save results (default: ./vanity-addresses.json)
  --help                  Display this help message
        `,
          '📋',
        )
        return
      }
    }

    if (!deployerAddress) {
      logger.error('Error: --deployer parameter is required')
      logger.log('Use --help for usage information', '❓')
      process.exit(1)
    }

    if (!createXAddress) {
      createXAddress = DEFAULT_X_DEPLOYER_ADDRESS
      logger.log(`Using default CreateX address: ${createXAddress}`, '⚙️')
    }

    let patterns: Array<{ type: VanityPatternType; value: string }>

    if (patternsFile) {
      try {
        const patternsJson = fs.readFileSync(patternsFile, 'utf8')
        patterns = JSON.parse(patternsJson)
        logger.log(`Loaded ${patterns.length} patterns from ${patternsFile}`, '📂')
      } catch (e) {
        logger.error(`Failed to load patterns from ${patternsFile}:`, e as Error)
        process.exit(1)
      }
    } else {
      patterns = [...DEFAULT_PATTERNS]
      logger.log(`Using default patterns:`, '🔠')
      console.table(patterns)
    }

    // Add a timestamp to the filename to make it unique
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const fileExt = path.extname(outputFile)
    const fileName = path.basename(outputFile, fileExt)
    const dir = path.dirname(outputFile)
    outputFile = path.join(dir, `${fileName}-${timestamp}${fileExt}`)

    logger.log(`Starting vanity address search with the following configuration:`, '🚀')
    logger.log(`- Deployer address: ${deployerAddress}`, '👤')
    logger.log(`- CreateX address: ${createXAddress}`, '📝')
    logger.log(`- Max attempts per pattern: ${maxAttempts}`, '🔄')
    logger.log(`- Output file: ${outputFile}`, '💾')
    logger.log(`- Number of patterns: ${patterns.length}`, '🔢')

    const results = await findMultipleVanityAddresses(
      deployerAddress,
      patterns,
      createXAddress,
      maxAttempts,
      outputFile,
    )

    if (results.length > 0) {
      logger.success(`\nSearch completed. Found ${results.length} matching addresses.`)
      logger.log(`Results saved to ${outputFile}`, '💾')
    } else {
      logger.error(`\nSearch completed. No matching addresses found.`)
    }
  }

  // Run directly if this is the main module
  main().catch((error) => {
    logger.error('Error running script:', error)
    process.exit(1)
  })
} else {
  // Worker thread code
  const params: AddressSearchParams = {
    startId: workerData.startId,
    endId: workerData.endId,
    deployerAddress: workerData.deployerAddress,
    createXAddress: workerData.createXAddress,
    patterns: workerData.patterns,
  }

  const results = searchRange(params)
  if (results.length > 0) {
    parentPort?.postMessage({ type: 'result', value: results })
  } else {
    parentPort?.postMessage({ type: 'result', value: [] })
  }
}

// Export the task to be loaded by Hardhat
export {}
