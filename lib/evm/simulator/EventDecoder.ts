import { Interface } from '@ethersproject/abi'
import { DecodedEvent } from './simulation-types'

export class EventDecoder {
  private iface: Interface

  constructor() {
    // Common event signatures - can be extended
    const EVENT_ABI = {
      ProxyImplementationUpdated: 'event ProxyImplementationUpdated(address indexed implementation)',
      Upgraded: 'event Upgraded(address indexed implementation)',
    }

    this.iface = new Interface(Object.values(EVENT_ABI))
  }

  decodeLog(log: any): DecodedEvent | null {
    try {
      const decoded = this.iface.parseLog(log)
      return {
        name: decoded.name,
        args: decoded.args,
      }
    } catch {
      return null
    }
  }

  // Method to add more event signatures dynamically
  addEventSignature(signature: string) {
    this.iface = new Interface([...this.iface.fragments.map((f) => f.format()), signature])
  }
}
