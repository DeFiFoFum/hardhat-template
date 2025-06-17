import { HardhatUserConfig, task, types } from 'hardhat/config'
import {
  HardhatNetworkAccountsUserConfig,
  HardhatRuntimeEnvironment,
  HttpNetworkAccountsUserConfig,
  HttpNetworkUserConfig,
  SolcUserConfig,
} from 'hardhat/types'
import { TASK_TEST } from 'hardhat/builtin-tasks/task-names'
// Plugins
import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomicfoundation/hardhat-verify'
import 'solidity-coverage'
import 'solidity-docgen' // Markdown doc generator
// import 'hardhat-docgen' // HTML doc generator
import 'hardhat-contract-sizer'
import 'hardhat-gas-reporter'
import './plugins/abiPlugins'
import 'hardhat-tracer'
// Project Config
import solhintConfig from './solhint.config'
import { getEnv, Logger, logger, testRunner } from './hardhat/utils'
// Import the vanity generator task
// import './lib/evm/create2/create3VanityGenerator'

// Network Config
export const NETWORKS = <const>[
  'hardhat', // Internal network for testing
  'mainnet', // Ethereum mainnet
  // Alphabetic order
  'arbitrum',
  'arbitrumGoerli',
  'avax',
  'base',
  'blast',
  'bsc',
  'bscTestnet',
  'goerli',
  'iotaEvm',
  'lightLink',
  'linea',
  'lineaDummy',
  'lineaTestnet',
  'polygon',
  'polygonTestnet',
  'sepolia',
  'sonic',
  'sonicTestnet',
  'unichain',
  'unichainTestnet',
  'zircuit',
  'zircuitTestnet',
]
// Create a type out of the network array
export type Networks = (typeof NETWORKS)[number]

/**
 * Example of accessing ethers and performing Web3 calls inside a task
 * task action function receives the Hardhat Runtime Environment as second argument
 *
 * Docs regarding hardhat helper functions added to ethers object:
 * https://github.com/NomicFoundation/hardhat/tree/master/packages/hardhat-ethers#helpers
 */
task('blockNumber', '🫶 Prints the current block number', async (_, hre: HardhatRuntimeEnvironment) => {
  // A provider field is added to ethers, which is an
  //   ethers.providers.Provider automatically connected to the selected network
  await hre.ethers.provider.getBlockNumber().then((blockNumber) => {
    console.log('Current block number: ' + blockNumber)
  })
})

/**
 * Quickly deploy an implementation contract to the network of choice.
 * npx hardhat deploy-implementation --name MyContract --network <networkName>
 */
task('deploy-implementation', 'Deploys an implementation contract to the network of choice.')
  .addParam('name', 'The name of the implementation contract')
  .setAction(async (taskArgs, hre) => {
    // TODO: Extract into a reusable function
    const [deployer] = await hre.ethers.getSigners()
    if (!deployer) {
      throw new Error('Deployer not found, please check mnemonic.')
    }
    const currentNetwork = hre.network.name
    const contractName: string = taskArgs.name // Access the passed contract name
    logger.log(`Deploying ${contractName} on network ${currentNetwork} from deployer ${deployer.address}`, '⚙️')

    // Get the Contract Factory using the contract name
    const ContractFactory = await hre.ethers.getContractFactory(contractName)
    logger.log(`Deploying ${contractName}...`, '🚀')
    const contract = await ContractFactory.deploy()
    await contract.deployed()

    logger.log(`${contractName} deployed to ${contract.address}`, '📜')
    console.log(getExplorerUrlForNetwork(currentNetwork as Networks)(contract.address))

    try {
      // https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-etherscan#using-programmatically
      await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: [], // Implementation contracts don't have constructor arguments
        noCompile: true, // This replaces the --no-compile flag
      })
      logger.success(`Verified ${contractName} at ${contract.address}`)
    } catch (error) {
      logger.error(`Failed trying to verify ${contractName} at ${contract.address}: ${error}`)
      logger.log(`npx hardhat verify --network ${currentNetwork} ${contract.address}`, '🔍')
    }
  })

/**
 * Provide additional fork testing options
 *
 * eg: `npx hardhat test --fork <network-name> --blockNumber <block-number>`
 */
