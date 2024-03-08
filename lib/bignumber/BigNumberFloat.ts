import { BigNumber as EthersBigNumber, BigNumberish } from 'ethers'

/**
 * A way to use float values with BigNumber from ethers.
 * This could be used as a way to refactor bignumber.js which allows for floats
 */
export class BigNumberFloat {
  private bigNumber: EthersBigNumber
  private decimals: number

  constructor(num: string | number) {
    const numberString = num.toString()
    const isValidNumber = /^-?\d+(\.\d+)?$/.test(numberString)
    if (!isValidNumber) {
      throw new Error('Invalid number format. There should be only one "." and the rest should be numbers.')
    }

    // Split the number into integer and decimal parts
    const [integerPart, decimalPart] = numberString.split('.')

    // Remove trailing zeros from the decimal part
    const normalizedDecimalPart = decimalPart ? decimalPart.replace(/0+$/, '') : ''

    // Concatenate the integer part and the normalized decimal part
    this.bigNumber = normalizedDecimalPart
      ? EthersBigNumber.from(integerPart + normalizedDecimalPart)
      : EthersBigNumber.from(integerPart)

    // Update the decimals count to reflect the normalized decimal part
    this.decimals = normalizedDecimalPart.length
  }

  static from(num: BigNumberish): BigNumberFloat {
    return new BigNumberFloat(num.toString())
  }

  add(num: BigNumberish): BigNumberFloat {
    const { bigNumber: addBigNumber, decimals: addDecimals } = this.extractBigNumberishValues(num)

    // Determine the maximum number of decimals
    const maxDecimals = Math.max(this.decimals, addDecimals)

    // Scale up both numbers to the same decimal place
    const scaledThisBigNumber = this.bigNumber.mul(EthersBigNumber.from(10).pow(maxDecimals - this.decimals))
    const scaledAddendBigNumber = addBigNumber.mul(EthersBigNumber.from(10).pow(maxDecimals - addDecimals))

    // Perform the addition
    const resultBigNumber = scaledThisBigNumber.add(scaledAddendBigNumber)

    // Create a new BigNumberFloat instance with the result
    const resultBigNumberFloat = new BigNumberFloat('0') // Initialize with zero
    resultBigNumberFloat.bigNumber = resultBigNumber
    resultBigNumberFloat.decimals = maxDecimals

    return resultBigNumberFloat
  }

  sub(num: BigNumberish): BigNumberFloat {
    const { bigNumber: subBigNumber, decimals: subDecimals } = this.extractBigNumberishValues(num)

    // Determine the maximum number of decimals
    const maxDecimals = Math.max(this.decimals, subDecimals)

    // Scale up both numbers to the same decimal place
    const scaledThisBigNumber = this.bigNumber.mul(EthersBigNumber.from(10).pow(maxDecimals - this.decimals))
    const scaledSubBigNumber = subBigNumber.mul(EthersBigNumber.from(10).pow(maxDecimals - subDecimals))

    // Perform the subtraction
    const resultBigNumber = scaledThisBigNumber.sub(scaledSubBigNumber)

    // Create a new BigNumberFloat instance with the result
    const resultBigNumberFloat = new BigNumberFloat('0') // Initialize with zero
    resultBigNumberFloat.bigNumber = resultBigNumber
    resultBigNumberFloat.decimals = maxDecimals

    return resultBigNumberFloat
  }

  /**
   * Multiplies the current BigNumberFloat with another number and returns a new BigNumberFloat instance.
   * @param num The number to multiply with.
   * @returns A new BigNumberFloat instance with the multiplied value.
   */
  mul(num: BigNumberish): BigNumberFloat {
    const { bigNumber: multiplierBigNumber, decimals: multiplierDecimals } = this.extractBigNumberishValues(num)

    // Multiply the values and sum the decimals
    const resultBigNumber = this.bigNumber.mul(multiplierBigNumber)
    const resultDecimals = this.decimals + multiplierDecimals

    // Create a new BigNumberFloat instance with the result
    const resultBigNumberFloat = new BigNumberFloat('0') // Initialize with zero
    resultBigNumberFloat.bigNumber = resultBigNumber
    resultBigNumberFloat.decimals = resultDecimals

    return resultBigNumberFloat
  }

  /**
   * Divides the current BigNumberFloat by another number and returns a new BigNumberFloat instance.
   * @param num The number to divide by.
   * @returns A new BigNumberFloat instance with the divided value.
   */
  div(num: BigNumberish): BigNumberFloat {
    const { bigNumber: divisorBigNumber, decimals: divisorDecimals } = this.extractBigNumberishValues(num)

    // Determine the minimum precision needed by comparing the lengths of the numbers
    const thisBigNumberLength = this.bigNumber.toString().length
    const divisorBigNumberLength = divisorBigNumber.toString().length - divisorDecimals // Adjust for decimals
    let precision = thisBigNumberLength - divisorBigNumberLength
    precision = precision < 6 ? 6 : precision // Minimum precision of 6

    // Scale up this.bigNumber by the determined precision
    const scaledThisBigNumber = this.bigNumber.mul(EthersBigNumber.from(10).pow(precision))

    // Perform the division
    const resultBigNumber = scaledThisBigNumber.div(divisorBigNumber)

    // Calculate the final number of decimals
    const finalDecimals = this.decimals + precision - divisorDecimals

    // Create a new BigNumberFloat instance with the result
    const resultBigNumberFloat = new BigNumberFloat('0') // Initialize with zero
    resultBigNumberFloat.bigNumber = resultBigNumber
    resultBigNumberFloat.decimals = finalDecimals

    return resultBigNumberFloat
  }

  toNumber(): number {
    return parseFloat(this.toString())
  }

  /**
   * Converts the BigNumberFloat to its string representation.
   * @returns The string representation of the BigNumberFloat.
   */
  toString(): string {
    let valueString = this.bigNumber.toString()

    // If there are no decimals, return the value as is.
    if (this.decimals === 0) {
      return valueString
    }

    // Pad the valueString with leading zeros if the number is less than the required decimals.
    valueString = valueString.padStart(this.decimals + 1, '0')

    // Insert a decimal point at the correct place.
    const integerPart = valueString.slice(0, -this.decimals) || '0'
    const decimalPart = valueString.slice(-this.decimals)

    // Combine the integer and decimal parts.
    let strValue = `${integerPart}.${decimalPart}`

    // Loop from the end of the string and remove trailing zeros and the decimal point if necessary.
    let index = strValue.length - 1
    while (strValue[index] === '0') {
      index-- // Remove trailing zeros
    }
    if (strValue[index] === '.') {
      index-- // Remove the decimal point if we end up with a whole number
    }
    // Return the substring from the start to the last non-zero digit or before the decimal point.
    strValue = strValue.slice(0, index + 1)

    return strValue
  }

  private extractBigNumberishValues(num: BigNumberish): { bigNumber: EthersBigNumber; decimals: number } {
    const numString = num.toString()
    const [numIntegerPart, numDecimalPart] = numString.split('.')
    const numDecimals = numDecimalPart ? numDecimalPart.length : 0
    const numBigNumber = numDecimalPart
      ? EthersBigNumber.from(numIntegerPart + numDecimalPart)
      : EthersBigNumber.from(numIntegerPart)
    return { bigNumber: numBigNumber, decimals: numDecimals }
  }
}
