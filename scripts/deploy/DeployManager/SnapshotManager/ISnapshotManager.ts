import { DeployedContractDetails } from '../IDeployManager'

export interface ISnapshotManager {
  // Core contract tracking
  getNextContract(
    name: string,
    isProxy?: boolean,
  ): {
    snapshotName: string
    existingContract?: DeployedContractDetails
  }
  getContract(name: string): DeployedContractDetails | null
  saveContract(details: DeployedContractDetails): void
  getAllContracts(): { [name: string]: DeployedContractDetails }
  getDeployedContract(name: string): DeployedContractDetails | null

  // Deployment progress tracking
  getCurrentStep(): string
  getLastCompletedStep(): string
  markStepComplete(step: string): void
  updateDeploymentProgress(step: string): void
  shouldSkipStep(step: string): boolean

  // Verification status
  isContractVerified(name: string): boolean
  markContractVerified(name: string): void

  // Optional configuration
  getDeploymentConfig(): any
  updateDeploymentConfig(config: any): void
}

export interface ISnapshotStorage {
  network: string
  timestamp: string
  deployedContracts: {
    [snapshotName: string]: {
      details: DeployedContractDetails
      verified: boolean
    }
  }
  currentStep: string
  deploymentConfig: any
  // Track highest index used for each base name
  contractIndices: {
    [baseName: string]: number
  }
}

// Base class that implements common functionality
export abstract class BaseSnapshotManager implements ISnapshotManager {
  protected abstract loadSnapshot(): ISnapshotStorage
  protected abstract saveSnapshot(snapshot: ISnapshotStorage): void

  getNextContract(
    contractName: string,
    isProxy?: boolean,
  ): {
    snapshotName: string
    existingContract?: DeployedContractDetails
  } {
    const snapshot = this.loadSnapshot()

    // Get current highest index
    let index = snapshot.contractIndices[contractName] || 0
    let snapshotName = isProxy ? `TransparentUpgradeableProxy_${contractName}_${index}` : `${contractName}_${index}`
    // Save the new highest index
    snapshot.contractIndices[contractName] = ++index
    this.saveSnapshot(snapshot)

    // Check if contract exists
    const existingContract = snapshot.deployedContracts[snapshotName]?.details

    return {
      snapshotName,
      existingContract,
    }
  }

  getDeployedContract(contractName: string): DeployedContractDetails | null {
    return this.getContract(contractName)
  }

  getContract(snapshotName: string): DeployedContractDetails | null {
    const snapshot = this.loadSnapshot()
    // First try to find by original name
    for (const [_, data] of Object.entries(snapshot.deployedContracts)) {
      if (data.details.snapshotName === snapshotName) {
        return data.details
      }
    }
    // If not found, try snapshot name
    return snapshot.deployedContracts[snapshotName]?.details || null
  }

  getAllContracts(): { [snapshotName: string]: DeployedContractDetails } {
    const snapshot = this.loadSnapshot()
    const contracts: { [name: string]: DeployedContractDetails } = {}
    Object.entries(snapshot.deployedContracts).forEach(([_, data]) => {
      // Use the original name as the key, but preserve the snapshotName in the details
      contracts[data.details.snapshotName] = data.details
    })
    return contracts
  }

  saveContract(details: DeployedContractDetails): void {
    const snapshot = this.loadSnapshot()
    snapshot.deployedContracts[details.snapshotName] = {
      details,
      verified: false,
    }
    this.saveSnapshot(snapshot)
  }

  getCurrentStep(): string {
    return this.loadSnapshot().currentStep
  }

  getLastCompletedStep(): string {
    return this.getCurrentStep()
  }

  markStepComplete(step: string): void {
    const snapshot = this.loadSnapshot()
    snapshot.currentStep = step
    this.saveSnapshot(snapshot)
  }

  updateDeploymentProgress(step: string): void {
    this.markStepComplete(step)
  }

  shouldSkipStep(step: string): boolean {
    const currentStep = this.getCurrentStep()
    return currentStep !== '' && currentStep >= step
  }

  isContractVerified(snapshotName: string): boolean {
    const snapshot = this.loadSnapshot()
    // Check verification status by both original name and snapshot name
    for (const [_, data] of Object.entries(snapshot.deployedContracts)) {
      if (data.details.snapshotName === snapshotName) {
        return data.verified
      }
    }
    return false
  }

  markContractVerified(snapshotName: string): void {
    const snapshot = this.loadSnapshot()
    // Find and mark verified by both original name and snapshot name
    for (const [currentSnapshotName, _] of Object.entries(snapshot.deployedContracts)) {
      if (snapshotName === currentSnapshotName) {
        snapshot.deployedContracts[snapshotName].verified = true
        this.saveSnapshot(snapshot)
        break
      }
    }
  }

  getDeploymentConfig(): any {
    return this.loadSnapshot().deploymentConfig
  }

  updateDeploymentConfig(config: any): void {
    const snapshot = this.loadSnapshot()
    snapshot.deploymentConfig = config
    this.saveSnapshot(snapshot)
  }
}