task(TASK_TEST, '🫶 Test Task')
  .addOptionalParam('fork', 'Optional network name to be forked block number to fork in case of running fork tests.')
  .addOptionalParam('blockNumber', 'Optional block number to fork in case of running fork tests.', undefined, types.int)
  .setAction(testRunner)

/**
 * Follows a standard environment variable setup for accounts. Uses MNEMONIC first, falls back to PRIVATE_KEY and
 *  returns undefined if either are not present.
 *
 * Environment variables: <environment>_MNEMONIC or <environment>_PRIVATE_KEY
 */
function getAccountsForEnvironment(
  environment: 'MAINNET' | 'TESTNET' | 'DUMMY_MAINNET',
): HttpNetworkAccountsUserConfig | undefined {
  const mnemonic = getEnv(`${environment}_MNEMONIC`)
  if (mnemonic) {
    return { mnemonic }
  }

  const privateKey = getEnv(`${environment}_PRIVATE_KEY`)
  if (privateKey) {
    return [privateKey] // Fallback to private key
  }

  return undefined // Return undefined if neither mnemonic or private key are present
}

/**
 * This setup allows for the use of different accounts for different environments.
 *
 * For example DUMMY_MAINNET is intended to deploy contracts on mainnet, but with a different account
 *  than the one used for the MAINNET environment to prevent front running.
 */
const mainnetAccounts = getAccountsForEnvironment('MAINNET')
const dummyMainnetAccounts = getAccountsForEnvironment('DUMMY_MAINNET')
const testnetAccounts = getAccountsForEnvironment('TESTNET')

const getHardhatNetworkAccounts = (
  networkAccounts: HttpNetworkAccountsUserConfig | undefined,
): HardhatNetworkAccountsUserConfig | undefined => {
  if (!networkAccounts) {
    return undefined
  }
  if (Array.isArray(networkAccounts)) {
    return networkAccounts.map((privateKey) => ({ privateKey, balance: '10000000000000000000000' }))
  }
  // TODO: Not sure where this type is coming from, but ts is complaining.
  if (networkAccounts == 'remote') {
    throw new Error('getHardhatNetworkAccounts:: Remote accounts not supported')
  }
  return networkAccounts
}

/**
 * Extended network options for networks and a specific setup for hardhat.
 */
type ExtendedNetworkOptions = {
  getExplorerUrl: (address: string) => string
}

type NetworkUserConfigExtended = HttpNetworkUserConfig & ExtendedNetworkOptions

// Custom type for the hardhat network
type ExtendedHardhatNetworkConfig = {
  [K in Networks]: K extends 'hardhat' ? HardhatUserConfig & ExtendedNetworkOptions : NetworkUserConfigExtended
}

