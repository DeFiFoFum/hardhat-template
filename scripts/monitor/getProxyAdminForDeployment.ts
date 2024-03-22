import { network } from 'hardhat'
import { Networks } from '../../hardhat'
import { getProxyAdminOfProxyContract } from '../../lib/evm/getProxyAdmin'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'

// NOTE: Import deployment files
// import { deployment } from '../../deployments/'

async function script() {
  const currentNetwork = network.name as Networks

  const proxyContractAddress = '0x'
  const proxyAdminAddress = await getProxyAdminOfProxyContract(currentNetwork, proxyContractAddress)

  const output = convertAddressesToExplorerLinksByNetwork(
    {
      proxyContractAddress,
      proxyAdminAddress,
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
