import { ethers, network } from 'hardhat'
import { parseUnits } from 'ethers/lib/utils'
import { logger } from '../../hardhat/utils'
import { BigNumber } from 'ethers'
import { Networks } from '../../hardhat.config'

// TODO: Useful to extract out into the DeployManager or hardhat.config.ts
type GasNetworks = Extract<Networks, 'linea'>
type GasConfig = {
  [key in GasNetworks]: {
    gasPrice: BigNumber
    nonce: number
  }
}

const gasConfig: GasConfig = {
  linea: {
    gasPrice: parseUnits('.25', 'gwei'),
    nonce: 102,
  },
}

async function main() {
  const currentNetwork = network.name as GasNetworks

  if (!gasConfig[currentNetwork]) {
    throw new Error(`Gas config not found for network ${currentNetwork}`)
  }

  logger.logHeader('Use Nonce Script', '🔑')
  const [signer] = await ethers.getSigners()
  const nonce = gasConfig[currentNetwork].nonce

  const tx = await signer.sendTransaction({
    to: signer.address,
    value: 0,
    nonce,
    gasPrice: gasConfig[currentNetwork].gasPrice,
  })

  console.log(`Transaction sent with nonce ${nonce}`)
  console.log(`Transaction hash: ${tx.hash}`)
  await tx.wait()
  console.log('Transaction confirmed')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
