// Network Config
export const NETWORKS = <const>[
  'mainnet',
  'goerli',
  'arbitrum',
  'arbitrumGoerli',
  'bsc',
  'bscTestnet',
  'polygon',
  'polygonTestnet',
  'hardhat',
  'telos',
  'telosTestnet',
]
// Create a type out of the network array
export type Networks = (typeof NETWORKS)[number]
