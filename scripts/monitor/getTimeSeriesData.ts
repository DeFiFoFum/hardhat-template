import { ethers } from 'hardhat'
import { getTimeSeriesData } from '../../lib/evm/getTimeSeriesData'
import { DeployableNetworks } from '../deploy/deploy.config'
import { setupFork } from '../../lib/evm/fork-testing/forkHelper'
import { formatUnits } from 'ethers/lib/utils'
import { writeObjectToTsFile } from '../../lib/node/files'
import path from 'path'

async function script() {
  const networkToFork = 'polygon'
  await setupFork(networkToFork, undefined)

  const tokenAddress = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' // USDC Token on Polygon
  const tokenContract = await ethers.getContractAt('ERC20', tokenAddress)
  const tokenDecimals = await tokenContract.decimals()

  const timeSeries = await getTimeSeriesData(
    {
      // NOTE: BSC Nodes seem to have issues with forking btw. "Missing Trie Node"
      forkNetwork: 'polygon' as DeployableNetworks,
      fromBlock: 45319261, // Deployment block,
      toBlock: 'latest',
      blockInterval: 2000000,
    },
    {
      contract: tokenContract,
      functionName: 'totalSupply',
      params: [],
    }
  )

  // Convert the BigNumber values to strings
  const convertedOutput = Object.keys(timeSeries).reduce<{ [key: number]: string }>((acc, key) => {
    acc[Number(key)] = formatUnits(timeSeries[Number(key)].toString(), tokenDecimals)
    return acc
  }, {})

  const filePath = path.join(__dirname, 'output', 'timeSeries_Output')
  await writeObjectToTsFile(filePath, 'timeSeries', convertedOutput)
  console.dir(convertedOutput, { depth: null })
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
