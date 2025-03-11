import fs from 'fs'
import path from 'path'
import { parse } from 'csv-parse/sync'

/**
 * Interface for an address book entry
 */
export interface AddressBookEntry {
  address: string
  name: string
  chainId: number
}

/**
 * Reads and parses a CSV address book file
 *
 * @param {string} csvPath Path to the CSV file
 * @param {number} [filterChainId] Optional chain ID to filter entries by
 * @returns {AddressBookEntry[]} Array of address book entries
 */
export function readAddressBook(csvPath: string, filterChainId?: number): AddressBookEntry[] {
  // Read file content
  let csvContent = fs.readFileSync(path.resolve(csvPath), 'utf8')

  // Remove BOM if present
  if (csvContent.charCodeAt(0) === 0xfeff) {
    csvContent = csvContent.slice(1)
  }

  // Parse CSV (skipping header row)
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  })

  // Convert to AddressBookEntry objects
  const entries: AddressBookEntry[] = records.map((record: any) => ({
    address: record.address,
    name: record.name,
    chainId: parseInt(record.chainId, 10),
  }))

  // Filter by chain ID if specified
  return filterChainId ? entries.filter((entry) => entry.chainId === filterChainId) : entries
}

/**
 * Converts an array of address book entries to a mapping of addresses to names
 *
 * @param {AddressBookEntry[]} entries Array of address book entries
 * @returns {Record<string, string>} Mapping of lowercase addresses to names
 */
export function createAddressToNameMap(entries: AddressBookEntry[]): Record<string, string> {
  return entries.reduce((map, entry) => {
    map[entry.address.toLowerCase()] = entry.name
    return map
  }, {} as Record<string, string>)
}

/**
 * Reads a CSV address book file and returns a mapping of addresses to names
 *
 * @param {string} csvPath Path to the CSV file
 * @param {number} [filterChainId] Optional chain ID to filter entries by
 * @returns {Record<string, string>} Mapping of lowercase addresses to names
 */
export function getAddressToNameMap(csvPath: string, filterChainId?: number): Record<string, string> {
  const entries = readAddressBook(csvPath, filterChainId)
  return createAddressToNameMap(entries)
}
