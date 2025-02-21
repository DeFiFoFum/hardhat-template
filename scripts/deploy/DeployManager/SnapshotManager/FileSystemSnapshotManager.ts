import fs from 'fs'
import path from 'path'
import { network } from 'hardhat'
import { logger } from '../../../../hardhat/utils/logger'
import { BaseSnapshotManager, ISnapshotStorage } from './ISnapshotManager'
import { createYesOrNoPrompt } from '../../../../lib/prompts/yesOrNoPrompt'

type FileSystemSnapshotManagerProps = {
  snapshotPath: string
}

export class FileSystemSnapshotManager extends BaseSnapshotManager {
  private props: FileSystemSnapshotManagerProps
  private currentSnapshot: ISnapshotStorage | null = null

  private constructor(_props: FileSystemSnapshotManagerProps) {
    super()
    this.props = _props
    this.loadSnapshot()
  }

  static async create(baseDir: string): Promise<FileSystemSnapshotManager> {
    // Create snapshots directory if it doesn't exist
    const snapshotsDir = path.join(baseDir, 'snapshots')
    if (!fs.existsSync(snapshotsDir)) {
      fs.mkdirSync(snapshotsDir, { recursive: true })
    }
    // Use network name in snapshot file path
    const snapshotPath = path.join(snapshotsDir, `${network.name}-deployment-snapshot.json`)
    const networkIsHardhat = network.name === 'hardhat'
    if (!networkIsHardhat && fs.existsSync(snapshotPath)) {
      const shouldReuseSnapshot = await createYesOrNoPrompt(
        'Existing deployment snapshot found. Would you like to reuse it? (Y/n): ',
        'Deployment aborted: User chose not to reuse existing snapshot',
      )
      if (!shouldReuseSnapshot) {
        const archivePath = snapshotPath.replace('.json', '_archive.json')
        fs.renameSync(snapshotPath, archivePath)
        logger.log('Archived existing snapshot file', '🗑️')
      }
    }

    const props: FileSystemSnapshotManagerProps = { snapshotPath }

    return new FileSystemSnapshotManager(props)
  }

  protected loadSnapshot(): ISnapshotStorage {
    if (this.currentSnapshot) {
      return this.currentSnapshot
    }

    if (network.name === 'hardhat' && fs.existsSync(this.props.snapshotPath)) {
      // Remove snapshot file in hardhat environment
      fs.unlinkSync(this.props.snapshotPath)
      logger.log('Removed existing snapshot file in hardhat environment', '🗑️')
    }

    try {
      if (fs.existsSync(this.props.snapshotPath)) {
        const data = fs.readFileSync(this.props.snapshotPath, 'utf8')
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
      fs.writeFileSync(this.props.snapshotPath, JSON.stringify(snapshot, null, 2))
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