// NOTE: RPC Urls can be found at https://chainlist.org/
const networkConfig: ExtendedHardhatNetworkConfig = {
  mainnet: {
    url: getEnv('MAINNET_RPC_URL') || 'https://eth.llamarpc.com',
    getExplorerUrl: (address: string) => `https://etherscan.io/address/${address}`,
    chainId: 1,
    accounts: mainnetAccounts,
  },
  goerli: {
    url: getEnv('GOERLI_RPC_URL') || '',
    getExplorerUrl: (address: string) => `https://goerli.etherscan.io/address/${address}`,
    chainId: 5,
    accounts: testnetAccounts,
  },
  arbitrum: {
    url: getEnv('ARBITRUM_RPC_URL') || 'https://arbitrum.llamarpc.com',
    getExplorerUrl: (address: string) => `https://arbiscan.io/address/${address}`,
    chainId: 42161,
    accounts: mainnetAccounts,
  },
  arbitrumGoerli: {
    url: getEnv('ARBITRUM_GOERLI_RPC_URL') || '',
    getExplorerUrl: (address: string) => `https://testnet.arbiscan.io/address/${address}`,
    chainId: 421613,
    accounts: testnetAccounts,
  },
  avax: {
    url: getEnv('AVAX_RPC_URL') || 'https://avalanche.drpc.org',
    getExplorerUrl: (address: string) => `https://snowscan.xyz/address/${address}`,
    chainId: 43114,
    accounts: mainnetAccounts,
  },
  base: {
    url: getEnv('BASE_RPC_URL') || 'https://mainnet.base.org/',
    getExplorerUrl: (address: string) => `https://basescan.org/address/${address}`,
    chainId: 8453,
    accounts: mainnetAccounts,
  },
  blast: {
    url: getEnv('BLAST_RPC_URL') || 'https://blast-rpc.publicnode.com/',
    getExplorerUrl: (address: string) => `https://blastscan.io/address/${address}`,
    chainId: 81457,
    accounts: mainnetAccounts,
  },
  bsc: {
    url: getEnv('BSC_RPC_URL') || 'https://binance.llamarpc.com',
    getExplorerUrl: (address: string) => `https://bscscan.com/address/${address}`,
    chainId: 56,
    accounts: mainnetAccounts,
  },
  bscTestnet: {
    url: getEnv('BSC_TESTNET_RPC_URL') || 'https://data-seed-prebsc-1-s1.binance.org:8545',
    getExplorerUrl: (address: string) => `https://testnet.bscscan.com/address/${address}`,
    chainId: 97,
    accounts: testnetAccounts,
  },
  iotaEvm: {
    url: getEnv('IOTA_EVM_RPC_URL') || 'https://json-rpc.evm.iotaledger.net/',
    getExplorerUrl: (address: string) => `https://explorer.evm.iota.org/address/${address}`,
    chainId: 8822,
    accounts: mainnetAccounts,
  },
  lightLink: {
    url: getEnv('LIGHTLINK_RPC_URL') || 'https://replicator.phoenix.lightlink.io/rpc/v1',
    getExplorerUrl: (address: string) => `https://phoenix.lightlink.io/address/${address}`,
    chainId: 1890,
    accounts: mainnetAccounts,
  },
  linea: {
    url: getEnv('LINEA_RPC_URL') || 'https://rpc.linea.build',
    getExplorerUrl: (address: string) => `https://lineascan.build/address/${address}`,
    chainId: 59144,
    accounts: mainnetAccounts,
  },
  lineaDummy: {
    url: getEnv('LINEA_RPC_URL') || 'https://rpc.linea.build',
    getExplorerUrl: (address: string) => `https://lineascan.build/address/${address}`,
    chainId: 59144,
    accounts: dummyMainnetAccounts,
  },
  lineaTestnet: {
    url: getEnv('LINEA_TESTNET_RPC_URL') || 'https://rpc.sepolia.linea.build',
    getExplorerUrl: (address: string) => `https://sepolia.lineascan.build//address/${address}`,
    chainId: 59141,
    accounts: testnetAccounts,
  },
  polygon: {
    url: getEnv('POLYGON_RPC_URL') || 'https://polygon-rpc.com',
    getExplorerUrl: (address: string) => `https://polygonscan.com/address/${address}`,
    chainId: 137,
    accounts: mainnetAccounts,
  },
  polygonTestnet: {
    url: getEnv('POLYGON_TESTNET_RPC_URL') || 'https://rpc-mumbai.maticvigil.com/',
    getExplorerUrl: (address: string) => `https://mumbai.polygonscan.com/address/${address}`,
    chainId: 80001,
    accounts: testnetAccounts,
  },
  sepolia: {
    url: getEnv('SEPOLIA_TESTNET_RPC_URL') || 'https://rpc2.sepolia.org',
    getExplorerUrl: (address: string) => `https://sepolia.etherscan.io/address/${address}`,
    chainId: 11155111,
    accounts: testnetAccounts,
  },
  sonic: {
    url: getEnv('SONIC_RPC_URL') || 'https://sonic.drpc.org',
    getExplorerUrl: (address: string) => `https://sonicscan.org/address/${address}`,
    chainId: 146,
    accounts: mainnetAccounts,
  },
  sonicTestnet: {
    url: getEnv('SONIC_TESTNET_RPC_URL') || 'https://rpc.blaze.soniclabs.com',
    getExplorerUrl: (address: string) => `https://testnet.sonicscan.org/address/${address}`,
    chainId: 57054,
    accounts: testnetAccounts,
  },
  unichain: {
    url: getEnv('UNICHAIN_RPC_URL') || 'https://unichain.drpc.org',
    getExplorerUrl: (address: string) => `https://unichain.blockscout.com/address/${address}`,
    chainId: 130,
    accounts: mainnetAccounts,
  },
  unichainTestnet: {
    url: getEnv('UNICHAIN_TESTNET_RPC_URL') || 'https://unichain-testnet.drpc.org',
    getExplorerUrl: (address: string) => `https://unichain-sepolia.blockscout.com/address/${address}`,
    chainId: 1301,
    accounts: testnetAccounts,
  },
  zircuit: {
    url: getEnv('ZIRCUIT_RPC_URL') || 'https://zircuit-mainnet.drpc.org',
    getExplorerUrl: (address: string) => `https://explorer.zircuit.com/address/${address}`,
    chainId: 48900,
    accounts: mainnetAccounts,
  },
  zircuitTestnet: {
    url: getEnv('ZIRCUIT_TESTNET_RPC_URL') || 'https://zircuit1-testnet.p2pify.com',
    getExplorerUrl: (address: string) => `https://explorer.testnet.zircuit.com/address/${address}`,
    chainId: 48899,
    accounts: testnetAccounts,
  },
  // Placeholder for the configuration below.
  hardhat: {
    getExplorerUrl: (address: string) => `(NO DEV EXPLORER): ${address}`,
  },
}

