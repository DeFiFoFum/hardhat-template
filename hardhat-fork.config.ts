import { getEnv } from './hardhat/utils'
import hardhatConfig from './hardhat.config'

export default {
  ...hardhatConfig,
  networks: {
    ...hardhatConfig.networks,
    hardhat: {
      allowUnlimitedContractSize: false,
      forking: {
        url: getEnv('FORK_RPC_URL') || '',
      },
    },
  },
}
