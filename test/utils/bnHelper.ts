import { BigNumber, BigNumberish } from 'ethers'

export function ether(ether: BigNumberish) {
  return BigNumber.from(ether).mul(BigNumber.from(10).pow(18))
}

export function addBNStr(a: BigNumberish, b: BigNumberish) {
  return BigNumber.from(a).add(BigNumber.from(b)).toString()
}

export function subBNStr(a: BigNumberish, b: BigNumberish) {
  return BigNumber.from(a).sub(BigNumber.from(b)).toString()
}

export function mulBNStr(a: BigNumberish, b: BigNumberish) {
  return BigNumber.from(a).mul(BigNumber.from(b)).toString()
}

export function divBNStr(a: BigNumberish, b: BigNumberish) {
  return BigNumber.from(a).div(BigNumber.from(b)).toString()
}

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

/**
 * Check that a BN/BN String is within a percentage tolerance of another big number
 *
 * @param {*} bnToCheck BN or string of the value to check
 * @param {*} bnExpected BN or string of the value to compare against
 * @param {*} tolerancePercentage (1% = 1e4) Percentage to add/subtract from expected value to check tolerance
 * @param {'both' | 'greater' | 'less'} direction ('both' = lower and upper) ('less' = lower) ('greater' = upper)
 * @returns boolean
 */
export function isWithinLimit(
  bnToCheck: BigNumberish,
  bnExpected: BigNumberish,
  tolerancePercentage = 1e4,
  direction: 'both' | 'greater' | 'less' = 'both'
) {
  bnToCheck = BigNumber.from(bnToCheck)
  bnExpected = BigNumber.from(bnExpected)
  const tolerance = bnExpected.mul(BigNumber.from(tolerancePercentage)).div(BigNumber.from(1e6))
  let withinTolerance = true
  if ((direction === 'greater' || direction === 'both') && bnToCheck.gt(bnExpected.add(tolerance))) {
    console.error(
      `bnHelper::isWithinLimit - ${bnToCheck.toString()} gte upper tolerance limit of ${
        tolerancePercentage / 1e4
      }% to a value of ${bnExpected.add(tolerance).toString()}`
    )
    withinTolerance = false
  }

  if ((direction === 'less' || direction === 'both') && bnToCheck.lt(bnExpected.sub(tolerance))) {
    console.error(
      `bnHelper::isWithinLimit - ${bnToCheck.toString()} lte lower tolerance limit of ${
        tolerancePercentage / 1e4
      }% to a value of ${bnExpected.sub(tolerance).toString()}`
    )
    withinTolerance = false
  }

  return withinTolerance
}
/**
 * Check that a BN/BN String is within a range of another big number.
 *
 * @param {*} bnToCheck BN or string of the value to check
 * @param {*} bnExpected BN or string of the value to compare against
 * @param {*} tolerance Wei amount within limits
 * @param {'both' | 'greater' | 'less'} direction ('both' = lower and upper) ('less' = lower) ('greater' = upper)
 * @returns boolean
 */
export function isWithinWeiLimit(
  bnToCheck: BigNumberish,
  bnExpected: BigNumberish,
  tolerance = BigNumber.from(0),
  direction: 'both' | 'greater' | 'less' = 'both'
) {
  bnToCheck = BigNumber.from(bnToCheck)
  bnExpected = BigNumber.from(bnExpected)
  let withinTolerance = true
  if ((direction === 'both' || direction === 'greater') && bnToCheck.gte(bnExpected.add(tolerance))) {
    console.error(
      `bnHelper::isWithinWeiLimit - ${bnToCheck.toString()} gte upper tolerance limit of ${tolerance} wei to a value of ${bnExpected
        .add(tolerance)
        .toString()}`
    )
    withinTolerance = false
  }

  if ((direction === 'both' || direction === 'less') && bnToCheck.lte(bnExpected.sub(tolerance))) {
    console.error(
      `bnHelper::isWithinWeiLimit - ${bnToCheck.toString()} lte lower tolerance limit of ${tolerance} wei to a value of ${bnExpected
        .sub(tolerance)
        .toString()}`
    )
    withinTolerance = false
  }

  return withinTolerance
}
