import { network } from 'hardhat'
import { Networks } from '../../hardhat'
import { getImplementationOfProxyContract, getProxyAdminOfProxyContract } from '../../lib/evm/getProxyAdmin'
import { convertAddressesToExplorerLinksByNetwork } from '../../lib/evm/convertAddresses'

// NOTE: Import deployment files
// import { deployment } from '../../deployments/'

async function script() {
  const currentNetwork = network.name as Networks

  // npx hardhat run ./scripts/monitor/getProxyAdminForDeployment.ts --network arbitrum
  const proxyContractAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // Arbitrum WETH
  const { proxyAdminAddress, proxyAdminOwner } = await getProxyAdminOfProxyContract(
    currentNetwork,
    proxyContractAddress
  )
  const implementationAddress = await getImplementationOfProxyContract(currentNetwork, proxyContractAddress)

  const output = convertAddressesToExplorerLinksByNetwork(
    {
      proxyContractAddress,
      proxyAdminAddress,
      proxyAdminOwner,
      implementationAddress,
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
