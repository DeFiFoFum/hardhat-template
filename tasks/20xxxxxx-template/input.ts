import { Networks } from '../../hardhat'

export type ConfiguredNetworks = Extract<
  Networks,
  'mainnet' | 'goerli' | 'bsc' | 'bscTestnet' | 'polygon' | 'polygonTestnet' | 'hardhat'
>

export type DeploymentInputs = {
  admin: string
}

const deploymentInputs: Record<ConfiguredNetworks, DeploymentInputs> = {
  mainnet: {
    admin: '0x',
  },
  goerli: {
    admin: '0x',
  },
  bsc: {
    admin: '0x',
  },
  bscTestnet: {
    admin: '0x',
  },
  polygon: {
    admin: '0x',
  },
  polygonTestnet: {
    admin: '0x',
  },
  hardhat: {
    admin: '0x',
  },
}

export default deploymentInputs
