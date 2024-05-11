// Network Config
export const NETWORKS = <const>[
  'hardhat', // Internal network for testing
  'mainnet', // Ethereum mainnet
  // Alphabetic order
  'arbitrum',
  'arbitrumGoerli',
  'bsc',
  'bscTestnet',
  'goerli',
  'linea',
  'lineaTestnet',
  'polygon',
  'polygonTestnet',
  'sepolia',
]
// Create a type out of the network array
export type Networks = (typeof NETWORKS)[number]
