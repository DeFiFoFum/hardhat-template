import { getExplorerUrlForNetwork } from '../../../hardhat.config'
import { Networks } from '../../../hardhat.config'

export const isAddress = (address?: string) =>
  address ? (address.length === 42 && address.slice(0, 2) === '0x' ? true : false) : false

/**
 * Iterates through an object and converts any address strings to objects with address and explorer link
 *
 * @param {Object<any>} addressObject Object to iterate through looking for possible addresses to convert
 * @param {Networks} networkName The current hardhat network name
 * @param {Record<string, string>} [addressToNameMap] Optional mapping of addresses to names
 * @returns parsedAddressObject
 */
export function convertAddressesToExplorerLinksByNetwork(
  addressObject: any,
  networkName: Networks,
  addressToNameMap?: Record<string, string>,
) {
  const getExplorerLink = getExplorerUrlForNetwork(networkName)
  return convertAddressesToExplorerLinks(addressObject, getExplorerLink, addressToNameMap)
}

/**
 * Iterates through an object and converts any address strings to objects with address and explorer link
 *
 * @param {Object<any>} addressObject Object to iterate through looking for possible addresses to convert
 * @param {(address: string) => string} getLink Function which takes an address and converts to an explorer link
 * @param {Record<string, string>} [addressToNameMap] Optional mapping of addresses to names
 * @returns parsedAddressObject
 */
export function convertAddressesToExplorerLinks(
  addressObject: any,
  getLink: (address: string) => string,
  addressToNameMap?: Record<string, string>,
) {
  // Using an internal function to allow for deep copying before
  function _convertAddressesToExplorerLinks(_addressObject: any, _getLink: (address: string) => string) {
    // Return early if _addressObject is null or undefined
    if (_addressObject == null) {
      return _addressObject
    }

    Object.keys(_addressObject).forEach((key) => {
      const value = _addressObject[key]
      if (typeof value === 'string') {
        // Check if value is an address
        if (isAddress(value)) {
          const addressObj: any = {
            address: value,
            explorer: _getLink(value),
          }

          // Add name if available in the address mapping
          if (addressToNameMap && addressToNameMap[value.toLowerCase()]) {
            addressObj.name = addressToNameMap[value.toLowerCase()]
          }

          _addressObject[key] = addressObj
        }
      } else {
        _convertAddressesToExplorerLinks(value, _getLink)
      }
    })
    return _addressObject
  }
  const addrObjDeepCopy = JSON.parse(JSON.stringify(addressObject))
  return _convertAddressesToExplorerLinks(addrObjDeepCopy, getLink)
}
