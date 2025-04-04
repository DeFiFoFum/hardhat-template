import { Interface } from '@ethersproject/abi'
import { DecodedEvent, FormattedLog, SimulationResult } from '../simulator/simulation-types'
import { logger } from '../../node/logger'

export class EventHandler {
  private iface: Interface

  constructor() {
    // Common event signatures - can be extended
    const EVENT_ABI = {
      ProxyImplementationUpdated: 'event ProxyImplementationUpdated(address indexed implementation)',
      Upgraded: 'event Upgraded(address indexed implementation)',
      // AccessControl events
      RoleGranted: 'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
      RoleRevoked: 'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
      RoleAdminChanged:
        'event RoleAdminChanged(bytes32 indexed role, bytes32 indexed previousAdminRole, bytes32 indexed newAdminRole)',
      // Ownable events
      OwnershipTransferred: 'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
      OwnershipTransferStarted:
        'event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)',
      // Proxy Admin
      AdminChanged: 'event AdminChanged(address previousAdmin, address newAdmin)',
      BeaconUpgraded: 'event BeaconUpgraded(address indexed beacon)',
    }

    this.iface = new Interface(Object.values(EVENT_ABI))
  }

  // Helper function to get human-readable role names
  getRoleName(roleHash: string): string {
    const roleMap: Record<string, string> = {
      '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5': 'TIMELOCK_ADMIN_ROLE',
      '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1': 'PROPOSER_ROLE',
      '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63': 'EXECUTOR_ROLE',
      '0xfd643c72710c63c0180259aba6b2d05451e3591a24e58b62239378085726f783': 'CANCELLER_ROLE',
      '0x0000000000000000000000000000000000000000000000000000000000000000': 'DEFAULT_ADMIN_ROLE',
    }
    return roleMap[roleHash.toLowerCase()] || roleHash
  }

  /**
   * Decode a log entry into a human-readable event
   */
  decodeLog(log: any): DecodedEvent | null {
    try {
      const decoded = this.iface.parseLog(log)

      // Create a basic decoded event
      const decodedEvent: DecodedEvent = {
        name: decoded.name,
        args: decoded.args,
      }

      // Add human-readable descriptions for specific events
      if (decoded.name === 'RoleGranted') {
        const roleName = this.getRoleName(decoded.args.role)
        const account = decoded.args.account
        const sender = decoded.args.sender
        decodedEvent.description = `Role ${roleName} granted to ${account} by ${sender}`
      } else if (decoded.name === 'RoleRevoked') {
        const roleName = this.getRoleName(decoded.args.role)
        const account = decoded.args.account
        const sender = decoded.args.sender
        decodedEvent.description = `Role ${roleName} revoked from ${account} by ${sender}`
      } else if (decoded.name === 'RoleAdminChanged') {
        const roleName = this.getRoleName(decoded.args.role)
        const prevAdminRole = this.getRoleName(decoded.args.previousAdminRole)
        const newAdminRole = this.getRoleName(decoded.args.newAdminRole)
        decodedEvent.description = `Admin for ${roleName} changed from ${prevAdminRole} to ${newAdminRole}`
      } else if (decoded.name === 'Upgraded' || decoded.name === 'ProxyImplementationUpdated') {
        const implementation = decoded.args.implementation
        decodedEvent.description = `Contract upgraded to implementation at ${implementation}`
      }

      return decodedEvent
    } catch {
      return null
    }
  }

  /**
   * Format and display transaction results with events
   */
  // TODO: Remove dependency on SimulationResult
  formatTransactionResults(results: SimulationResult[]) {
    if (results.length === 0) {
      logger.log('No transactions executed', '📜')
      return
    }

    return results.map((result, txIndex) => {
      const { receipt } = result

      logger.log(`\nTransaction ${txIndex + 1} Summary:`, '📊')
      logger.log(`Status: ${receipt.status}`, '📊')
      logger.log(`From: ${receipt.from}`, '📊')
      logger.log(`To: ${receipt.to}`, '📊')

      // Check if this is a batch transaction with multiple results
      if (receipt.logs.length > 0) {
        logger.log(`Events:`, '📜')

        // Group logs by contract address for better organization
        const logsByContract: Record<string, FormattedLog[]> = {}

        receipt.logs.forEach((log) => {
          if (!logsByContract[log.address]) {
            logsByContract[log.address] = []
          }
          logsByContract[log.address].push(log)
        })

        // Display logs grouped by contract
        const formattedLogs = Object.entries(logsByContract).map(([address, logs]) => {
          logger.log(`\n  Contract: ${address}`, '📜')

          // Format logs into a structured object for console.dir
          const formattedEvents = logs.map((log) => {
            if (log.decodedEvent) {
              const { name, description, args } = log.decodedEvent

              // Format args to only include named properties (skip numeric indices)
              const formattedArgs: Record<string, any> = {}
              if (args) {
                Object.keys(args).forEach((key) => {
                  if (isNaN(Number(key))) {
                    // Skip numeric keys (array indices)
                    formattedArgs[key] = args[key]
                  }
                })
              }

              return {
                name,
                description: description || 'No description available',
                data: log.data,
                args: formattedArgs,
                topics: log.topics,
              }
            } else {
              return {
                name: 'Unknown Event',
                description: 'Could not decode event',
                data: log.data,
                args: undefined,
                topics: log.topics,
              }
            }
          })

          return formattedEvents
        })
        return formattedLogs
      } else {
        logger.log('No events emitted', '📜')
      }
    })
  }

  // Method to add more event signatures dynamically
  addEventSignature(signature: string) {
    this.iface = new Interface([...this.iface.fragments.map((f) => f.format()), signature])
  }
}
