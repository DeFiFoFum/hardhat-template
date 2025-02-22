import { network } from 'hardhat'
import { logger } from '../../../../lib/node/logger'
import { BaseSnapshotManager, ISnapshotStorage } from './ISnapshotManager'

export class MemorySnapshotManager extends BaseSnapshotManager {
  private currentSnapshot: ISnapshotStorage | null = null

  constructor() {
    super()
    this.loadSnapshot()
  }

  protected loadSnapshot(): ISnapshotStorage {
    if (this.currentSnapshot) {
      return this.currentSnapshot
    }

    if (network.name === 'hardhat') {
      // Initialize new snapshot for hardhat environment
      this.initializeNewSnapshot()
      logger.log('Created new snapshot for hardhat environment', '🗑️')
    } else {
      this.initializeNewSnapshot()
    }

    return this.currentSnapshot!
  }

  protected saveSnapshot(snapshot: ISnapshotStorage): void {
    this.currentSnapshot = snapshot
    logger.log('Deployment snapshot saved in memory', '💾')
  }

  private initializeNewSnapshot(): void {
    this.currentSnapshot = {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployedContracts: {},
      currentStep: '',
      deploymentConfig: {},
      contractIndices: {},
    }
    this.saveSnapshot(this.currentSnapshot)
  }
}
