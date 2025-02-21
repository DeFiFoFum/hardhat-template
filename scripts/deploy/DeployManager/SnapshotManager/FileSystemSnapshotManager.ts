import fs from 'fs'
import path from 'path'
import { network } from 'hardhat'
import { logger } from '../../../../hardhat/utils/logger'
import { BaseSnapshotManager, ISnapshotStorage } from './ISnapshotManager'

export class FileSystemSnapshotManager extends BaseSnapshotManager {
  private snapshotPath: string
  private currentSnapshot: ISnapshotStorage | null = null

  constructor(baseDir: string) {
    super()
    // Create snapshots directory if it doesn't exist
    const snapshotsDir = path.join(baseDir, 'snapshots')
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true })
    }

    // Use network name in snapshot file path
    this.snapshotPath = path.join(snapshotsDir, `${network.name}-deployment-snapshot.json`)
    this.loadSnapshot()
  }

  protected loadSnapshot(): ISnapshotStorage {
    if (this.currentSnapshot) {
      return this.currentSnapshot
    }

    if (network.name === 'hardhat' && fs.existsSync(this.snapshotPath)) {
      // Remove snapshot file in hardhat environment
      fs.unlinkSync(this.snapshotPath)
      logger.log('Removed existing snapshot file in hardhat environment', '🗑️')
    }

    try {
      if (fs.existsSync(this.snapshotPath)) {
        const data = fs.readFileSync(this.snapshotPath, 'utf8')
        this.currentSnapshot = JSON.parse(data)
        if (!this.currentSnapshot) throw new Error('Invalid snapshot data')
        // NOTE: Reset the indices on each load to ensure snapshot contracts are loaded
        this.currentSnapshot.contractIndices = {}
        const contractCount = Object.keys(this.currentSnapshot.deployedContracts).length
        logger.log(`Loaded existing deployment snapshot with ${contractCount} contracts`, '📥')
      } else {
        this.initializeNewSnapshot()
      }
    } catch (error) {
      logger.warn(`Failed to load snapshot, creating new one: ${error}`)
      this.initializeNewSnapshot()
    }

    return this.currentSnapshot!
  }

  protected saveSnapshot(snapshot: ISnapshotStorage): void {
    try {
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2))
      logger.log('Deployment snapshot saved', '💾')
    } catch (error) {
      logger.error(`Failed to save snapshot: ${error}`)
    }
  }

  private initializeNewSnapshot(): void {
    this.currentSnapshot = {
      network: network.name,
      timestamp: new Date().toISOString(),
      deployedContracts: {},
      currentStep: '',
      deploymentConfig: {},
      contractIndices: {}, // Add this line
    }
    this.saveSnapshot(this.currentSnapshot)
  }
}
