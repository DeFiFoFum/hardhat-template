import { Libraries } from 'hardhat/types'

/**
 * Maps contract names to the libraries they depend on
 * This is used by the DeployManager to link libraries during deployment
 */
export type ContractNameToLibraryAddress = { [name: string]: Libraries }

/**
 * Core libraries that need to be deployed first
 * These are libraries that other contracts depend on
 */
// TODO: Add libraries as needed
export const coreLibraries = ['LibraryContract']

/**
 * Libraries configuration for contracts
 * Key is the contract name, value is an object mapping library names to their addresses
 * During deployment, this configuration will be used to link contracts to their libraries
 */
export const contractLibrariesConfig: ContractNameToLibraryAddress = {
  // ContractOneWithLibrary: {
  //   LibraryContract: '', // Address will be populated during deployment
  // },
  // ContractTwoWithLibrary: {
  //   LibraryContract: '', // Address will be populated during deployment
  // },
}

/**
 * Updates the library addresses in the configuration
 * @param libraryNameToAddress Map of library names to their deployed addresses
 * @returns Updated configuration
 */
export function updateLibraryAddresses(libraryNameToAddress: { [name: string]: string }): ContractNameToLibraryAddress {
  const updatedConfig = { ...contractLibrariesConfig }

  // For each contract in the config
  Object.keys(updatedConfig).forEach((contractName) => {
    const libraries = updatedConfig[contractName]

    // For each library used by this contract
    Object.keys(libraries).forEach((libraryName) => {
      // If we have the address for this library, update it
      if (libraryNameToAddress[libraryName]) {
        libraries[libraryName] = libraryNameToAddress[libraryName]
      }
    })
  })

  return updatedConfig
}

/**
 * Gets the library configuration for a specific contract
 * @param contractName The name of the contract
 * @returns The libraries configuration for the contract or undefined if none
 */
export function getLibrariesForContract(contractName: string): Libraries | undefined {
  return contractLibrariesConfig[contractName]
}
