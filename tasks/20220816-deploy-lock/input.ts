import { Networks } from '../../hardhat'

export type ConfiguredNetworks = Extract<
  Networks,
  'mainnet' | 'goerli' | 'bsc' | 'bscTestnet' | 'polygon' | 'polygonTestnet' | 'hardhat'
>

export type DeploymentInputs = {
  unlockTime: number
}

const DEFAULT_UNLOCK = 100

const deploymentInputs: Record<ConfiguredNetworks, DeploymentInputs> = {
  mainnet: {
    unlockTime: DEFAULT_UNLOCK,
  },
  goerli: {
    unlockTime: DEFAULT_UNLOCK,
  },
  bsc: {
    unlockTime: DEFAULT_UNLOCK,
  },
  bscTestnet: {
    unlockTime: DEFAULT_UNLOCK,
  },
  polygon: {
    unlockTime: DEFAULT_UNLOCK,
  },
  polygonTestnet: {
    unlockTime: DEFAULT_UNLOCK,
  },
  hardhat: {
    unlockTime: DEFAULT_UNLOCK,
  },
}

export default deploymentInputs
