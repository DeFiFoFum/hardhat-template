import { BigNumber } from "ethers";

/**
 * Pass BN object, BN, or string returned from a smart contract and convert all BN values to strings to easily read them.
 * 
 * @param {*} bigNumberObject BN, Object of BNs or string
 * @returns All values are converted to a string
 */
export function formatBNValueToString(value: any) {
    if (typeof value === 'string' || typeof value == 'number' || (value as BigNumber)._isBigNumber) {
      return value.toString();
    } else if (typeof value === 'object') {
      // Functions with multiple returns can't be updated. A new object is used instead.
      const replacementValue: any = {};
      Object.keys(value).forEach(key => {
        replacementValue[key] = formatBNValueToString(value[key]);
      })
      return replacementValue;
    }
    return value;
}

export function addDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const multiplier = BigNumber.from(10).pow(decimals);
  return BigNumber.from(value).mul(multiplier);
}

export function removeDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const multiplier = BigNumber.from(10).pow(decimals);
  return BigNumber.from(value).div(multiplier);
}

export function normalizeDecimals(value: BigNumber | string, decimals: number | string): BigNumber {
  const currentMultiplier = BigNumber.from(10).pow(decimals);
  const targetMultiplier = BigNumber.from(10).pow(18);
  const normalizedValue = BigNumber.from(value).mul(targetMultiplier).div(currentMultiplier);
  return normalizedValue;
}