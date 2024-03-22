import { HardhatUserConfig, task, types } from 'hardhat/config'
import {
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
// Project Config
import solhintConfig from './solhint.config'
import { getEnv, Logger, logger, testRunner } from './hardhat/utils'
import { Networks } from './hardhat'

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
 * Provide additional fork testing options
 *
 * eg: `npx hardhat test --fork <network-name> --blockNumber <block-number>`
 */
task(TASK_TEST, '🫶 Test Task')
  .addOptionalParam('fork', 'Optional network name to be forked block number to fork in case of running fork tests.')
  .addOptionalParam('blockNumber', 'Optional block number to fork in case of running fork tests.', undefined, types.int)
  .setAction(testRunner)

const mainnetMnemonic = getEnv('MAINNET_MNEMONIC')
const mainnetPrivateKey = getEnv('MAINNET_PRIVATE_KEY')
const mainnetAccounts: HttpNetworkAccountsUserConfig | undefined = mainnetMnemonic
  ? { mnemonic: mainnetMnemonic }
  : mainnetPrivateKey
  ? [mainnetPrivateKey] // Fallback to private key
  : undefined

const testnetMnemonic = getEnv('TESTNET_MNEMONIC')
const testnetPrivateKey = getEnv('TESTNET_PRIVATE_KEY')
const testnetAccounts: HttpNetworkAccountsUserConfig | undefined = testnetMnemonic
  ? { mnemonic: testnetMnemonic }
  : testnetPrivateKey
  ? [testnetPrivateKey] // Fallback to private key
  : undefined

type ExtendedNetworkOptions = {
  getExplorerUrl: (address: string) => string
}

type NetworkUserConfigExtended = HttpNetworkUserConfig & ExtendedNetworkOptions

// Custom type for the hardhat network
type ExtendedHardhatNetworkConfig = {
  [K in Networks]: K extends 'hardhat' ? HardhatUserConfig & ExtendedNetworkOptions : NetworkUserConfigExtended
}

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
  bsc: {
    url: getEnv('BSC_RPC_URL') || 'https://bsc-dataseed1.binance.org',
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
  polygon: {
    url: getEnv('POLYGON_RPC_URL') || 'https://polygon.llamarpc.com',
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
    },
  },
  gasReporter: {
    // More options can be found here:
    // https://www.npmjs.com/package/hardhat-gas-reporter
    enabled: getEnv('REPORT_GAS') ? true : false,
    currency: 'USD',
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
    /**
     * // NOTE This is valid in the latest version of "@nomiclabs/hardhat-etherscan.
     *  This version breaks the src/task.ts file which hasn't been refactored yet
     */
    apiKey: {
      mainnet: getEnv('ETHERSCAN_API_KEY'),
      optimisticEthereum: getEnv('OPTIMISTIC_ETHERSCAN_API_KEY'),
      arbitrumOne: getEnv('ARBISCAN_API_KEY'),
      bsc: getEnv('BSCSCAN_API_KEY'),
      bscTestnet: getEnv('BSCSCAN_API_KEY'),
      polygon: getEnv('POLYGONSCAN_API_KEY'),
      polygonMumbai: getEnv('POLYGONSCAN_API_KEY'),
    },
    // https://hardhat.org/hardhat-runner/plugins/nomicfoundation-hardhat-verify#adding-support-for-other-networks
    customChains: [
      // {
      //   network: '',
      //   chainId: 1,
      //   urls: {
      //     apiURL: '',
      //     browserURL: 'https://www.etherscan.io',
      //   },
      // },
    ],
  },
}

export default config
