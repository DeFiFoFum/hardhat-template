import fs from 'fs'
import path from 'path'
import { ethers } from 'hardhat'

/**
 * NOTE: This only works with initialize-able contracts currently.
 */
async function generateBytecodeJson() {
  const contractName = 'LockUpgradeable'

  // // Get command line arguments
  // const args = process.argv.slice(2)
  // if (args.length < 1) {
  //   console.error('Please provide the contract name as an argument')
  //   console.error('Usage: npx hardhat run scripts/utils/generateBytecodeJson.ts -- ContractName')
  //   process.exit(1)
  // }

  try {
    // Get contract factory
    const factory = await ethers.getContractFactory(contractName)

    // Get init code (deployment bytecode)
    const initCode = factory.getDeployTransaction().data
    if (!initCode) throw new Error('generateBytecodeJson:: initCode is undefined')

    // Create output object
    const output = {
      contractName,
      artifactPatH: '',
      bytecode: initCode,
      bytecodeHash: ethers.utils.keccak256(initCode),
    }

    // Write to file
    const outputPath = path.join(process.cwd(), 'bytecode.json')
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))

    console.log(`✅ Generated bytecode.json for ${contractName}`)
    console.log(`📝 Bytecode hash: ${output.bytecodeHash}`)
    console.log(`📂 Output saved to: ${outputPath}`)
  } catch (error) {
    console.error(`❌ Error generating bytecode for ${contractName}:`, error)
    process.exit(1)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
generateBytecodeJson().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
