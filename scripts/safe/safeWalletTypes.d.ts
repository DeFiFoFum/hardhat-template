export type SafeSetupConfig<T extends string = string> = {
  safeDeployIndex: number
  safeName: T
}

export type SafeOwnerConfig = {
  safeAddress: string
  ownersToAdd: string[]
  threshold: number
}

/**
 * Pass in the SafeNames enum to create a map of SafeOwnerConfig
 */
export type SafeOwnerConfigMap<T extends string> = {
  [key in T]: SafeOwnerConfig
}
