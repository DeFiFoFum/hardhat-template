import { network } from 'hardhat'
import { Networks } from '../../hardhat'
import { getFallbackManagerForSafe } from '../../lib/evm/safe-wallet/getFallbackManagerForSafe'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'

// NOTE: Import deployment files
// import { deployment } from '../../deployments/'

async function script() {
  const currentNetwork = network.name as Networks

  const safeAddress = '0x-getFallbackManagerForSafe'

  const { fallbackManagerAddress } = await getFallbackManagerForSafe(currentNetwork, safeAddress)

  const output = convertAddressesToExplorerLinksByNetwork(
    {
      safeAddress,
      fallbackManagerAddress,
    },
    currentNetwork,
    true
  )

  console.dir(output, { depth: null })
}

;(async function () {
  try {
    await script()
    console.log('🎉')
    process.exit(0)
  } catch (e) {
    console.error('Error running script.')
    console.dir(e)
    process.exit(1)
  }
})()
