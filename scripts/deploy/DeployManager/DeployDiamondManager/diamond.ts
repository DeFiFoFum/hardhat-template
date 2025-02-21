/* global ethers */
import { ethers } from 'hardhat'
import { Contract } from 'ethers'

export const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 }

interface Selector {
  contract: Contract
  signatures: string[]
}

// get function selectors from ABI
export const getSelectors = (contract: Contract) => {
  const signatures = Object.keys(contract.interface.functions)
  const sigs = signatures.reduce((acc: string[], val: string) => {
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getSighash(val))
    }
    return acc
  }, [])
  const selectors: Selector = { contract, signatures: sigs }
  return selectors
}

// get function selector from function signature
export const getSelector = (func: string) => {
  const abiInterface = new ethers.utils.Interface([func])
  return abiInterface.getSighash(ethers.utils.Fragment.from(func))
}

// used with getSelectors to remove selectors from an array of selectors
// functionNames argument is an array of function signatures
export const remove = (that: Selector, functionNames: string[]) => {
  const sigs = that.signatures.filter((v) => {
    for (const functionName of functionNames) {
      if (v === that.contract.interface.getSighash(functionName)) {
        return false
      }
    }
    return true
  })
  const selectors = { contract: that.contract, signatures: sigs }
  return selectors
}

// used with getSelectors to get selectors from an array of selectors
// functionNames argument is an array of function signatures
export const get = (that: Selector, functionNames: string[]) => {
  const sigs = that.signatures.filter((v) => {
    for (const functionName of functionNames) {
      if (v === that.contract.interface.getSighash(functionName)) {
        return true
      }
    }
    return false
  })
  const selectors = { contract: that.contract, signatures: sigs }
  return selectors
}

// remove selectors using an array of signatures
export const removeSelectors = (selectors: Selector, signatures: string[]) => {
  const iface = new ethers.utils.Interface(signatures.map((v) => 'function ' + v))
  const removeSelectors = signatures.map((v) => iface.getSighash(v))
  const sigs = selectors.signatures.filter((v) => !removeSelectors.includes(v))
  const select = { contract: selectors.contract, signatures: sigs }
  return select
}

// find a particular address position in the return value of diamondLoupeFacet.facets()
export const findAddressPositionInFacets = (facetAddress: string, facets: Contract) => {
  for (let i = 0; i < facets.length; i++) {
    if (facets[i].facetAddress === facetAddress) {
      return i
    }
  }
}

export const diamondLib = () => {}
