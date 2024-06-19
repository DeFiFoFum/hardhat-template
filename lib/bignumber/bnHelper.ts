import { BigNumber } from 'ethers'

/**
 * Pass BN object, BN, or string returned from a smart contract and convert all BN values to strings to easily read them.
 *
 * @param {*} value BN, Object of BNs or string
 * @param {Set<any>} [seen] A set to track seen objects to avoid circular references
 * @returns All values are converted to a string
 */
export function formatBNValueToString(value: any, seen: Set<any> = new Set()) {
  // Explicitly handle undefined and null values
  if (value === undefined || value === null) {
    return value
  }

  // Check if the value is a string, number, or BigNumber and convert to string
  if (typeof value === 'string' || typeof value === 'number' || (value as BigNumber)?._isBigNumber) {
    return value.toString()
  }

  // Check if the value is a non-null object
  if (typeof value === 'object') {
    // Detect circular references
    if (seen.has(value)) {
      return '[Circular]'
    }
    seen.add(value)

    // Functions with multiple returns can't be updated. A new object is used instead.
    const replacementValue: any = {}
    Object.keys(value).forEach((key) => {
      replacementValue[key] = formatBNValueToString(value[key], seen)
    })
    return replacementValue
  }

  // Return the value as is if it doesn't match any of the above conditions
  return value
}

export function addDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const multiplier = BigNumber.from(10).pow(decimals)
  return BigNumber.from(value).mul(multiplier)
}

export function removeDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const multiplier = BigNumber.from(10).pow(decimals)
  return BigNumber.from(value).div(multiplier)
}

export function normalizeDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const currentMultiplier = BigNumber.from(10).pow(decimals)
  const targetMultiplier = BigNumber.from(10).pow(18)
  const normalizedValue = BigNumber.from(value).mul(targetMultiplier).div(currentMultiplier)
  return normalizedValue
}
