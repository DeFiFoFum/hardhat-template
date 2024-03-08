import { expect } from 'chai'
import { BigNumberFloat } from './BigNumberFloat' // Adjust this import path to your BigNumber class location

describe('BigNumberFloat', function () {
  it('should return the string representation properly')
  it('should return the number representation properly')
  it('should add numbers correctly', function () {
    const num = BigNumberFloat.from(1.23)
    const finalNum = num.add(4.56)
    expect(finalNum.toNumber()).to.equal(5.79)
  })

  it('should subtract numbers correctly', function () {
    const num = BigNumberFloat.from(5.79)
    const finalNum = num.sub(4.56)
    expect(finalNum.toNumber()).to.equal(1.23)
  })

  it('should multiply numbers correctly', function () {
    const num = BigNumberFloat.from(1.23)
    const finalNum = num.mul(3.21)
    expect(finalNum.toNumber()).to.be.closeTo(3.9483, 0.0001)
  })

  it('should divide numbers correctly', function () {
    const num = BigNumberFloat.from(3.9503)
    const finalNum = num.div(3.21)
    expect(finalNum.toNumber()).to.be.closeTo(1.2306, 0.0001)
  })

  it('should handle complex operations', function () {
    const num = BigNumberFloat.from(1.23)
    const finalNum = num.add('4.56').mul(7.89).sub(0.12).div(3.45)
    expect(finalNum.toNumber()).to.be.closeTo(13.2066, 0.0001)
  })
})