export function getExplorerUrlForNetwork(networkName: Networks) {
  return networkConfig[networkName]?.getExplorerUrl
}

export function convertToExplorerUrlForNetwork(networkName: Networks, address: string) {
  return getExplorerUrlForNetwork(networkName)(address)
}

export function getTxExplorerUrlForNetwork(networkName: Networks, txHash: string) {
  const addressUrl = convertToExplorerUrlForNetwork(networkName, txHash)
  // Hacky way to keep the code dry
  const txUrl = addressUrl.replace('/address/', '/tx/')
  return txUrl
}

export function geRpcUrlForNetwork(networkName: Networks) {
  return (networkConfig[networkName] as HttpNetworkUserConfig).url
}

/**
 * Configure compiler versions in ./solhint.config.js
 *
 * @returns SolcUserConfig[]
 */
function getSolcUserConfig(): SolcUserConfig[] {
  return (solhintConfig.rules['compiler-version'][2] as string[]).map((compiler) => {
    return {
      // Adding multiple compiler versions
      // https://hardhat.org/hardhat-runner/docs/advanced/multiple-solidity-versions#multiple-solidity-versions
      version: compiler,
      settings: {
        optimizer: {
          enabled: true,
          runs: 1000,
        },
      },
    }
  })
}

const config: HardhatUserConfig = {
  solidity: { compilers: getSolcUserConfig() },
  networks: {
    ...networkConfig,
    hardhat: {
      gas: 'auto',
      gasPrice: 'auto',
      // Pass in accounts to use in the hardhat network. Helpful with forkIfHardhat().
      accounts: getEnv('TESTING')
        ? getHardhatNetworkAccounts(testnetAccounts)
        : getHardhatNetworkAccounts(mainnetAccounts),
    },
  },
  gasReporter: {
    // More options can be found here:
    // https://www.npmjs.com/package/hardhat-gas-reporter
    enabled: getEnv('REPORT_GAS') ? true : false,
    currency: 'USD',
    // Provide API Key for gas costs in USD. Get your API key from https://coinmarketcap.com/api/
    coinmarketcap: getEnv('COINMARKETCAP_API_KEY'),
    excludeContracts: [],
  },
  docgen: {
    outputDir: './docs/contracts',
    pages: 'files',
    exclude: ['/external', 'Migrations.sol', '/mocks'],
  },
  // hardhat-docgen
  // docgen: {
  //   output: './docs',
  //   clear: true,
  //   // TODO: Enable for each compile (disabled for template to avoid unnecessary generation)
  //   runOnCompile: false,
  // },
  typechain: {
    // outDir: 'src/types', // defaults to './typechain-types/'
    target: 'ethers-v5',
    externalArtifacts: ['./artifacts-external/**/*.json'], // optional array of glob patterns with external artifacts to process (for example external libs from node_modules)
    alwaysGenerateOverloads: false, // should overloads with full signatures like deposit(uint256) be generated always, even if there are no overloads?
    dontOverrideCompile: false, // defaults to false
  },
  contractSizer: {
    // https://github.com/ItsNickBarry/hardhat-contract-sizer#usage
    alphaSort: false, // whether to sort results table alphabetically (default sort is by contract size)
    disambiguatePaths: false, // whether to output the full path to the compilation artifact (relative to the Hardhat root directory)
    runOnCompile: false, // whether to output contract sizes automatically after compilation
    strict: false, // whether to throw an error if any contracts exceed the size limit
    // only: [':ERC20$'], // Array of String matchers used to include contracts
    // except: [':ERC20$'], // Array of String matchers used to exclude contracts
    // outputFile: './contract-size.md', // Optional output file to write to
  },
  etherscan: {
    apiKey: {
      mainnet: getEnv('ETHERSCAN_API_KEY'),
      optimisticEthereum: getEnv('OPTIMISTIC_ETHERSCAN_API_KEY'),
      arbitrumOne: getEnv('ARBISCAN_API_KEY'),
      avalanche: getEnv('AVAX_SCAN_API_KEY'),
      base: getEnv('BASESCAN_API_KEY'),
      bsc: getEnv('BSCSCAN_API_KEY'),
      bscTestnet: getEnv('BSCSCAN_API_KEY'),
      polygon: getEnv('POLYGONSCAN_API_KEY'),
      polygonMumbai: getEnv('POLYGONSCAN_API_KEY'),
      linea: getEnv('LINEASCAN_API_KEY'),
      lineaTestnet: getEnv('LINEASCAN_API_KEY'),
      sonic: getEnv('SONICSCAN_API_KEY'),
      sonicTestnet: getEnv('SONICSCAN_API_KEY'),
      unichain: 'empty',
      unichainTestnet: 'empty',
      zircuit: getEnv('ZIRCUITSCAN_API_KEY'),
      zircuitTestnet: getEnv('ZIRCUITSCAN_API_KEY'),
    },
    // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify#adding-support-for-other-networks
    customChains: [
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://basescan.org',
        },
      },
      {
        network: 'base-sepolia',
        chainId: 84532,
        urls: {
          apiURL: 'https://api-sepolia.basescan.org/api',
          browserURL: 'https://sepolia.basescan.org',
        },
      },
      {
        network: 'linea',
        chainId: 59144,
        urls: {
          apiURL: 'https://api.lineascan.build/api/',
          browserURL: 'https://lineascan.build/',
        },
      },
      {
        network: 'lineaTestnet',
        chainId: 59141,
        urls: {
          apiURL: 'https://api-sepolia.lineascan.build/api/',
          browserURL: 'https://sepolia.lineascan.build/',
        },
      },
      {
        network: 'sonic',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api',
          browserURL: 'https://sonicscan.org/',
        },
      },
      {
        network: 'sonicTestnet',
        chainId: 57054,
        urls: {
          apiURL: 'https://api-testnet.sonicscan.org/api/',
          browserURL: 'https://testnet.sonicscan.org/',
        },
      },
      {
        network: 'unichain',
        chainId: 130,
        urls: {
          apiURL: 'https://unichain.blockscout.com/api',
          browserURL: 'https://unichain.blockscout.com',
        },
      },
      {
        network: 'unichainTestnet',
        chainId: 1301,
        urls: {
          apiURL: 'https://unichain-sepolia.blockscout.com/api',
          browserURL: 'https://unichain-sepolia.blockscout.com',
        },
      },
      {
        network: 'zircuit',
        chainId: 48900,
        urls: {
          apiURL: 'https://explorer.zircuit.com/api/contractVerifyHardhat',
          browserURL: 'https://explorer.zircuit.com',
        },
      },
      {
        network: 'zircuitTestnet',
        chainId: 48899,
        urls: {
          apiURL: 'https://explorer.testnet.zircuit.com/api/contractVerifyHardhat',
          browserURL: 'https://explorer.testnet.zircuit.com',
        },
      },
    ],
  },
}

export default config
