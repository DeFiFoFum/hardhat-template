import { expect } from 'chai'
import {
  convertAddressesToExplorerLinks,
  convertAddressesToExplorerLinksByNetwork,
  isAddress,
  isTxHash,
} from './convertAddresses'
import { NETWORKS } from '../../../hardhat.config'

describe('Address Conversion Utils', () => {
  describe('isAddress', () => {
    it('should return true for valid Ethereum addresses', () => {
      expect(isAddress('0x1234567890123456789012345678901234567890')).to.be.true
    })

    it('should return false for invalid addresses', () => {
      expect(isAddress('0x123')).to.be.false
      expect(isAddress('not an address')).to.be.false
      expect(isAddress('')).to.be.false
      expect(isAddress(undefined)).to.be.false
    })
  })

  describe('isTxHash', () => {
    it('should return true for valid transaction hashes', () => {
      expect(isTxHash('0x1234567890123456789012345678901234567890123456789012345678901234')).to.be.true
    })

    it('should return false for invalid transaction hashes', () => {
      expect(isTxHash('0x123')).to.be.false
      expect(isTxHash('not a hash')).to.be.false
      expect(isTxHash('')).to.be.false
      expect(isTxHash(undefined)).to.be.false
    })
  })

  describe('convertAddressesToExplorerLinks', () => {
    const mockGetLink = (address: string) => `https://example.com/address/${address}`
    const testAddress = '0x1234567890123456789012345678901234567890'
    const testTxHash = '0x1234567890123456789012345678901234567890123456789012345678901234'

    it('should convert addresses in object to address objects with explorer links', () => {
      const input = {
        someAddress: testAddress,
        nested: {
          anotherAddress: testAddress,
        },
      }

      const result = convertAddressesToExplorerLinks(input, mockGetLink)

      expect(result.someAddress).to.deep.equal({
        address: testAddress,
        explorer: `https://example.com/address/${testAddress}`,
      })

      expect(result.nested.anotherAddress).to.deep.equal({
        address: testAddress,
        explorer: `https://example.com/address/${testAddress}`,
      })
    })

    it('should convert transaction hashes to tx objects with explorer links', () => {
      const input = {
        someTx: testTxHash,
      }

      const result = convertAddressesToExplorerLinks(input, mockGetLink)

      expect(result.someTx).to.deep.equal({
        txHash: testTxHash,
        explorer: `https://example.com/tx/${testTxHash}`,
      })
    })

    it('should handle address name mapping', () => {
      const addressToNameMap = {
        [testAddress.toLowerCase()]: 'Test Contract',
      }

      const input = {
        someAddress: testAddress,
      }

      const result = convertAddressesToExplorerLinks(input, mockGetLink, addressToNameMap)

      expect(result.someAddress).to.deep.equal({
        address: testAddress,
        explorer: `https://example.com/address/${testAddress}`,
        name: 'Test Contract',
      })
    })

    it('should handle null and undefined values', () => {
      const input = {
        nullValue: null,
        undefinedValue: undefined,
        someAddress: testAddress,
      }

      const result = convertAddressesToExplorerLinks(input, mockGetLink)

      expect(result.nullValue).to.be.null
      expect(result.undefinedValue).to.be.undefined
      expect(result.someAddress).to.deep.equal({
        address: testAddress,
        explorer: `https://example.com/address/${testAddress}`,
      })
    })
  })

  describe('convertAddressesToExplorerLinksByNetwork', () => {
    const testAddress = '0x1234567890123456789012345678901234567890'

    it('should convert addresses using network-specific explorer links', () => {
      const input = {
        someAddress: testAddress,
      }

      const result = convertAddressesToExplorerLinksByNetwork(input, NETWORKS[0])

      expect(result.someAddress).to.have.property('address', testAddress)
      expect(result.someAddress).to.have.property('explorer')
    })
  })
})
